import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '~/db/client'
import { rateLimits } from '~/db/schema'

/**
 * Fixed-window counter in Postgres (works across restarts and instances).
 * Returns true when the call is allowed, false when the limit is reached.
 */
export async function consumeRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowMs = windowSeconds * 1000
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs)
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count })

  // Opportunistic cleanup of old windows (about 1 call in 50).
  if (Math.random() < 0.02) {
    await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < now() - interval '1 day'`)
  }
  return (row?.count ?? 1) <= limit
}

/** Current count in the window without incrementing it (e.g. failed logins so far). */
export async function peekRateLimit(db: Database, key: string, windowSeconds: number) {
  const windowMs = windowSeconds * 1000
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs)
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart)))
  return row?.count ?? 0
}

/**
 * Records a one-time key (e.g. a used anti-bot solution). Returns false when
 * the key was already claimed. The row is kept until a day after `until`.
 */
export async function claimOnce(db: Database, key: string, until: Date): Promise<boolean> {
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart: until, count: 1 })
    .onConflictDoNothing()
    .returning({ key: rateLimits.key })
  return rows.length === 1
}
