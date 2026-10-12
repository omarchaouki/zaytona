import { z } from 'zod'

/** Order list filters shared by the admin table (search params) and the server queries. */

export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const
export const SORTABLE = ['createdAt', 'total', 'customerName', 'city', 'status'] as const

export const orderFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  /** Cash received or not (orders are paid on delivery). */
  paid: z.enum(['paid', 'unpaid']).optional().catch(undefined),
  /** Only orders no admin has opened yet. */
  unseen: z.coerce.boolean().optional().catch(undefined),
  city: z.string().trim().max(80).optional().catch(undefined),
  product: z.uuid().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  sort: z.enum(SORTABLE).optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type OrderFilters = z.infer<typeof orderFiltersSchema>
export const PAGE_SIZE = 25
