import { eq, sql } from 'drizzle-orm'
import { env } from '~/lib/env'
import { hashPassword } from '~/server/auth/password'
import { createDb } from './client'
import { admins, auditLogs, sessions } from './schema'

/**
 * Recovery: sets ADMIN_EMAIL's password back to ADMIN_PASSWORD (from the
 * environment), forces a change at next login and signs out every session.
 * Creates the owner if it does not exist yet.   pnpm admin:reset-password
 */
async function main() {
  const e = env()
  if (!e.ADMIN_EMAIL || !e.ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) first.')
  }
  const db = createDb(e.DATABASE_URL, 1)
  const passwordHash = await hashPassword(e.ADMIN_PASSWORD)
  const [existing] = await db
    .select()
    .from(admins)
    .where(eq(sql`lower(${admins.email})`, e.ADMIN_EMAIL.toLowerCase()))
  if (existing) {
    await db
      .update(admins)
      .set({ passwordHash, mustChangePassword: true, disabledAt: null })
      .where(eq(admins.id, existing.id))
    await db.delete(sessions).where(eq(sessions.adminId, existing.id))
    await db.insert(auditLogs).values({
      adminId: existing.id,
      action: 'password_reset_cli',
      entity: 'admin',
      entityId: existing.id,
    })
    console.log(`Password reset for ${existing.email}; a new one is required at next login.`)
  } else {
    await db
      .insert(admins)
      .values({ email: e.ADMIN_EMAIL, passwordHash, role: 'owner', mustChangePassword: true })
    console.log(`Owner ${e.ADMIN_EMAIL} created; a new password is required at first login.`)
  }
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
