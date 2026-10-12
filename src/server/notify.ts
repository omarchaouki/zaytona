import type { Database } from '~/db/client'
import { env } from '~/lib/env'
import { formatMad } from '~/lib/format'
import { formatPhoneDisplay } from '~/lib/phone'
import type { CreatedOrder } from './orders'
import { getSettings } from './settings'

/*
 * New-order notifications, both optional:
 *  - email: needs SMTP_URL + NOTIFY_EMAIL_FROM (env) and a recipient in Settings
 *  - webhook: Settings → notifications URL, or ORDER_WEBHOOK_URL (env)
 * Failures are logged and never affect the order, which is already saved.
 */

export async function notifyNewOrder(db: Database, order: CreatedOrder): Promise<void> {
  const e = env()
  const { notifications } = await getSettings(db)
  const jobs: Array<Promise<unknown>> = []

  const recipient = notifications.email
  if (e.SMTP_URL && e.NOTIFY_EMAIL_FROM && recipient) {
    jobs.push(sendEmail(e.SMTP_URL, e.NOTIFY_EMAIL_FROM, recipient, order))
  }

  const webhook = notifications.webhookUrl ?? e.ORDER_WEBHOOK_URL
  if (webhook?.startsWith('https://') || (webhook && e.NODE_ENV !== 'production')) {
    jobs.push(postWebhook(webhook, order))
  }

  const results = await Promise.allSettled(jobs)
  for (const r of results) {
    if (r.status === 'rejected') console.error('[notify] new order notification failed:', r.reason)
  }
}

function orderText(order: CreatedOrder) {
  const fee = order.deliveryFee === null ? 'à confirmer' : formatMad(order.deliveryFee, 'fr')
  return [
    `Nouvelle commande ${order.reference}`,
    '',
    `Client : ${order.customerName}`,
    `Téléphone : ${formatPhoneDisplay(order.phoneE164)}`,
    `Ville : ${order.city}`,
    order.address ? `Adresse : ${order.address}` : null,
    order.note ? `Note : ${order.note}` : null,
    '',
    ...order.items.map((i) => `- ${i.quantity} × ${i.name}`),
    '',
    `Sous-total : ${formatMad(order.subtotal, 'fr')}`,
    `Livraison : ${fee}`,
    `Total : ${formatMad(order.total, 'fr')}`,
    `Langue du client : ${order.locale}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

async function sendEmail(smtpUrl: string, from: string, to: string, order: CreatedOrder) {
  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport(smtpUrl)
  await transport.sendMail({
    from,
    to,
    subject: `Nouvelle commande ${order.reference} — ${order.customerName} (${order.city})`,
    text: orderText(order),
  })
}

async function postWebhook(url: string, order: CreatedOrder) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'order.created', order }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`webhook responded ${res.status}`)
}
