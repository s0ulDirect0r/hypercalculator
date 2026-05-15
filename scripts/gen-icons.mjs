// Rasterizes public/favicon.svg into the PNG icon sizes Chrome needs.
// Run via `npm run gen-icons`.
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'public/favicon.svg')
const outDir = resolve(root, 'public/icons')
const sizes = [16, 32, 48, 128]

await mkdir(outDir, { recursive: true })

for (const size of sizes) {
  await sharp(source, { density: 512 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(resolve(outDir, `icon${size}.png`))
  console.log(`wrote public/icons/icon${size}.png`)
}
