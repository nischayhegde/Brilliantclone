# Brilliant — Reading the Charts

A Brilliant.org-style learning app for stock/options technical-analysis patterns.
**Phase 1 (this build): the platform shell** — auth, dashboard, streak, progress, lesson
flow, resume, and the congratulations screen are all fully functional. Module bodies are
intentionally **placeholders**; the animated Phaser candlestick engine and the real
per-module chart/quiz content land in a later phase behind the existing `ModuleRenderer` seam.

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

Pure logic → services → state → UI. All chart logic is isolated behind `ModuleRenderer`
so the Phase-2 Phaser engine drops in with no flow/persistence changes.

```
src/
  domain/        progress.ts, streak.ts  — pure, unit-tested (no React/Firebase)
  lib/           firebase.ts             — SDK init (auth, db, googleProvider)
  auth/          AuthContext, ProtectedRoute
  services/      userService.ts          — getOrCreateUserDoc, persistProgress
  state/         LessonProgressContext   — binds domain + Firestore + in-session streak
  data/          lessonManifest.ts       — 24 structural entries (no chart content)
  components/    ui/*, TopNav, ProgressBar (24-tick), StreakBadge, LessonCard,
                 module/ModuleRenderer + Teach/Quiz placeholders
  pages/         Login, Dashboard, Lesson, Congrats
```

### Data model — `users/{uid}`

```ts
{ email, displayName, photoURL,
  progress: { lastCompletedModule: number, completedModules: number[] },
  bestStreak: number, createdAt, updatedAt }
```

- **Resume** jumps to `lastCompletedModule + 1`.
- **Streak** = "most modules completed in one sitting" (PRD): `currentSitting` is in-session
  and resets each load; `bestStreak` is persisted and monotonic.
- **Security rules** (`firestore.rules`): a user can only read/write their own doc;
  `bestStreak` is validated as a non-negative int and is monotonic on update.

## Deferred to later phases

- Phaser candlestick rendering + animation (teach annotations, quiz mask/reveal).
- Real per-module content (chart data from `planning/data/*.json`, BUY/SELL/STOP levels,
  quiz question + explanation text).
- Firebase Hosting deploy (config is in `firebase.json`; build + `firebase deploy --only hosting`).
- Firebase JS bundle code-splitting (the SDK makes the initial chunk ~640 kB).
```
