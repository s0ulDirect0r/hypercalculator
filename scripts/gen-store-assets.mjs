import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const pathFromUrl = (value) => fileURLToPath(new URL(value, import.meta.url))

const graph2d = pathFromUrl('../store-assets/01-graph-2d.png')
const graph3d = pathFromUrl('../store-assets/02-graph-3d.png')
const overlay = pathFromUrl('../store-assets/03-overlay-on-page.png')

const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const svgText = ({ height, lines, width }) => `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    ${lines
      .map(
        ({ color = '#effdff', family = 'Georgia, serif', size, text, weight = 700, x, y }) => `
          <text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${size}" font-style="italic" font-weight="${weight}" filter="url(#glow)">
            ${escapeXml(text)}
          </text>
        `,
      )
      .join('')}
  </svg>
`

const roundedImage = async ({ height, input, radius, width }) => {
  const image = await sharp(input).resize(width, height, { fit: 'cover' }).png().toBuffer()
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/>
    </svg>
  `)

  return sharp(image).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

const makeSmallPromo = async () => {
  const width = 440
  const height = 280
  const screenshot = await roundedImage({
    height: 206,
    input: graph2d,
    radius: 18,
    width: 330,
  })
  const text = Buffer.from(
    svgText({
      width,
      height,
      lines: [
        { color: '#c4f6ff', size: 40, text: 'Hypercalculator', x: 26, y: 66 },
        {
          color: '#f4f8ff',
          family: 'Inter, Arial, sans-serif',
          size: 16,
          text: 'math as an object you can inspect',
          weight: 600,
          x: 30,
          y: 96,
        },
      ],
    }),
  )

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#050607',
    },
  })
    .composite([
      {
        input: Buffer.from(`
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${width}" height="${height}" fill="#050607"/>
            <path d="M0 225 C118 168 213 316 440 172 L440 280 L0 280 Z" fill="#0b2b36" opacity="0.72"/>
            <circle cx="358" cy="64" r="134" fill="#1f6fc8" opacity="0.34"/>
            <circle cx="322" cy="104" r="86" fill="#6ee7ff" opacity="0.15"/>
            <path d="M28 228 L390 36" stroke="#6ee7ff" stroke-width="1" opacity="0.2"/>
          </svg>
        `),
      },
      { input: screenshot, left: 86, top: 72 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(pathFromUrl('../store-assets/small-promo-tile.png'))
}

const makeMarqueePromo = async () => {
  const width = 1400
  const height = 560
  const left = await roundedImage({ height: 330, input: graph2d, radius: 24, width: 528 })
  const middle = await roundedImage({ height: 330, input: graph3d, radius: 24, width: 528 })
  const right = await roundedImage({ height: 330, input: overlay, radius: 24, width: 528 })
  const text = Buffer.from(
    svgText({
      width,
      height,
      lines: [
        { color: '#c4f6ff', size: 76, text: 'Hypercalculator', x: 64, y: 106 },
        {
          color: '#f4f8ff',
          family: 'Inter, Arial, sans-serif',
          size: 28,
          text: 'A visual calculator for graphs, geometry, vectors, complex numbers, and 3D objects.',
          weight: 650,
          x: 70,
          y: 152,
        },
      ],
    }),
  )

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#050607',
    },
  })
    .composite([
      {
        input: Buffer.from(`
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${width}" height="${height}" fill="#050607"/>
            <path d="M0 458 C208 330 390 632 664 420 C884 250 1058 312 1400 174 L1400 560 L0 560 Z" fill="#0b2b36" opacity="0.7"/>
            <circle cx="1128" cy="112" r="296" fill="#1f6fc8" opacity="0.26"/>
            <circle cx="1034" cy="204" r="178" fill="#6ee7ff" opacity="0.11"/>
            <path d="M62 454 L1260 72" stroke="#6ee7ff" stroke-width="1.5" opacity="0.18"/>
            <path d="M260 532 L1324 236" stroke="#ffcf87" stroke-width="1.2" opacity="0.16"/>
          </svg>
        `),
      },
      { input: left, left: 64, top: 190 },
      { input: middle, left: 436, top: 190 },
      { input: right, left: 808, top: 190 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(pathFromUrl('../store-assets/marquee-promo-tile.png'))
}

await makeSmallPromo()
await makeMarqueePromo()

console.log('Generated store-assets/small-promo-tile.png and store-assets/marquee-promo-tile.png')
