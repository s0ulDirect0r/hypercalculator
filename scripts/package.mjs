// Builds the extension and packs dist/ into a Chrome Web Store-ready zip.
// The store expects manifest.json at the archive root, so this zips the
// *contents* of dist/ rather than the dist/ folder itself. The zip name
// tracks the manifest version, which is the version the store publishes.
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'

import { zipFileName } from './zip-name.mjs'

const zipName = zipFileName()

execSync('npm run build', { stdio: 'inherit' })

// Re-create the archive from scratch so a stale zip never ships stale files.
rmSync(zipName, { force: true })
execSync(`zip -r -X "../${zipName}" . -x ".*"`, { cwd: 'dist', stdio: 'inherit' })

console.log(`\nPacked ${zipName} — upload this to the Chrome Web Store.`)
