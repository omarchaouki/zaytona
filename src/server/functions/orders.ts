import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { db } from '~/db/client'
import { env } from '~/lib/env'
import { ORDER_REFERENCE_RE } from '~/lib/order'
import { hashIp } from '../crypto'
import { notifyNewOrder } from '../notify'
import { getOrderConfirmation, type PlaceOrderResult, placeOrder } from '../orders'
import { clientIp } from '../request'

async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  const body = new URLSearchParams({ secret, response: token })
  const ip = clientIp()
  if (ip) body.set('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8_000),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

/** What the browser gets back: never the stored phone, address or note. */
export type CreateOrderResult =
  | Exclude<PlaceOrderResult, { status: 'created' }>
  | { status: 'created'; reference: string; viewToken: string }

/** Public order endpoint. Validation happens inside so errors come back as data, not throws. */
export const createOrder = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }): Promise<CreateOrderResult> => {
    const database = db()
    const result = await placeOrder(database, data, {
      ipHash: hashIp(clientIp()),
      userAgent: getRequestHeader('user-agent') ?? null,
      verifyTurnstile: env().TURNSTILE_SECRET_KEY ? verifyTurnstile : undefined,
    })
    if (result.status === 'created') {
      // Fire and forget: the order is saved whatever happens to notifications.
      void notifyNewOrder(database, result.summary).catch((error: unknown) =>
        console.error('[notify]', error),
      )
      return { status: 'created', reference: result.reference, viewToken: result.viewToken }
    }
    return result
  })

export const getOrderConfirmationFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ reference: z.string().regex(ORDER_REFERENCE_RE), token: z.string().max(64) }),
  )
  .handler(({ data }) => getOrderConfirmation(db(), data.reference, data.token))
