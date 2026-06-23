/**
 * Tiny typed event channel between a React module renderer and its Phaser scene.
 * One bus instance per mounted module (created by the renderer, passed into the
 * scene via init data). Both sides share it and ignore event types they don't care
 * about. No external deps so it is trivially testable.
 *
 * Direction convention:
 *   React -> scene:  'reveal' (resolve a quiz), 'reset', 'set' (a control value)
 *   scene -> React:  'ready' (intro animation done), 'readout' (live values)
 */
export type SceneEvent =
  | { type: 'reveal' }
  | { type: 'reset' }
  | { type: 'set'; key: string; value: number | string | boolean }
  | { type: 'ready' }
  | { type: 'readout'; key: string; value: number | string | boolean }
  // --- interactive challenge flow ---
  // React -> scene: run/grade the challenge the learner has set up.
  | { type: 'submit' }
  // scene -> React: enable/disable the Submit button as the setup becomes valid.
  | { type: 'canSubmit'; value: boolean }
  // scene -> React: the graded outcome (shown as a banner + explanation).
  | { type: 'result'; correct: boolean; title: string; detail: string }

type Handler = (e: SceneEvent) => void

export class SceneBus {
  private handlers = new Set<Handler>()

  emit(e: SceneEvent): void {
    // Copy so a handler that unsubscribes mid-dispatch can't mutate the live set.
    for (const h of [...this.handlers]) h(e)
  }

  on(h: Handler): () => void {
    this.handlers.add(h)
    return () => {
      this.handlers.delete(h)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}
