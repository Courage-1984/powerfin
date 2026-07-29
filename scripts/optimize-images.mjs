#!/usr/bin/env node
/**
 * Convert and compress site imagery for the web.
 *
 * - Raster (jpg/png): resize by category, rewrite compressed originals, emit .webp
 * - SVG: SVGO in place
 *
 * Usage: npm run optimize:images
 *        npm run optimize:images -- --dry-run
 */

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { optimize as optimizeSvg } from 'svgo'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const imagesRoot = path.join(root, 'public', 'images')
const dryRun = process.argv.includes('--dry-run')

/** @typedef {{ maxWidth?: number, maxHeight?: number, webpQuality: number, jpegQuality?: number, pngCompression?: number, keepOriginalFormat: boolean }} ImageProfile */

/** @type {Record<string, ImageProfile>} */
const profiles = {
  heroes: {
    maxWidth: 1920,
    webpQuality: 78,
    jpegQuality: 80,
    keepOriginalFormat: true,
  },
  team: {
    // Headshots display ~120–150px; keep 800w for retina and emit webp + compressed jpeg/png.
    maxWidth: 800,
    webpQuality: 80,
    jpegQuality: 82,
    pngCompression: 9,
    keepOriginalFormat: true,
  },
  logo: {
    maxWidth: 1200,
    webpQuality: 92,
    pngCompression: 9,
    keepOriginalFormat: true,
  },
  favicon: {
    maxWidth: 192,
    maxHeight: 192,
    webpQuality: 90,
    pngCompression: 9,
    keepOriginalFormat: true,
  },
  default: {
    maxWidth: 1600,
    webpQuality: 80,
    jpegQuality: 82,
    pngCompression: 9,
    keepOriginalFormat: true,
  },
}

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png'])
const SKIP_DIR_NAMES = new Set(['_source', 'optimized', 'node_modules'])

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function profileFor(relPosix) {
  if (relPosix.startsWith('heroes/')) return profiles.heroes
  if (relPosix.startsWith('team/')) return profiles.team
  if (/favicon/i.test(relPosix)) return profiles.favicon
  if (/logo/i.test(relPosix)) return profiles.logo
  return profiles.default
}

async function walk(dir) {
  /** @type {string[]} */
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue
      files.push(...(await walk(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

async function writeIfChanged(filePath, buffer) {
  try {
    const existing = await fs.readFile(filePath)
    const a = createHash('sha1').update(existing).digest('hex')
    const b = createHash('sha1').update(buffer).digest('hex')
    if (a === b) return { wrote: false, bytes: existing.length }
  } catch {
    // missing
  }
  if (!dryRun) {
    const tmpPath = `${filePath}.${process.pid}.tmp`
    await fs.writeFile(tmpPath, buffer)
    await fs.rename(tmpPath, filePath)
  }
  return { wrote: true, bytes: buffer.length }
}

/**
 * @param {string} filePath
 * @param {ImageProfile} profile
 */
async function optimizeRaster(filePath, profile) {
  const ext = path.extname(filePath).toLowerCase()
  const before = (await fs.stat(filePath)).size
  const input = await fs.readFile(filePath)
  const meta = await sharp(input, { failOn: 'none' }).metadata()

  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const needsResize =
    (profile.maxWidth && width > profile.maxWidth) ||
    (profile.maxHeight && height > profile.maxHeight)

  const base = sharp(input, { failOn: 'none' }).rotate()
  const resized = needsResize
    ? base.resize({
        width: profile.maxWidth,
        height: profile.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
    : base

  const webpPath = filePath.replace(/\.(jpe?g|png)$/i, '.webp')
  const webpBuffer = await resized
    .clone()
    .webp({ quality: profile.webpQuality, effort: 6 })
    .toBuffer()

  const webpResult = await writeIfChanged(webpPath, webpBuffer)

  let originalBuffer
  if (ext === '.png') {
    originalBuffer = await resized
      .clone()
      .png({
        compressionLevel: profile.pngCompression ?? 9,
        effort: 10,
        palette: false,
      })
      .toBuffer()
  } else {
    originalBuffer = await resized
      .clone()
      .jpeg({
        quality: profile.jpegQuality ?? 82,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer()
  }

  // Release sharp handles before overwriting on Windows.
  resized.destroy?.()

  let originalResult = { wrote: false, bytes: before }
  if (profile.keepOriginalFormat && (originalBuffer.length < before || needsResize)) {
    // Never replace the on-disk original with a larger encode.
    if (originalBuffer.length < before || (needsResize && originalBuffer.length <= before * 1.05)) {
      originalResult = await writeIfChanged(filePath, originalBuffer)
    } else if (needsResize) {
      // Dimensions needed shrinking but PNG re-encode ballooned — keep prior file bytes,
      // webp still carries the resized derivative.
      originalResult = { wrote: false, bytes: before }
    }
  }

  return {
    type: 'raster',
    before,
    afterOriginal: originalResult.wrote ? originalResult.bytes : before,
    afterWebp: webpResult.bytes,
    webpPath,
    resized: Boolean(needsResize),
    wroteOriginal: originalResult.wrote,
    wroteWebp: webpResult.wrote,
  }
}

async function optimizeSvgFile(filePath) {
  const before = (await fs.stat(filePath)).size
  const input = await fs.readFile(filePath, 'utf8')
  const result = optimizeSvg(input, {
    path: filePath,
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIds: false,
          },
        },
      },
    ],
  })

  const output = result.data
  const buffer = Buffer.from(output, 'utf8')
  if (buffer.length < before) {
    const res = await writeIfChanged(filePath, buffer)
    return { type: 'svg', before, after: res.bytes, wrote: res.wrote }
  }
  return { type: 'svg', before, after: before, wrote: false }
}

async function main() {
  console.log(`Optimizing images in ${path.relative(root, imagesRoot)}${dryRun ? ' (dry run)' : ''}…\n`)

  const files = await walk(imagesRoot)
  let saved = 0
  let processed = 0

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    const rel = path.relative(imagesRoot, filePath).split(path.sep).join('/')

    if (ext === '.webp') continue

    if (ext === '.svg') {
      const result = await optimizeSvgFile(filePath)
      processed += 1
      const delta = result.before - result.after
      saved += Math.max(0, delta)
      console.log(
        `SVG  ${rel.padEnd(42)} ${formatBytes(result.before).padStart(9)} → ${formatBytes(result.after).padStart(9)} ${result.wrote ? '✓' : '='}`,
      )
      continue
    }

    if (!RASTER_EXT.has(ext)) continue

    const profile = profileFor(rel)
    const result = await optimizeRaster(filePath, profile)
    processed += 1
    const deltaOriginal = result.before - result.afterOriginal
    const webpRel = path.relative(imagesRoot, result.webpPath).split(path.sep).join('/')
    saved += Math.max(0, deltaOriginal)
    // Count webp as additional deliverable savings vs original baseline
    saved += Math.max(0, result.before - result.afterWebp)

    console.log(
      `IMG  ${rel.padEnd(42)} ${formatBytes(result.before).padStart(9)} → ${formatBytes(result.afterOriginal).padStart(9)} ${result.wroteOriginal || result.resized ? '✓' : '='}${result.resized ? ' (resized)' : ''}`,
    )
    console.log(
      `     ${webpRel.padEnd(42)} ${''.padStart(9)} → ${formatBytes(result.afterWebp).padStart(9)} webp ${result.wroteWebp ? '✓' : '='}`,
    )
  }

  console.log(`\nProcessed ${processed} assets. Approx. bytes avoided vs source rasters: ${formatBytes(saved)}.`)
  if (dryRun) console.log('Dry run only — no files were written.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
