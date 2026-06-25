/**
 * Prebuild step: copy the PURE / ISOMORPHIC genui core from the root app into the
 * functions package so the Cloud Functions runtime imports the SAME validators the
 * Vite client uses (no schema drift). Runs automatically on `prebuild` and `pretest`.
 *
 * Why a copy step (not tsconfig project references): `functions/` is a separate,
 * independently-deployable package with its own `rootDir`/`outDir`. Compiling source
 * files that live outside its rootDir produces a nested, deploy-hostile output layout.
 * Copying the closed pure-source set into `src/shared/**` keeps the emitted tree clean
 * (`lib/shared/...`), the import paths stable, and the build fully self-contained.
 *
 * The copied set is CLOSED: `practice/types.ts` + the top-level `practice/genui/*.ts`
 * core modules only import one another (and type-only siblings). None import React,
 * the DOM, Phaser, firebase, or the `widgets/` subtree, so the copy never drags UI in.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoSrc = resolve(here, '..', '..', 'src', 'practice')
const destRoot = resolve(here, '..', 'src', 'shared', 'practice')

const BANNER =
  '// AUTO-GENERATED — DO NOT EDIT. Copied from src/practice by functions/scripts/copy-shared.mjs.\n' +
  '// Edit the source under the root app; this mirror is regenerated on prebuild/pretest.\n\n'

/** Copy one .ts file verbatim with a generated banner prepended. */
function copyFile(srcFile, destFile) {
  mkdirSync(dirname(destFile), { recursive: true })
  writeFileSync(destFile, BANNER + readFileSync(srcFile, 'utf8'))
}

function copyTopLevelTs(srcDir, destDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.endsWith('.test.ts')) continue
    copyFile(join(srcDir, entry.name), join(destDir, entry.name))
  }
}

// Start clean so removed source files never linger in the mirror.
if (existsSync(destRoot)) rmSync(destRoot, { recursive: true, force: true })
mkdirSync(destRoot, { recursive: true })

// 1) practice/types.ts (the shared type root the genui core references via `../types`).
copyFile(join(repoSrc, 'types.ts'), join(destRoot, 'types.ts'))

// 2) the top-level genui core (schema/registry/types/decision/defaultLayout/copyLint).
copyTopLevelTs(join(repoSrc, 'genui'), join(destRoot, 'genui'))

console.log(`[copy-shared] mirrored isomorphic genui core → ${destRoot}`)
