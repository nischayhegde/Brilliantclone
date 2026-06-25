import { defineConfig } from 'vitest/config'

// Functions unit tests run in plain node with the `openai` SDK + any firebase deps
// mocked — no network, no real model, no emulator. `pretest` copies the isomorphic
// genui core into src/shared first so the cross-package import test can resolve.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
