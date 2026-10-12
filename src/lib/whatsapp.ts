/**
 * WhatsApp number as stored in settings: international digits only, e.g. "212612345678".
 * Accepts "+212 6 12 34 56 78", "00212…", or a local Moroccan "06…" (assumed +212).
 */
export function normalizeWhatsappNumber(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  let n = digits.startsWith('+') ? digits.slice(1) : digits
  if (n.startsWith('00')) n = n.slice(2)
  if (/^0[5-7]\d{8}$/.test(n)) n = `212${n.slice(1)}`
  return /^[1-9]\d{7,14}$/.test(n) ? n : null
}

export function whatsappLink(number: string, text?: string): string {
  const base = `https://wa.me/${number}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** Fill {placeholders} in an admin-editable message template. Unknown ones are left as is. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}
