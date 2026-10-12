import { z } from 'zod'

/*
 * Where an order came from, for the ads: the utm_* tags and Meta's fbclid of
 * the visitor's first arrival (kept 30 days on the device), sent with the
 * order and shown in the admin and the CSV export.
 */

export const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
] as const

export const attributionSchema = z.record(z.string(), z.string()).transform((raw) => {
  const out: Record<string, string> = {}
  for (const key of ATTRIBUTION_KEYS) {
    const v = raw[key]?.trim()
    if (v) out[key] = v.slice(0, 300)
  }
  return Object.keys(out).length ? out : undefined
})

const STORAGE_KEY = 'first-touch'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Records the tags of this visit unless an earlier (still valid) visit already did. */
export function captureAttribution(search: string) {
  try {
    const params = new URLSearchParams(search)
    const found: Record<string, string> = {}
    for (const key of ATTRIBUTION_KEYS) {
      const v = params.get(key)
      if (v) found[key] = v.slice(0, 300)
    }
    if (!Object.keys(found).length) return
    const stored = readStored()
    if (stored) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), tags: found }))
  } catch {}
}

function readStored(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; tags?: Record<string, string> }
    if (!parsed.at || Date.now() - parsed.at > TTL_MS || !parsed.tags) return null
    return parsed.tags
  } catch {
    return null
  }
}

export function currentAttribution(): Record<string, string> | undefined {
  return readStored() ?? undefined
}

/** "facebook · spring-sale · video-a" for the admin. */
export function describeAttribution(a: Record<string, string> | null | undefined) {
  if (!a) return null
  const parts = [a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return a.fbclid ? 'facebook / instagram (fbclid)' : null
}
