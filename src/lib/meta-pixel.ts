/*
 * Meta (Facebook / Instagram) Pixel, loaded only when the owner enabled it in
 * Admin → Settings → Marketing (and, if asked, after the visitor accepted).
 * Events: PageView on each page, Lead once per order (eventID = the order
 * reference, so a reload of the confirmation page never counts twice).
 * Calls made before the pixel is loaded are queued and sent once it is.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  loaded?: boolean
  version?: string
  push?: unknown
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

const CONSENT_KEY = 'meta-pixel-consent'
const LEAD_KEY = 'meta-lead:'
let loadedId: string | null = null
const pending: unknown[][] = []

export type Consent = 'granted' | 'denied' | null

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export function saveConsent(value: 'granted' | 'denied') {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {}
}

/** Installs Meta's standard snippet (fbevents.js, async) and sends the first PageView. */
export function loadPixel(id: string) {
  if (typeof window === 'undefined' || loadedId === id) return
  loadedId = id
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    }) as Fbq
    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.push = fbq
    window.fbq = fbq
    window._fbq = fbq
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.append(script)
  }
  window.fbq('init', id)
  window.fbq('track', 'PageView')
  for (const call of pending.splice(0)) window.fbq(...call)
}

export function pixelLoaded() {
  return loadedId !== null
}

/** A standard event; queued until the pixel is loaded (dropped if it never is). */
export function pixelTrack(event: string, params?: Record<string, unknown>, eventID?: string) {
  if (typeof window === 'undefined') return
  const call = ['track', event, params ?? {}, ...(eventID ? [{ eventID }] : [])]
  if (window.fbq && loadedId) window.fbq(...call)
  else pending.push(call)
}

/** Lead for a placed order, at most once per order reference on this device. */
export function trackLead(order: {
  reference: string
  total: string | number
  items: Array<{ name: string; quantity: number }>
}) {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(LEAD_KEY + order.reference)) return
    localStorage.setItem(LEAD_KEY + order.reference, '1')
  } catch {}
  pixelTrack(
    'Lead',
    {
      value: Number(order.total),
      currency: 'MAD',
      content_name: order.items.map((i) => `${i.quantity} × ${i.name}`).join(', '),
    },
    order.reference,
  )
}
