import { defineConfig } from 'vitest/config'

// Most domain tests are pure TypeScript and run in the default `node` environment.
// JSX in the few component smoke tests (`*.test.tsx`) is transformed by Vite's esbuild
// using the automatic runtime (tsconfig `jsx: react-jsx`), so no Vite plugin is needed
// here — which also avoids the dual-Vite type clash with `vitest/config`. Those tests
// opt into jsdom per-file via a `// @vitest-environment jsdom` directive so the pure
// node suite is unaffected.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
