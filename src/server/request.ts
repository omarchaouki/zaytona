import { getRequestIP } from '@tanstack/react-start/server'
import { env } from '~/lib/env'

/** Client IP; X-Forwarded-For is trusted only behind our own proxy (TRUST_PROXY=true). */
export function clientIp(): string | undefined {
  return getRequestIP({ xForwardedFor: env().TRUST_PROXY })
}
