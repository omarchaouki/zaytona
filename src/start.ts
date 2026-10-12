import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { env } from '~/lib/env'

/*
 * App-wide request middleware.
 * - Security headers on every response: no MIME sniffing, no framing by other
 *   sites (clickjacking), a referrer that never leaks full URLs (order pages
 *   carry a token), no camera/mic/geolocation, and HSTS once served over HTTPS.
 * - CSRF: every non-GET request (server functions, API routes) must come from
 *   this site, checked with Sec-Fetch-Site / Origin. Admin mutations
 *   additionally carry a per-session token (src/server/auth).
 */
const securityHeaders = createMiddleware().server(({ request, next }) => {
  // Validate the configuration on every request path (cached after the first):
  // a misconfigured server fails everywhere, with the reason in the log.
  env()
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    ...(new URL(request.url).protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
      ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }
      : {}),
  }
  for (const [name, value] of Object.entries(headers)) setResponseHeader(name, value)
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [
    securityHeaders,
    createCsrfMiddleware({
      filter: ({ request }) => request.method !== 'GET' && request.method !== 'HEAD',
    }),
  ],
}))
