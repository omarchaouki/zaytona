import { z } from 'zod'

/**
 * Moroccan mobile and landline numbers: +212 or 0, then 5/6/7, then 8 digits.
 * Accepts spaces, dots, dashes and parentheses, and the 00212 prefix.
 * Returns E.164 (+212XXXXXXXXX) or null.
 */
export function normalizeMoroccanPhone(input: string): string | null {
  // Map Arabic-Indic and Eastern Arabic-Indic digits to ASCII first.
  const ascii = input.replace(/[٠-٩۰-۹]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10))
  const compact = ascii.replace(/[\s.\-()‎‏]/g, '')
  const match = /^(?:\+212|00212|0)([5-7]\d{8})$/.exec(compact)
  return match ? `+212${match[1]}` : null
}

export function isMoroccanPhone(input: string): boolean {
  return normalizeMoroccanPhone(input) !== null
}

/** Zod schema that validates and normalises to E.164. Message is an i18n key. */
export const moroccanPhoneSchema = z
  .string()
  .trim()
  .min(1, 'validation.phoneRequired')
  .transform((value, ctx) => {
    const e164 = normalizeMoroccanPhone(value)
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'validation.phoneInvalid' })
      return z.NEVER
    }
    return e164
  })

/** +212612345678 → "06 12 34 56 78" for display. */
export function formatMoroccanPhone(e164: string): string {
  const local = `0${e164.replace(/^\+212/, '')}`
  return local.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5')
}

/** Display any stored E.164 number: Moroccan ones locally, others unchanged. */
export function formatPhoneDisplay(e164: string): string {
  return /^\+212[5-7]\d{8}$/.test(e164) ? formatMoroccanPhone(e164) : e164
}
