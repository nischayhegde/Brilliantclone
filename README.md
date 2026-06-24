# Trilliant — Reading the Charts

A Brilliant.org-style learning app for stock/options trading.
**Fully built:** Google auth, a 5-lesson dashboard, per-lesson progress/resume, streak,
and animated, interactive **Phaser** modules for every lesson.

**Five lessons (84 modules):**
1. **Reading the Charts** — 24 modules, 12 chart patterns on real verified OHLC (teach overlay + masked-reveal quiz).
2. **The Order Book** — 15 modules: bid/ask ladder, spread, limit vs market, FIFO matching, slippage, liquidity, "trade the tape" capstone.
3. **Short Selling** — 15 modules: borrow→sell→cover lifecycle, unlimited-loss asymmetry, margin calls, short squeezes (real GME/VW/LCID/PTON/HOOD charts).
4. **Option Contracts** — 15 modules: calls/puts, premium = intrinsic + time, the four payoff diagrams with breakevens, delta, leverage.
5. **Straddles & Strangles** — 15 modules: two-leg payoffs, breakevens, the IV-crush trap, a volatility lab.

All chart data is **real and verified** (`src/data/candles.ts`); all simulated figures (order-book depth, option premiums) are deterministic with exactly-correct math, labelled illustrative.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`, brand tokens via `@theme` in `src/index.css`)
- **Firebase** — Google Auth + Cloud Firestore
- **React Router v6**, **Vitest** for the pure-logic unit tests

## Prerequisites

- Node 18+ (built on Node 22)
- A Firebase project (`brilliantclone`) — already provisioned (Firestore in `nam5`,
  owner-only security rules deployed, a Web app registered).

## One required manual step (Firebase Console)

The Firebase CLI/MCP cannot toggle auth providers, so **enable Google sign-in once**:

1. Firebase Console → **Authentication** → **Sign-in method** → **Google** → **Enable**
   (set a project support email) → Save.
2. Authentication → **Settings → Authorized domains** → confirm `localhost` is present
   (it is by default). Add your deploy domain later.

Until this is done, sign-in fails with `auth/operation-not-allowed` (the login screen shows
a friendly message explaining exactly this).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (or next free port)
```

`.env.local` already holds the Firebase **web** config (public values — safe in client
bundles; access is enforced by Firestore rules + the enabled provider, not secrecy). To
recreate it on another machine, copy `.env.example` and fill from
`firebase apps:sdkconfig web`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` + production build to `dist/` |
| `npm run typecheck` | type-check only (`tsc -b`) |
| `npm test` | Vitest (domain unit tests) |
| `npm run test:watch` | Vitest watch mode |

## Architecture

Pure logic → services → state → engine → lessons → UI. Lessons are **data**; the engine
renders them. Each lesson is a self-contained package (`{ lesson, scenes }`) the registry
auto-discovers, so a new lesson is a folder, not a wiring change.

```
src/
  domain/        progress.ts (per-lesson, parametrised), streak.ts — pure, unit-tested
  lib/           firebase.ts             — SDK init (auth, db, googleProvider)
  auth/          AuthContext, ProtectedRoute
  services/      userService.ts          — getOrCreateUserDoc, persistLessonProgress
  state/         LessonProgressContext   — multi-lesson progress + Firestore + streak
  data/          candles.ts              — 29 real verified OHLC series (generated)
  engine/        types.ts, palette.ts, bus.ts, PhaserCanvas.tsx, ModuleScene.ts,
                 modules/ModuleRenderer (intro/teach/interactive/quiz/capstone),
                 scenes/CandleChartScene + TitleScene (reusable)
  lessons/       registry.ts + one folder per lesson (index.ts = LessonPackage,
                 scenes/*.ts = that lesson's Phaser scenes)  — registry.test.ts wiring check
  components/    ui/*, TopNav, ProgressBar, StreakBadge, LessonCard
  pages/         Login, Dashboard (5 lessons), Lesson (/lesson/:lessonId/:moduleId), Congrats
```

**The module engine.** A `ModuleSpec` names a `scene.kind` + `params` and (for quizzes) a
`QuizSpec`. `PhaserCanvas` boots a fixed-resolution (760×460), FIT-scaled Phaser game and
mounts the scene; `ModuleScene` is the shared base (helpers for text/panels/sliders/buttons
/draggables/tweens). Quizzes run answer → `reveal` (bus event → `scene.onReveal()`) → grade
→ explain entirely through this seam.

### Data model — `users/{uid}`

```ts
{ email, displayName, photoURL,
  lessonProgress: { [lessonId]: { lastCompletedModule, completedModules[] } },
  progress: { ... },        // legacy field retained so the deployed rules still validate
  bestStreak, createdAt, updatedAt }
```

- **Resume** jumps to `lastCompletedModule + 1`, per lesson.
- **Streak** = "most modules completed in one sitting" (PRD): in-session, `bestStreak` persisted & monotonic.
- **Security rules** (`firestore.rules`): own-doc only; `bestStreak` non-negative int & monotonic.
  Per-lesson progress is stored under `lessonProgress` while the legacy `progress` field is kept
  intact so writes pass the currently-deployed rules with **no redeploy** needed.

## Notes / follow-ups

- **Bundle:** Phaser (~1.5 MB) and Firebase are split into their own cached chunks; the app
  chunk is ~630 kB. True per-lesson lazy-loading (dynamic `import()` of each `LessonPackage`)
  would trim first paint further — a clean next step.
- **Runtime QA:** typecheck, build, and the registry wiring test are green; do a visual pass
  of the bespoke scenes via `npm run dev` (a Playwright smoke suite could automate this).
- **Deploy:** `npm run build` then `firebase deploy --only hosting` (config in `firebase.json`).
```
