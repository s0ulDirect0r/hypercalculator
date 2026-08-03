// Single source of truth for the packaged zip name shared by package.mjs
// (which writes it) and chrome-web-store.mjs (which uploads it). The name
// tracks the manifest version, which is the version the store publishes.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const manifestVersion = () =>
  JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8')).version

export const zipFileName = () => `hypercalculator-v${manifestVersion()}.zip`

// npm runs package scripts from the package root, so the zip always lands
// next to package.json regardless of where the invoking script was launched.
export const zipFilePath = () => fileURLToPath(new URL(`../${zipFileName()}`, import.meta.url))
