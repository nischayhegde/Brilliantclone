import { defineConfig } from 'vitest/config'

// Domain tests are pure TypeScript (no JSX), so no Vite plugins are needed here.
// Vitest prefers this file over vite.config.ts, avoiding a dual-Vite type clash.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
