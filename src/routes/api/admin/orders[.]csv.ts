import { createFileRoute } from '@tanstack/react-router'
import { db } from '~/db/client'
import { orderFiltersSchema } from '~/lib/admin-orders'
import { exportOrders } from '~/server/admin/orders'
import { readSession } from '~/server/auth/middleware'

const HEADERS = [
  'reference',
  'created_at',
  'status',
  'customer_name',
  'phone',
  'city',
  'address',
  'note',
  'items',
  'subtotal',
  'delivery_fee',
  'total',
  'language',
  'paid_at',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'fbclid',
]

/** Quote a CSV cell; neutralise spreadsheet formulas (=, +, -, @) from customer input. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** GET /api/admin/orders.csv?<same filters as the orders table> (admin session required). */
export const Route = createFileRoute('/api/admin/orders.csv')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await readSession()
        if (!session) return new Response('Unauthorized', { status: 401 })
        const params = Object.fromEntries(new URL(request.url).searchParams)
        const filters = orderFiltersSchema.parse(params)
        const rows = await exportOrders(db(), filters)
        const lines = [
          HEADERS.join(','),
          ...rows.map((o) =>
            [
              o.reference,
              o.createdAt.toISOString(),
              o.status,
              o.customerName,
              o.phoneE164,
              o.city,
              o.address,
              o.note,
              o.items.map((i) => `${i.quantity} x ${i.productNameSnapshot}`).join(' | '),
              o.subtotal,
              o.deliveryFee,
              o.total,
              o.locale,
              o.paidAt?.toISOString() ?? '',
              o.attribution?.utm_source,
              o.attribution?.utm_medium,
              o.attribution?.utm_campaign,
              o.attribution?.utm_content,
              o.attribution?.fbclid,
            ]
              .map(cell)
              .join(','),
          ),
        ]
        const date = new Date().toISOString().slice(0, 10)
        // BOM so Excel opens Arabic text as UTF-8.
        return new Response(`${String.fromCharCode(0xfeff)}${lines.join('\r\n')}\r\n`, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="orders-${date}.csv"`,
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex',
          },
        })
      },
    },
  },
})
