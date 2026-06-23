import type Phaser from 'phaser'

/** Module kinds across all lessons. */
export type ModuleType = 'intro' | 'teach' | 'interactive' | 'quiz' | 'challenge' | 'capstone'

/** A scene class constructable by Phaser (PhaserCanvas adds it with init data). */
export type SceneCtor = new (config?: Phaser.Types.Scenes.SettingsConfig) => Phaser.Scene

/** Which scene to mount + its params. `kind` keys into the scene registry. */
export interface SceneSpec {
  kind: string
  params?: Record<string, unknown>
}

export interface QuizOption {
  id: string
  label: string
}

/**
 * A check-for-understanding. Renderer shows options; on submit it emits `reveal` on
 * the bus (so the scene can animate the resolution), then grades vs `correctId` and
 * shows the matching explanation.
 */
export interface QuizSpec {
  prompt: string
  options: QuizOption[] // 2..4
  correctId: string
  /** Shown when the learner is right. */
  explainRight: string
  /** Shown when the learner is wrong (teach the tempting mistake). */
  explainWrong: string
}

/**
 * An interactive challenge (type 'challenge'). The learner manipulates the scene
 * (places a stop, builds a position, fills an order, …) and presses Submit; the SCENE
 * runs the simulation/reveal and reports a graded {correct, title, detail} via the bus
 * (`this.report(...)`). The renderer shows Submit, then the result banner + detail.
 */
export interface ChallengeSpec {
  /** The task, e.g. "If you'd take this trade, set your take-profit and stop." */
  prompt: string
  /** Optional one-line how-to under the prompt. */
  instructions?: string
  /** Submit-button label (default "Submit"). */
  submitLabel?: string
}

/** One module. `scene` drives the Phaser body. */
export interface ModuleSpec {
  id: number
  type: ModuleType
  /** Small uppercase eyebrow, e.g. a ticker or "Order book". */
  kicker?: string
  title: string
  /** Short framing paragraph shown above the canvas. */
  intro?: string
  scene: SceneSpec
  /** Teaching caption shown under the canvas. */
  caption?: string
  /** For 'quiz' (and an optional embedded check inside 'capstone'). */
  quiz?: QuizSpec
  /** For 'challenge' — the scene grades itself and reports via the bus. */
  challenge?: ChallengeSpec
  /** Advance-button label override (defaults per type). */
  cta?: string
}

export interface LessonSpec {
  /** URL slug, e.g. 'reading-charts'. */
  id: string
  /** 1..5, display order. */
  index: number
  title: string
  subtitle: string
  /** "Level N" shown on the card. */
  level: number
  blurb: string
  modules: ModuleSpec[]
}

/** A lesson package: its metadata/modules plus the scenes its modules reference. */
export interface LessonPackage {
  lesson: LessonSpec
  /** kind -> scene class for every `scene.kind` used by this lesson's modules. */
  scenes: Record<string, SceneCtor>
}
