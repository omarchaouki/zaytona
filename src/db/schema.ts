import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
const money = (name: string) => numeric(name, { precision: 10, scale: 2, mode: 'string' })

/* ------------------------------------------------------------------ enums */

export const adminRole = pgEnum('admin_role', ['owner', 'staff'])
export const orderStatus = pgEnum('order_status', [
  'new',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
])
export const reviewStatus = pgEnum('review_status', ['pending', 'approved', 'rejected'])
export const stockStatus = pgEnum('stock_status', ['in_stock', 'low_stock', 'out_of_stock'])
export const certificationType = pgEnum('certification_type', [
  'onssa',
  'organic',
  'igp',
  'iso',
  'other',
])
export const localeEnum = pgEnum('locale', ['ar', 'fr'])

/* ------------------------------------------------------------------- auth */

export const admins = pgTable(
  'admins',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name'),
    passwordHash: text('password_hash').notNull(),
    role: adminRole('role').notNull().default('staff'),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    uiLocale: localeEnum('ui_locale').notNull().default('ar'),
    createdAt: createdAt(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('admins_email_lower_uq').on(sql`lower(${t.email})`)],
)

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the session token; the raw token only lives in the cookie. */
    id: text('id').primaryKey(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_admin_idx').on(t.adminId), index('sessions_expires_idx').on(t.expiresAt)],
)

/* --------------------------------------------------------------- settings */

/** Key/value settings (WhatsApp number, contact info, delivery rules, templates, toggles). */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
  updatedBy: uuid('updated_by').references(() => admins.id, { onDelete: 'set null' }),
})

/* --------------------------------------------------------------- catalogue */

export const products = pgTable(
  'products',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameFr: text('name_fr').notNull(),
    taglineAr: text('tagline_ar'),
    taglineFr: text('tagline_fr'),
    descriptionAr: text('description_ar'),
    descriptionFr: text('description_fr'),
    priceMad: money('price_mad').notNull(),
    /** Olive-oil offers: volume in litres (e.g. 30, 60, 90). null for other products. */
    liters: numeric('liters', { precision: 7, scale: 2, mode: 'string' }),
    /** true: price_mad follows liters × the price per litre in Settings (kept in sync on save). */
    autoPrice: boolean('auto_price').notNull().default(false),
    sizeLabelAr: text('size_label_ar'),
    sizeLabelFr: text('size_label_fr'),
    stockStatus: stockStatus('stock_status').notNull().default('in_stock'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    seoTitleAr: text('seo_title_ar'),
    seoTitleFr: text('seo_title_fr'),
    seoDescriptionAr: text('seo_description_ar'),
    seoDescriptionFr: text('seo_description_fr'),
    /** Seed/demo rows are flagged so the admin can see what still needs replacing. */
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('products_price_nonnegative', sql`${t.priceMad} >= 0`),
    index('products_active_sort_idx').on(t.isActive, t.sortOrder),
  ],
)

export const productImages = pgTable(
  'product_images',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Storage key of the image set; variants are derived from it (see src/server/storage). */
    url: text('url').notNull(),
    width: integer('width'),
    height: integer('height'),
    altAr: text('alt_ar'),
    altFr: text('alt_fr'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.sortOrder)],
)

/** Optional lab analysis (acidity, peroxide…) shown as "Quality report" on a product. */
export const productLabReports = pgTable(
  'product_lab_reports',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    fileUrl: text('file_url').notNull(),
    labName: text('lab_name'),
    analysedAt: date('analysed_at'),
    /** Free-form measured values, e.g. { "acidity_pct": "0.4", "peroxide_meq": "8" }. */
    results: jsonb('results'),
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('product_lab_reports_product_idx').on(t.productId)],
)

/* ------------------------------------------------------------------ orders */

/**
 * Feeds the human-readable reference OL-YYYY-010001. A Postgres sequence never
 * hands the same value to two transactions, however many orders arrive at
 * once (unlike "max(number) + 1"). Starts at 10001 so references don't
 * begin at 1; gaps after a rolled-back insert are normal and harmless.
 */
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 10001, increment: 1 })

export const orders = pgTable(
  'orders',
  {
    id: id(),
    number: bigint('number', { mode: 'number' })
      .notNull()
      .unique()
      .default(sql`nextval('order_number_seq')`),
    reference: text('reference').notNull().unique(),
    customerName: text('customer_name').notNull(),
    phoneE164: text('phone_e164').notNull(),
    city: text('city').notNull(),
    address: text('address'),
    note: text('note'),
    internalNote: text('internal_note'),
    status: orderStatus('status').notNull().default('new'),
    subtotal: money('subtotal').notNull(),
    /** null = delivery fee to be confirmed by phone. */
    deliveryFee: money('delivery_fee'),
    total: money('total').notNull(),
    locale: localeEnum('locale').notNull(),
    source: text('source').notNull().default('landing'),
    /** Where the visitor came from (first visit): utm_* and fbclid, for the ads. */
    attribution: jsonb('attribution').$type<Record<string, string>>(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    /** First time an admin opened (or acknowledged) the order; null = shown in red as new. */
    seenAt: timestamp('seen_at', { withTimezone: true }),
    /** Cash received (orders are paid on delivery); set from the admin. */
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidBy: uuid('paid_by').references(() => admins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('orders_phone_e164', sql`${t.phoneE164} ~ '^\\+212[5-7][0-9]{8}$'`),
    check('orders_totals_nonnegative', sql`${t.subtotal} >= 0 and ${t.total} >= 0`),
    index('orders_created_idx').on(t.createdAt),
    index('orders_status_idx').on(t.status, t.createdAt),
    index('orders_phone_idx').on(t.phoneE164, t.createdAt),
    index('orders_city_idx').on(t.city),
    index('orders_unseen_idx').on(t.seenAt, t.createdAt),
    index('orders_paid_idx').on(t.paidAt),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    productNameSnapshot: text('product_name_snapshot').notNull(),
    unitPriceSnapshot: money('unit_price_snapshot').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [
    check('order_items_quantity_range', sql`${t.quantity} between 1 and 999`),
    index('order_items_order_idx').on(t.orderId),
    index('order_items_product_idx').on(t.productId),
  ],
)

export const orderEvents = pgTable(
  'order_events',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId, t.createdAt)],
)

/* ----------------------------------------------------------------- reviews */

export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    authorName: text('author_name').notNull(),
    city: text('city'),
    rating: smallint('rating').notNull(),
    comment: text('comment').notNull(),
    /** Language detected from the text as written by the customer. */
    language: text('language').notNull().default('ar'),
    /** HMAC of the E.164 phone; never displayed, used to match a delivered order. */
    phoneHash: text('phone_hash'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    status: reviewStatus('status').notNull().default('pending'),
    isFeatured: boolean('is_featured').notNull().default(false),
    replyAr: text('reply_ar'),
    replyFr: text('reply_fr'),
    rejectionReason: text('rejection_reason'),
    /** Set when an admin edits the comment for typos; keeps the customer's original text. */
    originalComment: text('original_comment'),
    /** Optional customer photo (storage key `upload:<id>`), re-encoded and stripped of EXIF. */
    photoUrl: text('photo_url'),
    photoWidth: integer('photo_width'),
    photoHeight: integer('photo_height'),
    ipHash: text('ip_hash'),
    /** Example review written for the template; shown with an "example" badge, never in structured data. */
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    moderatedBy: uuid('moderated_by').references(() => admins.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('reviews_rating_range', sql`${t.rating} between 1 and 5`),
    check('reviews_comment_length', sql`char_length(${t.comment}) between 10 and 600`),
    index('reviews_status_idx').on(t.status, t.isFeatured, t.createdAt),
  ],
)

/* ---------------------------------------------------------------- content */

export const faqs = pgTable(
  'faqs',
  {
    id: id(),
    questionAr: text('question_ar').notNull(),
    questionFr: text('question_fr').notNull(),
    answerAr: text('answer_ar').notNull(),
    answerFr: text('answer_fr').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('faqs_active_sort_idx').on(t.isActive, t.sortOrder)],
)

/** Editable page texts (hero, story, policies…). Each value is a JSON object per language. */
export const contentBlocks = pgTable('content_blocks', {
  key: text('key').primaryKey(),
  valueAr: jsonb('value_ar').notNull(),
  valueFr: jsonb('value_fr').notNull(),
  updatedAt: updatedAt(),
  updatedBy: uuid('updated_by').references(() => admins.id, { onDelete: 'set null' }),
})

export const certifications = pgTable(
  'certifications',
  {
    id: id(),
    type: certificationType('type').notNull(),
    labelAr: text('label_ar'),
    labelFr: text('label_fr'),
    number: text('number').notNull(),
    issuedAt: date('issued_at'),
    expiresAt: date('expires_at'),
    imageUrl: text('image_url'),
    isPublic: boolean('is_public').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('certifications_public_idx').on(t.isPublic, t.sortOrder)],
)

export const galleryImages = pgTable('gallery_images', {
  id: id(),
  url: text('url').notNull(),
  width: integer('width'),
  height: integer('height'),
  captionAr: text('caption_ar'),
  captionFr: text('caption_fr'),
  sortOrder: integer('sort_order').notNull().default(0),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: createdAt(),
})

/* -------------------------------------------------------------- telemetry */

export const whatsappClicks = pgTable(
  'whatsapp_clicks',
  {
    id: id(),
    placement: text('placement').notNull(),
    locale: localeEnum('locale').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('whatsapp_clicks_created_idx').on(t.createdAt)],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    meta: jsonb('meta'),
    ip: inet('ip'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
  ],
)

/** Fixed-window rate-limit counters, keyed by e.g. `order:ip:<hash>` and window start. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    index('rate_limits_window_idx').on(t.windowStart),
  ],
)

export type Admin = typeof admins.$inferSelect
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type Review = typeof reviews.$inferSelect
export type Faq = typeof faqs.$inferSelect
export type Certification = typeof certifications.$inferSelect
export type OrderStatus = (typeof orderStatus.enumValues)[number]
export type ReviewStatus = (typeof reviewStatus.enumValues)[number]
