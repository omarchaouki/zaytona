import type { OrderStatus } from '~/db/schema'
import { useT } from '~/i18n'
import { cn } from '~/lib/cn'

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: 'bg-oil text-olive-950',
  confirmed: 'bg-olive-600 text-limewash',
  shipped: 'bg-sky-700 text-white',
  delivered: 'bg-olive-950 text-olive-200',
  cancelled: 'bg-sand-deep text-ink-soft line-through decoration-1',
  returned: 'bg-danger/90 text-white',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useT()
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        STATUS_STYLE[status],
      )}
    >
      {t(`admin.status.${status}`)}
    </span>
  )
}
