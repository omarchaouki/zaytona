/**
 * Generates the Open Graph share images public/images/og-ar.jpg and og-fr.jpg
 * (1200×630): the hero photo in the bab arch, the hero headline in the page's
 * own fonts. Run by `pnpm images`; re-run after changing the hero copy or photo.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { decompress } from 'wawoff2'
import ar from '../src/i18n/ar.json' with { type: 'json' }
import fr from '../src/i18n/fr.json' with { type: 'json' }

const W = 1200
const H = 630
const COLORS = {
  limewash: '#f6f2e7',
  olive: '#2e3b1f',
  leaf: '#5c6b34',
  oil: '#d9a21b',
  inkSoft: '#55564c',
}

const FONTS = {
  cairo: 'node_modules/@fontsource/cairo/files/cairo-arabic-700-normal.woff2',
  plex: 'node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2',
  fraunces: 'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2',
  inter: 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
}

const escapeMarkup = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function text(opts: {
  text: string
  color: string
  font: string
  fontfile: string
  width: number
  align: 'left' | 'right'
}) {
  return sharp({
    text: {
      text: `<span foreground="${opts.color}">${escapeMarkup(opts.text)}</span>`,
      font: opts.font,
      fontfile: opts.fontfile,
      rgba: true,
      width: opts.width,
      wrap: 'word',
      align: opts.align,
      spacing: 6,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })
}

async function archPhoto(source: string, width: number) {
  const height = Math.round((width * 161.8) / 100)
  const s = width / 100
  // Same geometry as <ArchWindow>: photo r=46, trace r=48.5 (100×140 box).
  const clip = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path transform="scale(${s})" d="M10.16 161.8 V73 A46 46 0 1 1 89.84 73 V161.8 Z" fill="#fff"/></svg>`
  const trace = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path transform="scale(${s})" d="M8 161.8 V74.25 A48.5 48.5 0 1 1 92 74.25 V161.8" fill="none" stroke="${COLORS.oil}" stroke-width="${2.2 / s}"/></svg>`
  return sharp(source)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .composite([{ input: Buffer.from(clip), blend: 'dest-in' }, { input: Buffer.from(trace) }])
    .png()
    .toBuffer()
}

export async function buildOgImages(photo: string, outDir: string) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'og-fonts-'))
  try {
    const files: Record<keyof typeof FONTS, string> = {
      cairo: '',
      plex: '',
      fraunces: '',
      inter: '',
    }
    for (const [key, woff2] of Object.entries(FONTS) as Array<[keyof typeof FONTS, string]>) {
      const ttf = path.join(tmp, `${key}.ttf`)
      await writeFile(ttf, Buffer.from(await decompress(await readFile(woff2))))
      files[key] = ttf
    }

    const archW = 340
    const arch = await archPhoto(photo, archW)
    const archH = Math.round((archW * 161.8) / 100)
    const margin = 72
    const textW = W - archW - margin * 3

    for (const locale of ['ar', 'fr'] as const) {
      const m = locale === 'ar' ? ar : fr
      const rtl = locale === 'ar'
      const align = rtl ? 'right' : 'left'
      const display = rtl
        ? { font: 'Cairo Bold 46', fontfile: files.cairo }
        : { font: 'Fraunces 52', fontfile: files.fraunces }
      const body = rtl
        ? { font: 'IBM Plex Sans Arabic Medium 24', fontfile: files.plex }
        : { font: 'Inter 24', fontfile: files.inter }

      const eyebrow = await text({
        text: m.hero.eyebrow,
        color: COLORS.leaf,
        ...body,
        width: textW,
        align,
      })
      const title = await text({
        text: m.hero.title.split('*').join(''), // drop the *emphasis* markers
        color: COLORS.olive,
        ...display,
        width: textW,
        align,
      })
      const footer = await text({
        text: `${m.trust.natural} · ${m.trust.delivery}`,
        color: COLORS.inkSoft,
        ...body,
        width: textW,
        align,
      })

      const archX = rtl ? margin : W - margin - archW
      const textX = rtl ? archX + archW + margin : margin
      const alignX = (w: number) => (rtl ? textX + textW - w : textX)
      const titleY = Math.round((H - title.info.height) / 2) - 10

      await sharp({ create: { width: W, height: H, channels: 3, background: COLORS.limewash } })
        .composite([
          { input: arch, left: archX, top: H - archH },
          {
            input: eyebrow.data,
            left: alignX(eyebrow.info.width),
            top: titleY - eyebrow.info.height - 22,
          },
          { input: title.data, left: alignX(title.info.width), top: titleY },
          {
            input: footer.data,
            left: alignX(footer.info.width),
            top: titleY + title.info.height + 30,
          },
          {
            // amber rule under the headline
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="4"><rect width="96" height="4" rx="2" fill="${COLORS.oil}"/></svg>`,
            ),
            left: rtl ? textX + textW - 96 : textX,
            top: titleY + title.info.height + 12,
          },
        ])
        .jpeg({ quality: 86, mozjpeg: true })
        .toFile(path.join(outDir, `og-${locale}.jpg`))
      console.log(`og-${locale}.jpg`)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}
