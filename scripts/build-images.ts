/**
 * Re-encode the source photos in assets/source/ into responsive WebP + AVIF
 * variants in public/images/. Run after replacing a photo: `pnpm images`.
 * Writes src/generated/images.json (name → widths, intrinsic size) and the
 * Open Graph images og-ar.jpg / og-fr.jpg (see build-og.ts).
 */
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { buildOgImages } from './build-og'

const SRC = 'assets/source'
const OUT = 'public/images'
const WIDTHS = [480, 960, 1600, 1920]

type Entry = { widths: number[]; width: number; height: number }

async function main() {
  await mkdir(OUT, { recursive: true })
  const manifest: Record<string, Entry> = {}
  const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp|avif|tiff?)$/i.test(f))

  for (const file of files) {
    const name = path.parse(file).name
    const input = sharp(path.join(SRC, file)).rotate() // honour EXIF orientation
    const meta = await input.metadata()
    const srcWidth = meta.width ?? WIDTHS[0] ?? 480
    const srcHeight = meta.height ?? srcWidth
    // Never upscale: keep widths below the source, plus the source width itself.
    const widths = [...new Set([...WIDTHS.filter((w) => w < srcWidth), Math.min(srcWidth, 1920)])]

    for (const w of widths) {
      const resized = input.clone().resize({ width: w, withoutEnlargement: true })
      await resized
        .clone()
        .webp({ quality: 78, effort: 5 })
        .toFile(path.join(OUT, `${name}-${w}.webp`))
      await resized
        .clone()
        .avif({ quality: 55, effort: 5 })
        .toFile(path.join(OUT, `${name}-${w}.avif`))
    }
    manifest[name] = { widths, width: srcWidth, height: srcHeight }
    console.log(`${file}: ${srcWidth}×${srcHeight} → ${widths.join(', ')}`)
  }

  await writeFile('src/generated/images.json', `${JSON.stringify(manifest, null, 2)}\n`)
  await buildOgImages(path.join(SRC, 'olives-harvest.jpg'), OUT)
  await publishVideos()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

/*
 * Videos: drop <name>.mp4 (H.264) and/or <name>.webm into assets/source/.
 * They are copied as-is to public/videos/ (encode them short, muted and
 * around 2–4 MB before adding them) and listed in src/generated/videos.json.
 * `hero` is picked up by the hero arch; nothing else changes on the page.
 */
async function publishVideos() {
  const outDir = 'public/videos'
  await mkdir(outDir, { recursive: true })
  const videos: Record<string, Array<{ src: string; type: string }>> = {}
  for (const file of await readdir(SRC)) {
    const match = /^(.+)\.(webm|mp4)$/i.exec(file)
    if (!match?.[1] || !match[2]) continue
    const ext = match[2].toLowerCase()
    const size = (await stat(path.join(SRC, file))).size
    if (size > 8 * 1024 * 1024)
      console.warn(`${file}: ${(size / 1e6).toFixed(1)} MB, consider re-encoding`)
    await copyFile(path.join(SRC, file), path.join(outDir, file))
    videos[match[1]] ??= []
    // webm first: smaller where supported, mp4 as the universal fallback.
    videos[match[1]]?.push({ src: `/videos/${file}`, type: `video/${ext}` })
    videos[match[1]]?.sort(
      (a, b) => Number(b.type === 'video/webm') - Number(a.type === 'video/webm'),
    )
  }
  await writeFile('src/generated/videos.json', JSON.stringify(videos, null, 2).concat('\n'))
  console.log(`videos: ${Object.keys(videos).join(', ') || 'none (add assets/source/hero.mp4)'}`)
}
