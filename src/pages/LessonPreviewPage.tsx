/**
 * DEV-ONLY visual-verification harness for lesson modules.
 *
 * The real lesson routes live behind a Google-popup `ProtectedRoute`, so the Phaser
 * module scenes can't be screenshotted without signing in. This page renders the SAME
 * `ModuleRenderer` for any lesson/module with NO signed-in user required.
 *
 * Lesson + module are read from the URL (?lesson=options&m=3) so each module is a clean,
 * deterministic navigation — handy for automated screenshots.
 *
 * It is mounted ONLY behind an `import.meta.env.DEV` guard in `App.tsx`, so the route is
 * never registered (and this module is never bundled) in a production build.
 */
import { useSearchParams } from 'react-router-dom'
import ModuleRenderer from '../engine/modules/ModuleRenderer'
import { PACKAGES, getModule, resolveScene } from '../lessons/registry'

export default function LessonPreviewPage() {
  const [params, setParams] = useSearchParams()
  const lessonId = params.get('lesson') ?? 'options'
  const moduleId = Number(params.get('m') ?? '1')

  const pkg = PACKAGES.find((p) => p.lesson.id === lessonId) ?? PACKAGES[0]
  const total = pkg.lesson.modules.length
  const module = getModule(pkg.lesson.id, moduleId)
  const scene = module ? resolveScene(pkg.lesson.id, module.scene.kind) : undefined

  const go = (next: Record<string, string>) => setParams({ lesson: lessonId, m: String(moduleId), ...next })

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-brand-amber/40 bg-brand-amber-soft/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="rounded-full bg-brand-amber px-2.5 py-0.5 text-xs font-bold text-white">
            DEV lesson preview
          </span>
          {PACKAGES.map((p) => (
            <button
              key={p.lesson.id}
              type="button"
              onClick={() => setParams({ lesson: p.lesson.id, m: '1' })}
              className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                lessonId === p.lesson.id
                  ? 'bg-ink text-white'
                  : 'border border-hairline bg-paper text-ink-soft hover:border-ink/30'
              }`}
            >
              {p.lesson.index}. {p.lesson.title}
            </button>
          ))}
          <nav className="ml-auto flex flex-wrap items-center gap-1">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => go({ m: String(n) })}
                className={`h-8 w-8 rounded-lg text-sm font-semibold transition ${
                  moduleId === n
                    ? 'bg-ink text-white'
                    : 'border border-hairline bg-paper text-ink-soft hover:border-ink/30'
                }`}
              >
                {n}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-2 py-5 sm:px-4 sm:py-8">
        {module && scene ? (
          <ModuleRenderer
            key={`${lessonId}:${moduleId}`}
            module={module}
            scene={scene}
            onComplete={() => go({ m: String(Math.min(moduleId + 1, total)) })}
          />
        ) : (
          <p className="py-24 text-center text-sm text-muted">No module {moduleId} in {lessonId}.</p>
        )}
      </main>
    </div>
  )
}
