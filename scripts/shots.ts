/**
 * Design review helper: full-page screenshots of the landing page at phone and
 * desktop widths, both languages. Needs the dev server (pnpm dev).
 *   pnpm shots [outDir]      → <outDir>/<locale>-<width>.png
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? 'test-results/shots'
const WIDTHS = [360, 390, 768, 1440]

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  for (const locale of ['ar', 'fr']) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({
        viewport: { width, height: width < 768 ? 800 : 900 },
        deviceScaleFactor: width < 768 ? 2 : 1,
        isMobile: width < 768,
        hasTouch: width < 768,
        reducedMotion: 'reduce', // stable frames: no Ken Burns mid-zoom, reveals shown
      })
      await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle' })
      // Load every lazy image before the full-page capture.
      await page.evaluate(async () => {
        for (const img of document.querySelectorAll('img')) img.loading = 'eager'
        await Promise.all(
          [...document.images].map((img) =>
            img.complete
              ? null
              : new Promise((r) => img.addEventListener('load', r, { once: true })),
          ),
        )
      })
      const file = path.join(OUT, `${locale}-${width}.png`)
      await page.screenshot({ path: file, fullPage: true })
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      console.log(`${file}  height=${height}${overflow ? '  HORIZONTAL OVERFLOW' : ''}`)
      await page.close()
    }
  }
  await browser.close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
