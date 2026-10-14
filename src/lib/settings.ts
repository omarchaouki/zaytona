import { z } from 'zod'

/*
 * Typed settings stored in the `settings` table (key → jsonb). Each key has a
 * schema and a default, so a missing or malformed row never breaks the page.
 * Shared by the server (read/write) and the admin forms (validation).
 */

const nullableText = z.string().trim().max(2000).nullable().default(null)
const nullableUrl = z.url().max(2000).nullable().default(null)

export const settingsSchemas = {
  /** International digits only, e.g. "212612345678". null hides every WhatsApp button. */
  whatsapp: z.object({
    number: z
      .string()
      .regex(/^[1-9]\d{7,14}$/)
      .nullable()
      .default(null),
  }),

  identity: z.object({
    nameAr: z.string().trim().min(1).max(120).default('معصرة الهداجي لزيت الزيتون'),
    nameFr: z.string().trim().min(1).max(120).default('Huilerie El Hadaji'),
    legalName: nullableText,
    ice: nullableText,
    rc: nullableText,
    /** Show legal name / ICE / RC on the page (the client decides). */
    showLegalIds: z.boolean().default(false),
  }),

  contact: z.object({
    /** E.164 phone numbers shown on the page. */
    phones: z
      .array(z.string().regex(/^\+\d{8,15}$/))
      .max(4)
      .default([]),
    email: z.email().nullable().default(null),
    addressAr: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .default('الوناسدة، قلعة السراغنة 43000، المغرب'),
    addressFr: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .default('Louanasda, El Kelaâ des Sraghna 43000, Maroc'),
    /** Link that opens the location (Google Maps share link). */
    mapUrl: nullableUrl,
    /** Google Maps embed URL, loaded only when the visitor asks for the map. */
    mapEmbedUrl: z
      .string()
      .regex(/^https:\/\/www\.google\.com\/maps\/embed\?/)
      .nullable()
      .default(null),
    hoursAr: nullableText,
    hoursFr: nullableText,
    responseTimeAr: nullableText,
    responseTimeFr: nullableText,
    socials: z
      .object({
        facebook: nullableUrl,
        instagram: nullableUrl,
        tiktok: nullableUrl,
        youtube: nullableUrl,
      })
      .default({ facebook: null, instagram: null, tiktok: null, youtube: null }),
  }),

  delivery: z.object({
    /** flat: fixed fee · free_above: fee unless subtotal ≥ threshold · confirm: told by phone */
    mode: z.enum(['flat', 'free_above', 'confirm']).default('confirm'),
    fee: z.number().min(0).max(10_000).nullable().default(null),
    freeAbove: z.number().min(0).max(1_000_000).nullable().default(null),
    timeAr: nullableText,
    timeFr: nullableText,
  }),

  templates: z.object({
    /** Customer → cooperative message on the confirmation screen. */
    orderAr: z
      .string()
      .default(
        'السلام عليكم، أريد تأكيد طلبي رقم {reference}.\nالاسم: {name}\nالمدينة: {city}\nالطلب: {items}\nالمجموع: {total}',
      ),
    orderFr: z
      .string()
      .default(
        'Bonjour, je souhaite confirmer ma commande {reference}.\nNom : {name}\nVille : {city}\nCommande : {items}\nTotal : {total}',
      ),
    /** Cooperative → customer message from the admin order page. */
    customerAr: z
      .string()
      .default('السلام عليكم {name}، نتواصل معكم من المعصرة بخصوص طلبكم رقم {reference}.'),
    customerFr: z
      .string()
      .default('Bonjour {name}, nous vous contactons au sujet de votre commande {reference}.'),
    greetingAr: z.string().default('السلام عليكم، أريد الاستفسار عن منتجاتكم.'),
    greetingFr: z.string().default('Bonjour, je souhaite me renseigner sur vos produits.'),
  }),

  /**
   * Olive oil sold by the litre. Offers with "automatic price" cost
   * liters × pricePerLiter; visitors can also type their own number of litres.
   * null price = not set yet (custom quantities are hidden until it is).
   */
  pricing: z.object({
    pricePerLiter: z.number().min(0).max(100_000).nullable().default(null),
    customEnabled: z.boolean().default(true),
    customMinLiters: z.number().int().min(1).max(999).default(5),
    customMaxLiters: z.number().int().min(1).max(999).default(500),
    /** Seeded placeholder price, cleared when the cooperative saves its own. */
    isDemo: z.boolean().default(false),
  }),

  /**
   * Meta (Facebook / Instagram) Pixel for the ads. Off until the owner turns it
   * on with a Pixel ID: then PageView on every page and a Lead event for each
   * order. With requireConsent the pixel loads only after the visitor accepts.
   */
  marketing: z.object({
    pixelEnabled: z.boolean().default(false),
    pixelId: z
      .string()
      .regex(/^\d{8,20}$/)
      .nullable()
      .default(null),
    requireConsent: z.boolean().default(true),
  }),

  notifications: z.object({
    email: z.email().nullable().default(null),
    webhookUrl: nullableUrl,
  }),

  toggles: z.object({
    showReviews: z.boolean().default(true),
    showGallery: z.boolean().default(true),
    /** Delivered-orders counter; only ever shows a real count from the DB. */
    showCounters: z.boolean().default(false),
  }),
} as const

/** The four delivery options of Admin → Settings ("free" is stored as a flat fee of 0). */
export const DELIVERY_CHOICES = ['confirm', 'flat', 'free_above', 'free'] as const
export type DeliveryChoice = (typeof DELIVERY_CHOICES)[number]

export function deliveryFromChoice(input: {
  choice: DeliveryChoice
  fee?: number
  freeAbove?: number
  timeAr?: string
  timeFr?: string
}): z.output<typeof settingsSchemas.delivery> {
  const { choice } = input
  return {
    mode: choice === 'free' ? 'flat' : choice,
    fee: choice === 'free' ? 0 : choice === 'confirm' ? null : (input.fee ?? null),
    freeAbove: choice === 'free_above' ? (input.freeAbove ?? null) : null,
    timeAr: input.timeAr?.trim() || null,
    timeFr: input.timeFr?.trim() || null,
  }
}

export type SettingsKey = keyof typeof settingsSchemas
export type Settings = { [K in SettingsKey]: z.output<(typeof settingsSchemas)[K]> }

/** Parse a stored value, falling back to defaults field by field. */
export function parseSetting<K extends SettingsKey>(key: K, value: unknown): Settings[K] {
  const schema = settingsSchemas[key]
  const parsed = schema.safeParse(value ?? {})
  if (parsed.success) return parsed.data as Settings[K]
  // Keep valid fields, reset the invalid ones to their defaults.
  const source = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])))
  const cleaned = Object.fromEntries(Object.entries(source).filter(([k]) => !bad.has(k)))
  return schema.parse(cleaned) as Settings[K]
}

export function defaultSettings(): Settings {
  return Object.fromEntries(
    Object.keys(settingsSchemas).map((k) => [k, parseSetting(k as SettingsKey, {})]),
  ) as Settings
}
