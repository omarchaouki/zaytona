import { and, eq, gt, lt, sql } from 'drizzle-orm'
import type { Database } from '~/db/client'
import { type Admin, admins, auditLogs, sessions } from '~/db/schema'
import { PASSWORD_MIN } from '~/lib/csrf-client'
import { randomToken, sha256 } from '../crypto'
import { consumeRateLimit, peekRateLimit } from '../rate-limit'
import { hashPassword, verifyPassword } from './password'

/*
 * Admin sessions: a random 256-bit token lives only in an HTTP-only cookie;
 * the database stores its SHA-256, so a leaked table cannot be replayed.
 * Each session carries its own CSRF token, sent back as a header on mutations.
 */

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RENEW_BELOW_MS = 3.5 * 24 * 60 * 60 * 1000

export const LOGIN_LIMITS = {
  /** Failed attempts allowed per 15 minutes. */
  perIp: { max: 10, windowSeconds: 15 * 60 },
  perEmail: { max: 5, windowSeconds: 15 * 60 },
}

// Verified when the email is unknown, so both paths take the same time.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => {
  dummyHash ??= hashPassword('not-a-real-password-just-for-timing')
  return dummyHash
}

export type SessionAdmin = Pick<
  Admin,
  'id' | 'email' | 'name' | 'role' | 'uiLocale' | 'mustChangePassword'
>

export type LoginResult =
  | { ok: true; token: string; admin: SessionAdmin }
  | { ok: false; reason: 'invalid' | 'rate_limited' }

export async function login(
  db: Database,
  input: { email: string; password: string },
  ctx: { ipHash: string | null; ip: string | null; userAgent: string | null; now?: Date },
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase()
  // Only failed attempts count: a locked email or IP gets "rate_limited"
  // before the password is even checked.
  const ipKey = `login:ip:${ctx.ipHash ?? 'unknown'}`
  const emailKey = `login:email:${sha256(email)}`
  const [ipFails, emailFails] = await Promise.all([
    peekRateLimit(db, ipKey, LOGIN_LIMITS.perIp.windowSeconds),
    peekRateLimit(db, emailKey, LOGIN_LIMITS.perEmail.windowSeconds),
  ])
  if (ipFails >= LOGIN_LIMITS.perIp.max || emailFails >= LOGIN_LIMITS.perEmail.max) {
    return { ok: false, reason: 'rate_limited' }
  }

  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(sql`lower(${admins.email})`, email))
  let valid = false
  if (admin) valid = await verifyPassword(admin.passwordHash, input.password)
  else await verifyPassword(await getDummyHash(), input.password)

  if (!admin || !valid || admin.disabledAt) {
    await Promise.all([
      consumeRateLimit(db, ipKey, LOGIN_LIMITS.perIp.max, LOGIN_LIMITS.perIp.windowSeconds),
      consumeRateLimit(
        db,
        emailKey,
        LOGIN_LIMITS.perEmail.max,
        LOGIN_LIMITS.perEmail.windowSeconds,
      ),
    ])
    await db.insert(auditLogs).values({
      adminId: admin?.id ?? null,
      action: 'login_failed',
      entity: 'admin',
      meta: { email },
      ip: ctx.ip,
    })
    return { ok: false, reason: 'invalid' }
  }

  const now = ctx.now ?? new Date()
  const token = randomToken()
  await db.insert(sessions).values({
    id: sha256(token),
    adminId: admin.id,
    csrfToken: randomToken(24),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    ip: ctx.ip,
    userAgent: ctx.userAgent?.slice(0, 300) ?? null,
  })
  await db.update(admins).set({ lastLoginAt: now }).where(eq(admins.id, admin.id))
  await db
    .insert(auditLogs)
    .values({ adminId: admin.id, action: 'login', entity: 'admin', entityId: admin.id, ip: ctx.ip })
  // Housekeeping: drop expired sessions now and then.
  if (Math.random() < 0.1) await db.delete(sessions).where(lt(sessions.expiresAt, now))

  return { ok: true, token, admin: pickAdmin(admin) }
}

function pickAdmin(a: Admin): SessionAdmin {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    uiLocale: a.uiLocale,
    mustChangePassword: a.mustChangePassword,
  }
}

export type ActiveSession = {
  admin: SessionAdmin
  sessionId: string
  csrfToken: string
  /** Set when the expiry was pushed forward and the cookie should be refreshed. */
  renewedUntil: Date | null
}

export async function getSession(
  db: Database,
  token: string | undefined,
  now = new Date(),
): Promise<ActiveSession | null> {
  if (!token || token.length < 20 || token.length > 100) return null
  const id = sha256(token)
  const [row] = await db
    .select({ session: sessions, admin: admins })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
  if (!row || row.admin.disabledAt) return null

  let renewedUntil: Date | null = null
  if (row.session.expiresAt.getTime() - now.getTime() < RENEW_BELOW_MS) {
    renewedUntil = new Date(now.getTime() + SESSION_TTL_MS)
    await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id))
  }
  return {
    admin: pickAdmin(row.admin),
    sessionId: id,
    csrfToken: row.session.csrfToken,
    renewedUntil,
  }
}

export async function logout(db: Database, session: ActiveSession, ip: string | null) {
  await db.delete(sessions).where(eq(sessions.id, session.sessionId))
  await db.insert(auditLogs).values({
    adminId: session.admin.id,
    action: 'logout',
    entity: 'admin',
    entityId: session.admin.id,
    ip,
  })
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: 'wrong_current' | 'too_weak' }

/** Changes the password and signs out every other session of this admin. */
export async function changePassword(
  db: Database,
  session: ActiveSession,
  input: { current: string; next: string },
  ip: string | null,
): Promise<ChangePasswordResult> {
  const [admin] = await db.select().from(admins).where(eq(admins.id, session.admin.id))
  if (!admin || !(await verifyPassword(admin.passwordHash, input.current))) {
    return { ok: false, reason: 'wrong_current' }
  }
  if (input.next.length < PASSWORD_MIN || input.next === input.current) {
    return { ok: false, reason: 'too_weak' }
  }
  await db
    .update(admins)
    .set({ passwordHash: await hashPassword(input.next), mustChangePassword: false })
    .where(eq(admins.id, admin.id))
  await db
    .delete(sessions)
    .where(and(eq(sessions.adminId, admin.id), sql`${sessions.id} <> ${session.sessionId}`))
  await db.insert(auditLogs).values({
    adminId: admin.id,
    action: 'password_changed',
    entity: 'admin',
    entityId: admin.id,
    ip,
  })
  return { ok: true }
}
