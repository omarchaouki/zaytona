import { createMiddleware, createServerOnlyFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  setCookie,
  setResponseHeader,
} from '@tanstack/react-start/server'
import { db } from '~/db/client'
import { getClientCsrfToken } from '~/lib/csrf-client'
import { env } from '~/lib/env'
import { clientIp } from '../request'
import { type ActiveSession, getSession, SESSION_TTL_MS } from './session'

/*
 * Function middleware for admin server functions.
 *  - adminAuth: requires a valid session cookie; puts it in `context.session`.
 *  - adminMutation: adminAuth + the session's CSRF token in `x-csrf-token`
 *    (attached automatically on the client from the token in the admin layout).
 *  - ownerOnly: adminMutation + role "owner".
 * Every admin response is marked noindex.
 */

export const SESSION_COOKIE = 'olive_admin'

// Server-only helpers are wrapped in createServerOnlyFn so the client bundle
// never pulls the database or argon2 through this module.
const sessionCookieOptions = (expires: Date) => {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env().NODE_ENV === 'production',
    path: '/',
    expires,
  }
}

export const setSessionCookie = createServerOnlyFn((token: string) => {
  setCookie(SESSION_COOKIE, token, sessionCookieOptions(new Date(Date.now() + SESSION_TTL_MS)))
})

export const clearSessionCookie = createServerOnlyFn(() => {
  deleteCookie(SESSION_COOKIE, { path: '/' })
})

export class AdminAuthError extends Error {
  constructor(public code: 'unauthenticated' | 'forbidden' | 'csrf') {
    super(code)
  }
}

/** Reads the current session (or null) without throwing; refreshes the cookie when renewed. */
export const readSession = createServerOnlyFn(async (): Promise<ActiveSession | null> => {
  setResponseHeader('X-Robots-Tag', 'noindex, nofollow')
  setResponseHeader('Cache-Control', 'no-store')
  const token = getCookie(SESSION_COOKIE)
  const session = await getSession(db(), token)
  if (!session && token) clearSessionCookie()
  if (session?.renewedUntil && token) {
    setCookie(SESSION_COOKIE, token, sessionCookieOptions(session.renewedUntil))
  }
  return session
})

export const adminAuth = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await readSession()
  if (!session) throw new AdminAuthError('unauthenticated')
  return next({ context: { session, ip: clientIp() ?? null } })
})

export const adminMutation = createMiddleware({ type: 'function' })
  .middleware([adminAuth])
  .client(async ({ next }) => {
    const csrfToken = getClientCsrfToken()
    return next({ headers: csrfToken ? { 'x-csrf-token': csrfToken } : {} })
  })
  .server(async ({ next, context }) => {
    if (getRequestHeader('x-csrf-token') !== context.session.csrfToken) {
      throw new AdminAuthError('csrf')
    }
    return next()
  })

export const ownerOnly = createMiddleware({ type: 'function' })
  .middleware([adminMutation])
  .server(async ({ next, context }) => {
    if (context.session.admin.role !== 'owner') throw new AdminAuthError('forbidden')
    return next()
  })
