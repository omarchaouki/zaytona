import { z } from 'zod'

/**
 * Server environment, validated once at boot. Import only from server code
 * (server functions, server routes, db, scripts) — never from components.
 */
const optionalUrl = z
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined))
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))

const flag = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SITE_URL: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
    /** 1 when running against the local PGlite server (single connection). */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    /** Development only: WhatsApp number written by the seed for previews. */
    SEED_WHATSAPP_NUMBER: optionalString,
    APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),

    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(12, 'ADMIN_PASSWORD must be at least 12 characters').optional(),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('./uploads'),
    MAX_UPLOAD_MB: z.coerce.number().int().positive().max(50).default(8),

    SMTP_URL: optionalUrl,
    NOTIFY_EMAIL_FROM: z
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    ORDER_WEBHOOK_URL: optionalUrl,

    TURNSTILE_SITE_KEY: optionalString,
    TURNSTILE_SECRET_KEY: optionalString,

    ANALYTICS_PROVIDER: z
      .enum(['plausible', 'umami', ''])
      .optional()
      .transform((v) => (v ? v : undefined)),
    ANALYTICS_DOMAIN: optionalString,
    ANALYTICS_SCRIPT_URL: optionalUrl,
    UMAMI_WEBSITE_ID: optionalString,

    TRUST_PROXY: flag,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.APP_SECRET.startsWith('change-me')) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_SECRET'],
        message: 'set a real secret in production',
      })
    }
    if (env.TURNSTILE_SITE_KEY && !env.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURNSTILE_SECRET_KEY'],
        message: 'required when TURNSTILE_SITE_KEY is set',
      })
    }
  })

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source)
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    )
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`)
  }
  return result.data
}

let cached: Env | undefined
let reported = false

/**
 * The validated environment. A bad configuration is printed once to the
 * server log (the pages themselves only show a generic error), so a
 * production deploy with a placeholder secret says why it fails.
 */
export function env(): Env {
  if (cached) return cached
  try {
    // The built server is production even when NODE_ENV is not set (`pnpm start`):
    // Vite replaces import.meta.env.PROD at build time. Without this, a deploy
    // would run with development rules (non-Secure session cookie, placeholder
    // secret accepted).
    const builtForProduction = Boolean(import.meta.env?.PROD)
    cached = parseEnv({
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? (builtForProduction ? 'production' : undefined),
    })
    return cached
  } catch (error) {
    if (!reported) {
      reported = true
      console.error(`[config] ${(error as Error).message}`)
    }
    throw error
  }
}
