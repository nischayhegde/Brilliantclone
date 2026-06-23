import { describe, it, expect, vi } from 'vitest'

/**
 * Wiring smoke test for all lesson packages — catches what the type checker can't:
 * a module pointing at a scene `kind` that isn't registered, non-contiguous module
 * ids, or a malformed quiz. We stub Phaser (it runs canvas feature-detection on
 * import, which needs a real browser) so we can import the packages purely to read
 * their data — no scene is ever instantiated here.
 */
vi.mock('phaser', () => {
  const stub: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'Scene') return class {}
      return stub
    },
    construct: () => ({}),
    apply: () => stub,
  })
  return { default: stub }
})

const { PACKAGES } = await import('./registry')

const EXPECTED_COUNTS: Record<string, number> = {
  'reading-charts': 24,
  'order-book': 15,
  'short-selling': 15,
  options: 15,
  volatility: 15,
}

describe('lesson registry', () => {
  it('has all 5 lessons with unique, ordered indices', () => {
    expect(PACKAGES.length).toBe(5)
    expect(PACKAGES.map((p) => p.lesson.index)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(PACKAGES.map((p) => p.lesson.id)).size).toBe(5)
  })

  it('has the expected module count per lesson', () => {
    for (const p of PACKAGES) {
      expect(p.lesson.modules.length, p.lesson.id).toBe(EXPECTED_COUNTS[p.lesson.id])
    }
  })
})

describe.each(PACKAGES.map((p) => [p.lesson.id, p] as const))('lesson %s', (_id, pkg) => {
  it('module ids are contiguous 1..N', () => {
    const ids = pkg.lesson.modules.map((m) => m.id)
    expect(ids).toEqual(Array.from({ length: ids.length }, (_, i) => i + 1))
  })

  it('every module scene.kind resolves in the scenes map', () => {
    for (const m of pkg.lesson.modules) {
      expect(
        pkg.scenes[m.scene.kind],
        `${pkg.lesson.id} #${m.id} kind="${m.scene.kind}"`,
      ).toBeTruthy()
    }
  })

  it('every quiz/challenge module is well-formed', () => {
    for (const m of pkg.lesson.modules) {
      if (m.type === 'quiz') {
        expect(m.quiz, `${pkg.lesson.id} #${m.id} missing quiz`).toBeTruthy()
      }
      if (m.type === 'challenge') {
        expect(m.challenge, `${pkg.lesson.id} #${m.id} missing challenge`).toBeTruthy()
        expect(
          (m.challenge?.prompt ?? '').length,
          `${pkg.lesson.id} #${m.id} challenge.prompt`,
        ).toBeGreaterThan(0)
      }
      if (m.quiz) {
        expect(m.quiz.options.length, `${pkg.lesson.id} #${m.id} options`).toBeGreaterThanOrEqual(2)
        const optionIds = m.quiz.options.map((o) => o.id)
        expect(optionIds, `${pkg.lesson.id} #${m.id} correctId`).toContain(m.quiz.correctId)
        expect(m.quiz.explainRight.length).toBeGreaterThan(0)
        expect(m.quiz.explainWrong.length).toBeGreaterThan(0)
      }
    }
  })
})
