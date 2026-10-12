import { z } from 'zod'

/*
 * Editable page texts stored in `content_blocks` (one JSON value per language).
 * Short blocks only override the defaults in src/i18n/*.json: an empty field
 * falls back to the translation file, so the page never shows a blank.
 */

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => (v ? v : undefined))

export const contentSchemas = {
  hero: z.object({ eyebrow: optionalText, title: optionalText, subtitle: optionalText }),
  story: z.object({ title: optionalText, body: optionalText }),
  policies: z.object({
    cod: optionalText,
    delivery: optionalText,
    returns: optionalText,
    privacy: optionalText,
  }),
  /** Full policy pages: sanitised HTML. `reviewed` is false until the client's lawyer signs off. */
  page_privacy: z.object({
    title: optionalText,
    html: z.string().max(100_000).default(''),
    reviewed: z.boolean().default(false),
  }),
  page_terms: z.object({
    title: optionalText,
    html: z.string().max(100_000).default(''),
    reviewed: z.boolean().default(false),
  }),
} as const

export type ContentKey = keyof typeof contentSchemas
export type Content<K extends ContentKey> = z.output<(typeof contentSchemas)[K]>

export function parseContent<K extends ContentKey>(key: K, value: unknown): Content<K> {
  const parsed = contentSchemas[key].safeParse(value ?? {})
  return (parsed.success ? parsed.data : contentSchemas[key].parse({})) as Content<K>
}
