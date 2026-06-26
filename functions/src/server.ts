/**
 * Render web service for Trading Practice — the same secure GPT-5.5 transport the Firebase
 * callables (./index.ts) expose, but as a plain HTTP server so it can run on Render's free
 * Node plan (no Firebase Blaze required).
 *
 * Two endpoints mirror the callables 1:1 — they build the prompt + JSON schema SERVER-SIDE
 * (importing the isomorphic genui builders + validators, see ./genui) and validate/guard the
 * model output here. The client never sees the prompt or the raw model output, and the OpenAI
 * key stays a server env var (process.env.OPENAI_API_KEY, set in the Render dashboard).
 *
 *   POST /api/compose  { track, tier, accountBalance, catalog } → { spec } | { fallback: true }
 *   POST /api/grade    { track, passScore, decision, ... }      → { score, feedback } | { fallback: true }
 *   GET  /healthz      → { ok: true }   (Render health check)
 *
 * Auth: every /api/* call must carry `Authorization: Bearer <Firebase ID token>`. The token is
 * verified with firebase-admin (project id only — no service account needed for verification),
 * and the decoded uid drives the per-uid rate limit. CORS is locked to the configured origins.
 */
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { callModel } from './openai'
import {
  RateLimiter,
  clampMaxOutputTokens,
  validateComposeInput,
  validateGradeInput,
} from './guards'
import {
  runCompose,
  runGrade,
  type CallModelFn,
  type ComposeRequest,
  type GradeRequest,
} from './genui'

// --- model transport (identical surface to index.ts) ------------------------------
const modelTransport: CallModelFn = (params) =>
  callModel({
    instructions: params.instructions,
    input: params.input,
    jsonSchema: params.jsonSchema,
    maxOutputTokens: clampMaxOutputTokens(params.maxOutputTokens),
  })

// --- firebase-admin (token verification only — no credential required) ------------
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'brilliantclone'
if (!getApps().length) initializeApp({ projectId: PROJECT_ID })

// --- per-uid rate limit (best-effort, per instance) -------------------------------
const limiter = new RateLimiter({ limit: 15, windowMs: 60_000 })

/** Verify the bearer ID token + claim a rate-limit slot; sets `res.locals.uid` or sends 401/429. */
async function requireAuthedSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) {
    res.status(401).json({ error: 'You must be signed in to use AI features.' })
    return
  }
  let uid: string
  try {
    const decoded = await getAuth().verifyIdToken(match[1])
    uid = decoded.uid
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Sign in again.' })
    return
  }
  const rl = limiter.check(uid)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)))
    res.status(429).json({ error: `Rate limit reached. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` })
    return
  }
  res.locals.uid = uid
  next()
}

// --- app --------------------------------------------------------------------------
export function createApp() {
  const app = express()

  // Lock CORS to the Hosting origins (comma-separated ALLOWED_ORIGINS), plus localhost in dev.
  const configured = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const defaults = [
    'https://brilliantclone.web.app',
    'https://brilliantclone.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173',
  ]
  const allowList = new Set(configured.length ? configured : defaults)
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl (no Origin header) and any explicitly allow-listed origin.
        if (!origin || allowList.has(origin)) return cb(null, true)
        cb(new Error('Origin not allowed'))
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86_400,
    }),
  )
  // Body cap bounds the catalog/grade payload (guards enforce the finer per-field limits).
  app.use(express.json({ limit: '1mb' }))

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true })
  })

  // POST /api/compose → { spec } | { fallback: true }
  app.post('/api/compose', requireAuthedSlot, async (req, res) => {
    const parsed = validateComposeInput(req.body)
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error })
      return
    }
    try {
      const out = await runCompose(parsed.value as unknown as ComposeRequest, modelTransport)
      res.json(out)
    } catch (err) {
      console.error('compose failed', err)
      res.json({ fallback: true })
    }
  })

  // POST /api/grade → { score, feedback } | { fallback: true }
  app.post('/api/grade', requireAuthedSlot, async (req, res) => {
    const parsed = validateGradeInput(req.body)
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error })
      return
    }
    try {
      const out = await runGrade(parsed.value as unknown as GradeRequest, modelTransport)
      res.json(out)
    } catch (err) {
      console.error('grade failed', err)
      res.json({ fallback: true })
    }
  })

  return app
}

// Render sets PORT; bind 0.0.0.0 so the platform health check can reach us.
const port = Number(process.env.PORT) || 8080
createApp().listen(port, '0.0.0.0', () => {
  console.log(`practice LLM endpoint listening on :${port} (project ${PROJECT_ID})`)
})
