/*
 * The order form survives a refresh: what the visitor typed (and the step)
 * is kept on the device for 7 days and put back when the page loads again.
 * Cleared as soon as the order is sent. Never the anti-bot fields.
 */

const KEY = 'order-draft'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export const DRAFT_FIELDS = [
  'choice',
  'customLiters',
  'name',
  'phone',
  'city',
  'address',
  'note',
] as const
export type DraftField = (typeof DRAFT_FIELDS)[number]
export type Draft = { values: Partial<Record<DraftField, string>>; step: number }

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      at?: number
      values?: Record<string, unknown>
      step?: number
    }
    if (!parsed.at || Date.now() - parsed.at > TTL_MS || !parsed.values) {
      localStorage.removeItem(KEY)
      return null
    }
    const values: Draft['values'] = {}
    for (const f of DRAFT_FIELDS) {
      const v = parsed.values[f]
      if (typeof v === 'string' && v.length <= 600) values[f] = v
    }
    const step = Number.isInteger(parsed.step) ? Math.min(Math.max(parsed.step ?? 0, 0), 2) : 0
    return { values, step }
  } catch {
    return null
  }
}

export function saveDraft(values: Partial<Record<DraftField, string>>, step: number) {
  try {
    const kept: Draft['values'] = {}
    let any = false
    for (const f of DRAFT_FIELDS) {
      const v = values[f]
      if (typeof v === 'string' && v) {
        kept[f] = v
        any = true
      }
    }
    if (!any && step === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), values: kept, step }))
  } catch {}
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
