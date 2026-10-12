import { z } from 'zod'
import { LOCALES } from '~/i18n/config'
import { moroccanPhoneSchema } from './phone'

/** Review rules shared by the public form and the server. Messages are i18n keys. */

export const REVIEW_COMMENT_MIN = 10
export const REVIEW_COMMENT_MAX = 600
export const REVIEW_PHOTO_MAX_MB = 5

export const reviewFields = {
  name: z.string().trim().min(2, 'reviews.errors.name').max(60, 'reviews.errors.name'),
  rating: z.number().int().min(1, 'reviews.errors.rating').max(5, 'reviews.errors.rating'),
  comment: z
    .string()
    .trim()
    .min(REVIEW_COMMENT_MIN, 'reviews.errors.commentShort')
    .max(REVIEW_COMMENT_MAX, 'reviews.errors.commentLong'),
  city: z.string().trim().max(80, 'reviews.errors.city'),
  /** Optional; never shown. Used only to recognise a delivered order ("verified purchase"). */
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === '' || moroccanPhoneSchema.safeParse(v).success, 'validation.phoneInvalid'),
}

export const reviewInputSchema = z.object({
  ...reviewFields,
  locale: z.enum(LOCALES),
  formToken: z.string().max(200),
  website: z.string().max(200).optional(),
  /** Proof-of-work solution (ALTCHA payload, base64). */
  altcha: z.string().max(4096).optional(),
})

export type ReviewInput = z.input<typeof reviewInputSchema>

/** "Fatima Zahra Bennani" → "Fatima Zahra B." (privacy: no full surname online). */
export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] ?? ''
  const last = parts.pop() ?? ''
  return `${parts.join(' ')} ${last.charAt(0)}.`
}

/** Language the customer wrote in: Arabic script → ar, otherwise fr. */
export function detectLanguage(text: string): 'ar' | 'fr' {
  const letters = text.match(/\p{L}/gu) ?? []
  const arabic = text.match(/[؀-ۿ]/g) ?? []
  return letters.length && arabic.length / letters.length > 0.3 ? 'ar' : 'fr'
}

export type ReviewSummary = {
  count: number
  /** 0–5, one decimal; 0 when there are no approved reviews. */
  average: number
  /** Index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number]
}
