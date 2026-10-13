/**
 * Responsive audit (needs `pnpm dev`): for phone and tablet sizes, lists
 * elements that stick out of the screen, content spilling out of its own box,
 * text below 12px and tap targets below 44px, grouped by page section.
 *
 *   pnpm audit:mobile
 *     every public page, in Arabic and French
 *   AUDIT_ADMIN_EMAIL=… AUDIT_ADMIN_PASSWORD=… pnpm audit:mobile
 *     also every admin page (dashboard, orders, an order, offers, reviews,
 *     certificates, settings, password) in Arabic and in French, signed in
 *     with that account (its language is put back afterwards)
 */
import { type Browser, chromium, type Page } from '@playwright/test'

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:3000'
const SIZES = [
  [320, 640],
  [360, 740],
  [390, 844],
  [412, 915],
  [740, 360], // phone in landscape
  [768, 1024], // tablet portrait
  [1024, 768], // tablet landscape
] as const
const PAGES = ['', '/privacy', '/terms']
const ADMIN_PAGES = [
  '/admin',
  '/admin/orders',
  'ORDER',
  '/admin/offers',
  '/admin/reviews',
  '/admin/trust',
  '/admin/settings',
  '/admin/password',
]

type Finding = { kind: string; section: string; what: string }

/** Runs in the page. Self-contained: no outer variables. */
function inspect(): Finding[] {
  const vw = document.documentElement.clientWidth
  const out: Finding[] = []
  const sectionOf = (el: Element) => {
    const s = el.closest('section, header, footer, nav, main')
    return (
      s?.getAttribute('aria-labelledby') ??
      s?.getAttribute('aria-label') ??
      s?.tagName.toLowerCase() ??
      'body'
    )
  }
  const label = (el: Element) =>
    `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('name') ? `[name=${el.getAttribute('name')}]` : ''}.${String(el.className).split(' ').slice(0, 3).join('.')} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 40)}"`
  // Inside intended horizontal scrollers, sticking out is the point.
  // Content cut off by an overflow-hidden box is still a bug, unless it is
  // decoration (absolutely positioned or hidden from readers).
  const inScroller = (el: Element) => {
    if (el.closest('.marquee')) return true
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'hidden' || ox === 'clip') {
        return (
          getComputedStyle(el).position === 'absolute' ||
          Boolean(el.closest('.absolute, [aria-hidden="true"]'))
        )
      }
    }
    return false
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (!r.width || cs.visibility === 'hidden' || cs.display === 'none') continue
    if (el.closest('[aria-hidden="true"]') && !el.matches('a,button')) continue
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && cs.position !== 'fixed') {
      out.push({
        kind: 'overflow',
        section: sectionOf(el),
        what: `${label(el)} ${Math.round(r.left)}→${Math.round(r.right)} (vw ${vw})`,
      })
    }
    // Content spilling out of its own box (e.g. a nowrap button label wider than the button).
    // Badges placed on purpose over a corner (absolutely positioned children) don't count.
    const sticksOut = (c: Element) => {
      const cr = c.getBoundingClientRect()
      return cr.right > r.right + 2 || cr.left < r.left - 2
    }
    const kids = [...el.children]
    const onlyBadge =
      kids.some((c) => getComputedStyle(c).position === 'absolute' && sticksOut(c)) &&
      !kids.some((c) => getComputedStyle(c).position !== 'absolute' && sticksOut(c))
    if (
      !el.closest('svg') &&
      !onlyBadge &&
      cs.display !== 'inline' &&
      cs.overflowX === 'visible' &&
      el.scrollWidth > el.clientWidth + 2 &&
      el.clientWidth > 0 &&
      !inScroller(el)
    ) {
      out.push({
        kind: 'spills',
        section: sectionOf(el),
        what: `${label(el)} content ${el.scrollWidth}px in ${el.clientWidth}px`,
      })
    }
    // Text fields squeezed too narrow to type in (e.g. a search box crushed by a row of tabs).
    if (
      el.matches(
        'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea, select',
      ) &&
      r.width < 120 &&
      !el.closest('[class*="w-11"], [class*="w-9"]')
    ) {
      out.push({
        kind: 'cramped-field',
        section: sectionOf(el),
        what: `${label(el)} ${Math.round(r.width)}px wide`,
      })
    }
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())
    // SVG text scales with its drawing; its font-size is in drawing units.
    if (text && !el.closest('svg') && Number.parseFloat(cs.fontSize) < 12) {
      out.push({ kind: 'tiny-text', section: sectionOf(el), what: `${label(el)} ${cs.fontSize}` })
    }
    if (el.matches('a[href],button,input:not([type=hidden]),select,textarea,[role=tab],summary')) {
      const inline = el.matches('p a, li > a:only-child') && cs.display === 'inline'
      // A radio or checkbox inside a big label: the label is the tap target.
      const box = el.closest('label')?.getBoundingClientRect()
      const inBigLabel = Boolean(box && box.height >= 43.5 && box.width >= 43.5)
      if (
        !inline &&
        !inBigLabel &&
        !el.classList.contains('sr-only') &&
        (r.height < 43.5 || r.width < 43.5) &&
        r.height > 2
      ) {
        out.push({
          kind: 'small-target',
          section: sectionOf(el),
          what: `${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`,
        })
      }
    }
  }
  return out
}

async function newPage(browser: Browser, width: number, height: number) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: width < 1024,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  // tsx wraps named functions in __name(); give the page a no-op one.
  await page.addInitScript('globalThis.__name = (f) => f')
  return page
}

async function report(page: Page, tag: string, alwaysPrint: boolean) {
  const findings = await page.evaluate(inspect)
  const unique = [...new Map(findings.map((f) => [f.kind + f.what, f])).values()]
  if (unique.length || alwaysPrint) console.log(`\n=== ${tag}: ${unique.length} finding(s)`)
  for (const f of unique.slice(0, 40)) console.log(`  [${f.kind}] ${f.section} :: ${f.what}`)
  return unique.length
}

const hydrated = (page: Page) =>
  page.waitForFunction(() => (window as { __hydrated?: boolean }).__hydrated === true, null, {
    timeout: 90_000,
  })

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'load' })
  await hydrated(page)
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.locator('form button[type=submit]').click()
  await page.waitForURL(/\/admin\/?$/, { timeout: 30_000, waitUntil: 'commit' })
  // A fresh load, so the page (and its lang) is the admin's, not the login page's.
  await page.goto(`${BASE}/admin`, { waitUntil: 'load' })
  await hydrated(page)
}

/** The admin language is saved on the account: switch it with the sidebar button. */
async function setAdminLocale(browser: Browser, email: string, password: string, locale: string) {
  const page = await newPage(browser, 1280, 800)
  await signIn(page, email, password)
  const before = await page.evaluate(() => document.documentElement.lang.slice(0, 2))
  if (before !== locale) {
    await page
      .getByRole('button', { name: /^(Français|العربية)$/ })
      .first()
      .click()
    // The choice is saved on the server; a reload shows whether it took.
    await page.waitForTimeout(1500)
    await page.reload({ waitUntil: 'load' })
    await hydrated(page)
    const after = await page.evaluate(() => document.documentElement.lang.slice(0, 2))
    if (after !== locale) throw new Error(`admin language still ${after}, wanted ${locale}`)
  }
  await page.close()
  return before
}

async function main() {
  const browser = await chromium.launch()
  let total = 0

  for (const locale of ['ar', 'fr']) {
    for (const [width, height] of SIZES) {
      const page = await newPage(browser, width, height)
      for (const path of PAGES) {
        await page.goto(`${BASE}/${locale}${path}`, { waitUntil: 'networkidle' })
        total += await report(page, `/${locale}${path} ${width}×${height}`, !path)
      }
      await page.close()
    }
  }

  const email = process.env.AUDIT_ADMIN_EMAIL
  const password = process.env.AUDIT_ADMIN_PASSWORD
  if (email && password) {
    let original: string | null = null
    for (const adminLocale of ['ar', 'fr']) {
      const previous = await setAdminLocale(browser, email, password, adminLocale)
      original ??= previous
      for (const [width, height] of SIZES) {
        const page = await newPage(browser, width, height)
        await signIn(page, email, password)
        for (const path of ADMIN_PAGES) {
          let url = path
          if (path === 'ORDER') {
            const href = await page
              .locator('a[href^="/admin/orders/"]')
              .first()
              .getAttribute('href')
              .catch(() => null)
            if (!href) continue
            url = href
          }
          await page.goto(`${BASE}${url}`, { waitUntil: 'load' })
          await hydrated(page)
          await page.waitForTimeout(1200)
          const tag = `${url.replace(/[0-9a-f-]{36}/, ':id')} (${adminLocale}) ${width}×${height}`
          total += await report(page, tag, url === '/admin')
        }
        await page.close()
      }
    }
    if (original) await setAdminLocale(browser, email, password, original)
  } else {
    console.log('\n(admin pages skipped: set AUDIT_ADMIN_EMAIL and AUDIT_ADMIN_PASSWORD)')
  }

  await browser.close()
  console.log(`\nTotal: ${total}`)
  if (total > 0) process.exitCode = 1
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
