#!/usr/bin/env node
/**
 * Generate favicon / PWA icon set.
 * Favicons keep transparency; apple-touch + maskable use solid backs (platform rules).
 * Usage: node scripts/generate-icons.mjs
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const faviconSource = path.join(root, 'public', 'images', 'powerfin_favicon.png')
const squareSource = path.join(root, 'public', 'images', 'powerfin_square_logo.png')
const outDir = path.join(root, 'public', 'images', 'icons')

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }
const BRAND = { r: 20, g: 78, b: 150, alpha: 1 }

/** Pack PNG buffers into a multi-size .ico (PNG-compressed ICO, Vista+) */
function pngsToIco(images) {
  const count = images.length
  const headerSize = 6 + count * 16
  let offset = headerSize
  const entries = images.map(({ width, height, buffer }) => {
    const entry = { width, height, size: buffer.length, offset, buffer }
    offset += buffer.length
    return entry
  })

  const out = Buffer.alloc(offset)
  out.writeUInt16LE(0, 0)
  out.writeUInt16LE(1, 2)
  out.writeUInt16LE(count, 4)

  let entryAt = 6
  for (const entry of entries) {
    out.writeUInt8(entry.width >= 256 ? 0 : entry.width, entryAt)
    out.writeUInt8(entry.height >= 256 ? 0 : entry.height, entryAt + 1)
    out.writeUInt8(0, entryAt + 2)
    out.writeUInt8(0, entryAt + 3)
    out.writeUInt16LE(1, entryAt + 4)
    out.writeUInt16LE(32, entryAt + 6)
    out.writeUInt32LE(entry.size, entryAt + 8)
    out.writeUInt32LE(entry.offset, entryAt + 12)
    entry.buffer.copy(out, entry.offset)
    entryAt += 16
  }
  return out
}

async function makePng(source, size, filename, { flatten = false, flattenColor = '#ffffff' } = {}) {
  let pipeline = sharp(source)
    .ensureAlpha()
    .resize(size, size, {
      fit: 'contain',
      background: flatten ? WHITE : TRANSPARENT,
    })

  if (flatten) {
    pipeline = pipeline.flatten({ background: flattenColor })
  }

  const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer()
  await fs.writeFile(path.join(outDir, filename), buffer)
  return buffer
}

await fs.mkdir(outDir, { recursive: true })

const transparentSizes = [
  { source: faviconSource, size: 16, file: 'favicon-16x16.png' },
  { source: faviconSource, size: 32, file: 'favicon-32x32.png' },
  { source: faviconSource, size: 48, file: 'favicon-48x48.png' },
  { source: squareSource, size: 192, file: 'android-chrome-192x192.png' },
  { source: squareSource, size: 512, file: 'android-chrome-512x512.png' },
]

const icoParts = []
for (const { source, size, file } of transparentSizes) {
  const buf = await makePng(source, size, file, { flatten: false })
  const meta = await sharp(buf).metadata()
  console.log('wrote', file, buf.length, 'alpha:', meta.hasAlpha)
  if ([16, 32, 48].includes(size)) {
    icoParts.push({ width: size, height: size, buffer: buf })
  }
}

// iOS apple-touch prefers an opaque background
const apple = await makePng(squareSource, 180, 'apple-touch-icon.png', {
  flatten: true,
  flattenColor: '#ffffff',
})
console.log('wrote apple-touch-icon.png', apple.length, '(opaque)')

const ico = pngsToIco(icoParts)
await fs.writeFile(path.join(root, 'public', 'favicon.ico'), ico)
console.log('wrote favicon.ico', ico.length)

// Maskable-friendly padded 512 (solid brand safe zone)
const maskable = await sharp(squareSource)
  .ensureAlpha()
  .resize(410, 410, { fit: 'contain', background: BRAND })
  .extend({
    top: 51,
    bottom: 51,
    left: 51,
    right: 51,
    background: BRAND,
  })
  .flatten({ background: '#144E96' })
  .png({ compressionLevel: 9 })
  .toBuffer()
await fs.writeFile(path.join(outDir, 'maskable-512x512.png'), maskable)
console.log('wrote maskable-512x512.png', maskable.length)
