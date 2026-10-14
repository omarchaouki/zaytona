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
/** Orders per page the admin can choose from. */
export const PAGE_SIZES = [10, 20, 30, 40, 50] as const
export const DEFAULT_PAGE_SIZE = 20

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
  /** Orders per page, one of PAGE_SIZES (default 20). */
  size: z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
    .optional()
    .catch(undefined),
})

export type OrderFilters = z.infer<typeof orderFiltersSchema>
export const pageSizeOf = (f: OrderFilters) => f.size ?? DEFAULT_PAGE_SIZE
