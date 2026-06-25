# Practice Mode — Implementation Plans (M0–M6)

Build order is strict: each milestone depends on the prior. Every plan is TDD, with
`npm test` + `npm run typecheck` green at each commit. Tests never hit the network or a model.

| Milestone | Plan | Delivers | Depends on |
|---|---|---|---|
| M0 | `2026-06-25-practice-m0-foundations.md` | Types, validator, registry, account reducer, PracticeContext, routes, Firestore rules | — |
| M1 | `2026-06-25-practice-m1-track-a-charts.md` | Track A charts: scene, resolver, rubric, nudges, journal, debrief, player | M0 |
| M2 | `2026-06-25-practice-m2-track-c-options.md` | Track C options: chain loader, BS, resolver, rubric, TrackEngine, OptionsBuildScene | M0, M1 |
| M3 | `2026-06-25-practice-m3-llm-composer-coach.md` | LLM composer + coach behind validator loop with curated fallback | M0–M2 |
| M4 | `2026-06-25-practice-m4-adaptive-difficulty.md` | Tier hysteresis + $1k coached reset-and-reflect | M0–M3 |
| M5 | `2026-06-25-practice-m5-track-b-market-making.md` | Track B market making: book stats, session sim, rubric, scene | M0–M2 (engine) |
| M6 | `2026-06-25-practice-m6-polish.md` | Analytics, a11y/reduced-motion, copy/disclaimers, stats panel | M0–M5 |

Source spec: `planning/PRDphase2.md`.

## Conventions
- Pure modules (types, reducers, validators, resolvers, rubrics) get full red→green TDD.
- Phaser scenes get wiring smoke tests (mocked Phaser); UI integration is manual-smoke + tested pure logic.
- The model is never the source of a traded number: numbers flow LLM → (text + refs) → validator → real data → sim → grader → LLM (text).
