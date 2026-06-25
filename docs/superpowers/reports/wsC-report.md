# WS-C Report — Secure backend + OpenAI GPT-5.5 wiring

Branch: `feat/trading-practice`. Status: **complete & green**. Root: 277 tests pass (was 272;
+5 client transport), typecheck + build clean. Functions: `npm install` + `npm run build`
(tsc) green, 24 unit tests pass. No OpenAI key, SDK, or model slug in the client bundle.

## Scope delivered
Stood up the Cloud Functions backend, made GPT-5.5 reachable behind a secure, authed,
rate-limited callable, and swapped the client `ModelClient` from Firebase AI Logic
(Gemini) to that callable — so the EXISTING composer/coach pipelines now run on GPT-5.5
with the key secured. Proved the functions toolchain can import the isomorphic genui core
(unblocking WS-D) and fixed the `validator ⇄ schema` import cycle. (WS-D prompts/pipelines
and WS-E UI are explicitly out of scope.)

## Functions package layout (`functions/`)
```
functions/
  package.json            # Firebase Functions v2, TS, Node 20; deps: firebase-functions ^7.2.5,
                          #   firebase-admin ^13.10.0 (peer-pinned), openai ^6.45.0
  tsconfig.json           # module commonjs, target es2022, rootDir src, outDir lib; excludes *.test.ts
  vitest.config.ts        # node env; src/**/*.test.ts
  .gitignore              # ignores lib/, node_modules/, src/shared/ (generated)
  scripts/copy-shared.mjs # prebuild: mirror the isomorphic genui core into src/shared
  src/
    openai.ts             # callModel() — Responses API wrapper for GPT-5.5
    guards.ts             # pure helpers: input validation, token/temperature clamps, RateLimiter
    genui.ts              # sanityValidateLayout() — proves the isomorphic import path
    index.ts              # aiRespond callable (auth + rate-limit + clamp) + re-exports sanityValidateLayout
    openai.test.ts        # callModel with the openai SDK mocked (no network)
    guards.test.ts        # clamp/validate/rate-limit unit tests
    genui.test.ts         # cross-package import proof (valid/invalid/track-fitness)
    shared/**             # GENERATED mirror of src/practice/{types.ts, genui/*.ts}
```

## Contracts

### `callModel(params, client?) → { text, json? }` (`functions/src/openai.ts`)
```ts
params: { instructions?: string; input: string;
          jsonSchema?: { name: string; schema: Record<string,unknown>; strict?: boolean };
          temperature?: number; maxOutputTokens?: number }
→ { text: string; json?: unknown }   // json present only when jsonSchema given and output parses
```
Pure transport (no auth/validation/clamp). `client` is injectable for offline tests;
defaults to a lazily-cached `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`.

### `aiRespond` callable (`functions/src/index.ts`)
```ts
data: { instructions?, input, jsonSchema?, temperature?, maxOutputTokens? } → { text }
```
Order of guards: (1) **auth required** → `HttpsError('unauthenticated')` if no `request.auth.uid`;
(2) **per-uid rate limit** 15/min sliding window → `HttpsError('resource-exhausted')`;
(3) **input validation** → `HttpsError('invalid-argument')`; (4) **clamp** temperature→[0,2],
maxOutputTokens→[16,4096] (default 1024), call `callModel`, return `{ text }`; model errors →
`HttpsError('internal')`. Secret bound via `defineSecret('OPENAI_API_KEY')` on the callable.

### Client `ModelClient` (`src/services/aiModel.ts`)
Interface unchanged: `generate(prompt, opts?: { temperature?, maxTokens? }) → Promise<string>`.
It maps `prompt→input`, `opts.temperature→temperature`, `opts.maxTokens→maxOutputTokens`,
invokes `httpsCallable(functions, 'aiRespond')`, and returns `res.data.text`. `getModelClient()`
returns **null** (try/catch) when the callable can't be wired → curated-only mode. Per-call
failures reject and are caught by the composer/coach (existing fallback) — no behavioural change
to those pipelines.

## Verified `openai` SDK shape (installed v6.45.0)
Confirmed against `node_modules/openai/resources/responses/responses.d.ts`:
- `client.responses.create({ model:'gpt-5.5', input, instructions?, max_output_tokens?, temperature?, reasoning:{ effort }, text? })`
- structured output: `text: { format: { type:'json_schema', name, schema, strict? } }`
  (`ResponseFormatTextJSONSchemaConfig`: `name`, `schema`, `type:'json_schema'`, `strict?`)
- `ReasoningEffort` includes `'medium'` (default used)
- read `response.output_text` (string convenience getter)

The wrapper builds a `ResponseCreateParamsNonStreaming` object (so `output_text` is typed),
omitting `temperature`/`text` when not requested. `temperature` is forwarded when provided but
noted as possibly ignored by reasoning models.

## Isomorphic genui import + cycle fix
**Cross-package strategy — prebuild copy script** (`scripts/copy-shared.mjs`, run on
`prebuild` + `pretest`). It mirrors a CLOSED pure-source set — `src/practice/types.ts` plus the
top-level `src/practice/genui/*.ts` core (schema, registry, types, decision, defaultLayout,
copyLint) — into `functions/src/shared/practice/**`, preserving the directory layout so every
relative import (`../types`, `./registry`, …) resolves unchanged. The `widgets/` subtree and
`WidgetHost.tsx` (React) are never copied. Chosen over tsconfig project references because
`functions/` is an independently-deployable package with its own `rootDir`/`outDir`; compiling
sources outside its rootDir yields a nested, deploy-hostile `lib/` layout. The mirror is
`.gitignore`d (regenerated every build) so there's no committed drift. `functions/src/genui.ts`
imports `validateLayout`/`layoutFitsTrack` from the mirror and exposes `sanityValidateLayout`,
unit-tested in `genui.test.ts` (proves compile + import + call in the functions runtime).

**Cycle fix.** Previously `validator.ts` imported `validateLayout` from `genui/schema.ts`, and
`genui/schema.ts` imported the copy lints from `validator.ts` — a real `validator ⇄ schema`
cycle that would have dragged `validator.ts` (and CANDLES/RUBRICS/NUDGES) into the functions
bundle. Extracted the lint constants/functions (`DISALLOWED_CLAIM_PATTERNS`,
`NUMERIC_CLAIM_PATTERN`, `hasDisallowedClaim`, `hasNumericClaim`) into a true LEAF module
`src/practice/genui/copyLint.ts` (imports nothing). Now both `genui/schema.ts` and
`validator.ts` depend only on the leaf; `validator.ts` re-exports the four symbols so existing
consumers (`ai/validateComposed.ts`, `ai/coachPrompt.ts`) keep importing them from `../validator`
unchanged. The functions mirror is cycle-clean: `validateLayout`'s runtime graph is
schema → {copyLint, registry} only.

## Client / emulator wiring
- `src/lib/firebase.ts`: added `export const functions = getFunctions(app)`. Emulator connect is
  **opt-in** — `import.meta.env.DEV && VITE_USE_EMULATORS==='true'` → `connectFunctionsEmulator(127.0.0.1:5001)`.
  Opt-in (not blanket DEV) so the default dev session still talks to the real backend instead of
  failing every AI call against a non-running emulator (it would degrade to curated-only, but the
  flag keeps dev clean). `firebase/functions` added to the Vite `firebase` manualChunk.
- `firebase.json`: added a `functions` block (source `functions`, predeploy `npm --prefix … run build`,
  ignores tests/lib) and an `emulators` block (auth 9099, functions 5001, firestore 8080, UI on).
- `.env.example`: documents `OPENAI_API_KEY` as a **Functions secret**
  (`firebase functions:secrets:set OPENAI_API_KEY`), explicitly NOT a `VITE_` var; plus the Blaze
  prerequisite and the optional `VITE_USE_EMULATORS` flag.

## Test evidence (no network / no real model)
- `functions/src/openai.test.ts` (6): request shape (`model:'gpt-5.5'`, `reasoning.effort:'medium'`,
  `text.format` json_schema), JSON parse + unparseable fallback, pass-through of
  instructions/temperature/max_output_tokens, default-client path with the `openai` module mocked.
- `functions/src/guards.test.ts` (14): token/temperature clamps, input validation (valid/invalid,
  field whitelisting, malformed schema), `RateLimiter` (limit, window-slide, per-uid isolation).
- `functions/src/genui.test.ts` (4): `sanityValidateLayout` accept/reject/numeric-lint/track-fitness
  — the isomorphic import proof.
- `src/services/aiModel.test.ts` (5): `httpsCallable` + `../lib/firebase` mocked; arg mapping,
  caching, graceful `null`, and `generate` rejection on call failure.

## Gate output
- Root `npm test` → **48 files, 277 tests passed**.
- Root `npm run typecheck` (`tsc -b`) → clean.
- Root `npm run build` (`tsc -b && vite build`) → built in ~11s; root build does NOT compile
  `functions/` (separate tsconfig, not referenced).
- `functions/`: `npm install` ok; `npm run build` (tsc) → clean; `npm test` → **3 files, 24 passed**.
- Client bundle scan (`dist/assets`): `OPENAI_API_KEY`=0, `gpt-5.5`=0, real `sk-…` keys=0,
  `responses.create`=0, `openai`=0. (`aiRespond` callable name present, as expected.)

## Prerequisites for LIVE GPT-5.5 (NOT needed for build/tests)
1. Enable **Blaze** on the `brilliantclone` Firebase project (Cloud Functions requires it).
2. `firebase functions:secrets:set OPENAI_API_KEY`.
3. `firebase deploy --only functions` (or run the emulator with `VITE_USE_EMULATORS=true`).

## Boundary note for WS-D
`aiRespond` is a generic text/JSON transport — the client still builds the composer/grader
prompts. WS-D should add dedicated `composeScenario`/`gradeRun` callables that build prompts
**server-side** (importing the isomorphic genui prompt builders + `validateLayout` via
`functions/src/genui.ts`), so the client never sees the prompt or the raw model output — a
tighter boundary and the path for hybrid grading.

## Concerns / follow-ups
- Rate limiter is **in-memory per warm instance** (best-effort). For a global cap, WS-D can move
  it to a Firestore counter. Setting `maxInstances: 10` keeps the per-instance window meaningful.
- `temperature` is forwarded to the Responses API when provided; GPT-5.5 (a reasoning model) may
  ignore or reject it. The composer/coach currently pass temperature; if live calls error on it,
  drop temperature from the request (single-line change in `openai.ts`).
- `firebase-admin` pinned to `^13.10.0` (not 14) to satisfy `firebase-functions@7`'s peer range.
- `npm audit` reports transitive advisories in the functions dev/test toolchain; none affect the
  runtime callable. Revisit during WS-F hardening.
