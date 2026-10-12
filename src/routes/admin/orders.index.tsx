import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Download,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { StatusBadge } from '~/components/admin/badges'
import { ConfirmDelete } from '~/components/admin/ConfirmDelete'
import { useUnseenOrders } from '~/components/admin/OrderNotifications'
import { Button } from '~/components/ui/button'
import { useLocale, useT } from '~/i18n'
import { ORDER_STATUSES, type OrderFilters, orderFiltersSchema } from '~/lib/admin-orders'
import { cn } from '~/lib/cn'
import { formatMad, formatNumber } from '~/lib/format'
import { formatPhoneDisplay } from '~/lib/phone'
import {
  adminDeleteOrders,
  adminMarkOrdersSeen,
  adminRestoreOrders,
  adminSetOrderStatus,
  adminSetOrdersPaid,
  getOrdersPage,
} from '~/server/functions/admin'

const ordersQuery = (filters: OrderFilters) => ({
  queryKey: ['admin', 'orders', filters] as const,
  queryFn: () => getOrdersPage({ data: filters }),
  refetchInterval: 30_000,
})

export const Route = createFileRoute('/admin/orders/')({
  validateSearch: orderFiltersSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(ordersQuery(deps)),
  component: OrdersPage,
})

type Row = Awaited<ReturnType<typeof getOrdersPage>>['rows'][number]
type SortKey = NonNullable<OrderFilters['sort']>

function OrdersPage() {
  const t = useT()
  const locale = useLocale()
  const filters = Route.useSearch()
  const navigate = useNavigate({ from: '/admin/orders/' })
  const queryClient = useQueryClient()
  const setStatus = useServerFn(adminSetOrderStatus)
  const deleteOrders = useServerFn(adminDeleteOrders)
  const setPaid = useServerFn(adminSetOrdersPaid)
  const markSeen = useServerFn(adminMarkOrdersSeen)
  const unseenCount = useUnseenOrders().data?.count ?? 0
  const restore = useServerFn(adminRestoreOrders)
  const { admin } = Route.useRouteContext()
  const isOwner = admin.role === 'owner'
  const { data } = useQuery({
    ...ordersQuery(filters),
    initialData: Route.useLoaderData(),
    placeholderData: keepPreviousData,
  })
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [bulkStatus, setBulkStatus] = useState<(typeof ORDER_STATUSES)[number]>('confirmed')
  const [message, setMessage] = useState<{ text: string; undoIds?: string[] } | null>(null)
  /** Orders waiting for the delete confirmation (one row, or the selection). */
  const [toDelete, setToDelete] = useState<string[] | null>(null)
  const [q, setQ] = useState(filters.q ?? '')
  /** Phones: the filters fold away behind a button; the search box stays. */
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilters = (
    ['status', 'paid', 'unseen', 'product', 'city', 'from', 'to'] as const
  ).filter((k) => filters[k]).length

  // Debounced search box → URL.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if ((filters.q ?? '') !== q) void setFilters({ q: q || undefined })
    }, 350)
    return () => window.clearTimeout(id)
  })

  function setFilters(patch: Partial<OrderFilters>) {
    setSelection({})
    return navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) })
  }

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-MA', {
        timeZone: 'Africa/Casablanca',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const sortHeader = (key: SortKey, label: string) => {
    const active = (filters.sort ?? 'createdAt') === key
    const dir = active ? (filters.dir ?? 'desc') : undefined
    const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
    return (
      <button
        type="button"
        onClick={() =>
          navigate({
            search: (prev) => ({
              ...prev,
              sort: key,
              dir: active && dir === 'desc' ? 'asc' : 'desc',
              page: undefined,
            }),
          })
        }
        aria-label={t('admin.orders.sortBy', { column: label })}
        className="inline-flex min-h-11 items-center gap-1 font-bold hover:text-olive"
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden="true" />
      </button>
    )
  }

  // Rebuilt each render: the sortable headers read the current filters.
  const columns: ColumnDef<Row>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <label className="tap -m-3 inline-flex cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            className="size-4 accent-olive"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label={t('admin.orders.selectAll')}
          />
        </label>
      ),
      cell: ({ row }) => (
        <label className="tap -m-3 inline-flex cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            className="size-4 accent-olive"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={t('admin.orders.selectRow', { reference: row.original.reference })}
          />
        </label>
      ),
    },
    {
      id: 'reference',
      header: () => t('admin.orders.colReference'),
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <Link
            to="/admin/orders/$id"
            params={{ id: row.original.id }}
            className="inline-flex min-h-11 items-center font-bold whitespace-nowrap text-olive underline-offset-4 hover:underline"
            dir="ltr"
          >
            {row.original.reference}
          </Link>
          {!row.original.seenAt ? <NewBadge /> : null}
        </span>
      ),
    },
    {
      id: 'paid',
      header: () => t('admin.orders.colPaid'),
      cell: ({ row }) => <PaidBadge paid={Boolean(row.original.paidAt)} />,
    },
    {
      id: 'createdAt',
      header: () => sortHeader('createdAt', t('admin.orders.colDate')),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-ink-soft tabular-nums">
          {dateFmt.format(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      id: 'customerName',
      header: () => sortHeader('customerName', t('admin.orders.colCustomer')),
      cell: ({ row }) => (
        <div className="min-w-[9rem]">
          <p className="font-medium">{row.original.customerName}</p>
          <p className="text-xs text-ink-soft tabular-nums" dir="ltr">
            {formatPhoneDisplay(row.original.phoneE164)}
          </p>
        </div>
      ),
    },
    {
      id: 'city',
      header: () => sortHeader('city', t('admin.orders.colCity')),
      cell: ({ row }) => row.original.city,
    },
    {
      id: 'total',
      header: () => sortHeader('total', t('admin.orders.colTotal')),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <p className="font-medium tabular-nums">{formatMad(row.original.total, locale)}</p>
          <p className="text-xs text-ink-soft">
            {t('admin.orders.items', { count: row.original.itemCount })}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: () => sortHeader('status', t('admin.orders.colStatus')),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(isOwner
      ? [
          {
            id: 'actions',
            header: () => <span className="sr-only">{t('admin.orders.delete')}</span>,
            cell: ({ row }) => (
              <DeleteButton
                label={t('admin.orders.deleteRow', { reference: row.original.reference })}
                onClick={() => setToDelete([row.original.id])}
              />
            ),
          } satisfies ColumnDef<Row>,
        ]
      : []),
  ]

  const table = useReactTable({
    data: data.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
    manualPagination: true,
    manualSorting: true,
  })

  const selectedIds = Object.keys(selection).filter((id) => selection[id])
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const exportParams = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
  )

  async function applyBulk() {
    const result = await setStatus({ data: { ids: selectedIds, status: bulkStatus } })
    setSelection({})
    setMessage({ text: t('admin.orders.applied', { count: result.changed }) })
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  async function applyPaid(paid: boolean) {
    const result = await setPaid({ data: { ids: selectedIds, paid } })
    setSelection({})
    setMessage({
      text: t(paid ? 'admin.orders.markedPaid' : 'admin.orders.markedUnpaid', {
        count: result.changed,
      }),
    })
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  async function markAllSeen() {
    await markSeen({ data: {} })
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  async function confirmDelete() {
    if (!toDelete) return
    const ids = toDelete
    const result = await deleteOrders({ data: { ids } })
    setSelection({})
    setMessage({ text: t('admin.orders.deleted', { count: result.deleted }), undoIds: ids })
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  async function undoDelete(ids: string[]) {
    const result = await restore({ data: { ids } })
    setMessage({ text: t('admin.orders.restored', { count: result.restored }) })
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const selectClass = 'field-input min-h-11 w-auto pe-8'

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h2">{t('admin.orders.title')}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t('admin.orders.count', { count: formatNumber(data.total, locale) })}
          </p>
        </div>
        {unseenCount > 0 ? (
          <Button variant="outline" onClick={markAllSeen} className="border-danger/40 text-danger">
            {t('admin.orders.markAllSeen')} ({formatNumber(unseenCount, locale)})
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={`/api/admin/orders.csv?${exportParams}`} download>
            <Download aria-hidden="true" />
            {t('admin.orders.export')}
          </a>
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-5 grid gap-3 rounded-card bg-white p-4 shadow-lift ring-1 ring-sand-deep/50 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex gap-2 md:contents">
          <label className="relative block flex-1">
            <span className="sr-only">{t('admin.orders.searchLabel')}</span>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.orders.search')}
              className="field-input min-h-11 ps-9"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls="order-filters"
            className="tap relative inline-flex shrink-0 items-center gap-1.5 rounded-field border border-sand-deep px-3 text-sm font-medium text-olive md:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t('admin.orders.filters')}
            {activeFilters > 0 ? (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-oil text-xs font-bold text-olive-950">
                {activeFilters}
              </span>
            ) : null}
          </button>
        </div>
        <div
          id="order-filters"
          className={cn('gap-3 md:contents', filtersOpen ? 'grid' : 'hidden')}
        >
          <FilterSelect
            label={t('admin.orders.statusFilter')}
            value={filters.status ?? ''}
            onChange={(v) => setFilters({ status: (v || undefined) as OrderFilters['status'] })}
            options={ORDER_STATUSES.map((s) => [s, t(`admin.status.${s}`)])}
            allLabel={t('admin.orders.all')}
            className={selectClass}
          />
          <FilterSelect
            label={t('admin.orders.paidFilter')}
            value={filters.unseen ? 'unseen' : (filters.paid ?? '')}
            onChange={(v) =>
              setFilters(
                v === 'unseen'
                  ? { unseen: true, paid: undefined }
                  : { paid: (v || undefined) as OrderFilters['paid'], unseen: undefined },
              )
            }
            options={[
              ['paid', t('admin.orders.paid')],
              ['unpaid', t('admin.orders.unpaid')],
              ['unseen', t('admin.orders.unseenOnly')],
            ]}
            allLabel={t('admin.orders.all')}
            className={selectClass}
          />
          <FilterSelect
            label={t('admin.orders.productFilter')}
            value={filters.product ?? ''}
            onChange={(v) => setFilters({ product: v || undefined })}
            options={data.products.map((p) => [
              p.id,
              [locale === 'ar' ? p.nameAr : p.nameFr, locale === 'ar' ? p.sizeAr : p.sizeFr]
                .filter(Boolean)
                .join(' · '),
            ])}
            allLabel={t('admin.orders.all')}
            className={selectClass}
          />
          <div className="flex flex-wrap items-end gap-3 md:col-span-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                {t('admin.orders.city')}
              </span>
              <input
                defaultValue={filters.city ?? ''}
                onBlur={(e) => setFilters({ city: e.target.value.trim() || undefined })}
                className="field-input min-h-11 w-40"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                {t('admin.orders.from')}
              </span>
              <input
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => setFilters({ from: e.target.value || undefined })}
                className="field-input min-h-11 w-auto"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                {t('admin.orders.to')}
              </span>
              <input
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => setFilters({ to: e.target.value || undefined })}
                className="field-input min-h-11 w-auto"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setQ('')
                void navigate({ search: {} })
              }}
              className="tap ms-auto inline-flex items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft hover:bg-sand"
            >
              <X className="size-4" aria-hidden="true" />
              {t('admin.orders.reset')}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 ? (
        <div className="sticky top-14 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-card bg-olive-950 px-4 py-3 text-limewash shadow-lift lg:top-2">
          <span className="font-bold">
            {t('admin.orders.selected', { count: selectedIds.length })}
          </span>
          <label className="flex items-center gap-2 text-sm">
            {t('admin.orders.bulkStatus')}
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as typeof bulkStatus)}
              className="field-input min-h-10 w-auto text-ink"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`admin.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="md"
            onClick={applyBulk}
            className="bg-oil text-olive-950 hover:bg-oil-bright"
          >
            {t('admin.orders.apply')}
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={() => applyPaid(true)}
            className="border-olive-400/60 text-limewash hover:bg-olive-600"
          >
            <BadgeCheck aria-hidden="true" />
            {t('admin.orders.markPaid')}
          </Button>
          <Button
            size="md"
            variant="ghost"
            onClick={() => applyPaid(false)}
            className="text-limewash/80 hover:bg-limewash/10 hover:text-limewash"
          >
            {t('admin.orders.markUnpaid')}
          </Button>
          {isOwner ? (
            <Button
              size="md"
              variant="outline"
              onClick={() => setToDelete(selectedIds)}
              className="border-danger/60 text-limewash hover:bg-danger hover:text-white sm:ms-auto"
            >
              <Trash2 aria-hidden="true" />
              {t('admin.orders.delete')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div role="status" aria-live="polite">
        {message ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm font-medium text-olive-600">
            {message.text}
            {message.undoIds ? (
              <button
                type="button"
                onClick={() => message.undoIds && undoDelete(message.undoIds)}
                className="tap inline-flex items-center gap-1.5 rounded-full px-3 font-bold text-olive underline decoration-oil decoration-2 underline-offset-4 hover:bg-sand"
              >
                <Undo2 className="size-4" aria-hidden="true" />
                {t('admin.orders.undo')}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
      <ConfirmDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        onConfirm={confirmDelete}
      />

      {/* Phones: one card per order (no sideways scrolling). */}
      <ul className="mt-4 grid gap-g1 md:grid-cols-2 xl:hidden">
        {table.getRowModel().rows.length === 0 ? (
          <li className="rounded-card bg-white px-4 py-10 text-center text-ink-soft">
            {t('admin.orders.empty')}
          </li>
        ) : (
          table.getRowModel().rows.map((row) => {
            const o = row.original
            return (
              <li
                key={row.id}
                className={cn(
                  'relative rounded-card bg-white p-g2 shadow-lift ring-1 ring-sand-deep/50',
                  row.getIsSelected() && 'ring-2 ring-oil',
                  o.status === 'new' && 'border-s-4 border-s-oil',
                  !o.seenAt && 'border-s-4 border-s-danger bg-danger/[0.06] ring-danger/40',
                )}
              >
                <div className="flex items-start gap-3">
                  <label className="tap relative z-10 -m-2.5 inline-flex shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-5 accent-olive"
                      checked={row.getIsSelected()}
                      onChange={row.getToggleSelectedHandler()}
                      aria-label={t('admin.orders.selectRow', { reference: o.reference })}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Link
                          to="/admin/orders/$id"
                          params={{ id: o.id }}
                          className="inline-flex min-h-11 items-center font-bold text-olive after:absolute after:inset-0 after:content-['']"
                          dir="ltr"
                        >
                          {o.reference}
                        </Link>
                        {!o.seenAt ? <NewBadge /> : null}
                      </span>
                      <span className="text-xs text-ink-soft tabular-nums">
                        {dateFmt.format(new Date(o.createdAt))}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium">
                      {o.customerName} · <span className="text-ink-soft">{o.city}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-bold tabular-nums">{formatMad(o.total, locale)}</span>
                      <StatusBadge status={o.status} />
                      <PaidBadge paid={Boolean(o.paidAt)} />
                    </div>
                  </div>
                  {isOwner ? (
                    <DeleteButton
                      label={t('admin.orders.deleteRow', { reference: o.reference })}
                      onClick={() => setToDelete([o.id])}
                      className="relative z-10 self-end"
                    />
                  ) : null}
                </div>
              </li>
            )
          })
        )}
      </ul>

      {/* Tablets and up: the full table. */}
      <div className="relative mt-4 hidden overflow-x-auto rounded-card bg-white shadow-lift ring-1 ring-sand-deep/50 xl:block">
        <table className="w-full text-start text-sm">
          <thead className="bg-sand/60 text-xs text-ink-soft">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} scope="col" className="px-3 py-3 text-start font-bold">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-sand-deep/50">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-soft">
                  {t('admin.orders.empty')}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'align-middle hover:bg-sand/30',
                    row.getIsSelected() && 'bg-oil-soft/40',
                    row.original.status === 'new' && 'border-s-4 border-s-oil',
                    !row.original.seenAt && 'border-s-4 border-s-danger bg-danger/[0.06]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <nav className="mt-4 flex items-center justify-between gap-3" aria-label="pagination">
        <Button
          variant="outline"
          size="md"
          disabled={data.page <= 1}
          onClick={() => navigate({ search: (prev) => ({ ...prev, page: data.page - 1 }) })}
        >
          {t('admin.orders.prev')}
        </Button>
        <span className="text-sm text-ink-soft">
          {t('admin.orders.pageOf', { page: data.page, pages })}
        </span>
        <Button
          variant="outline"
          size="md"
          disabled={data.page >= pages}
          onClick={() => navigate({ search: (prev) => ({ ...prev, page: data.page + 1 }) })}
        >
          {t('admin.orders.next')}
        </Button>
      </nav>
    </div>
  )
}

/** Red "new" pill on orders no admin has opened yet. */
function NewBadge() {
  const t = useT()
  return (
    <span className="notify-pulse inline-flex items-center rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
      {t('admin.orders.newBadge')}
    </span>
  )
}

function PaidBadge({ paid }: { paid: boolean }) {
  const t = useT()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        paid ? 'bg-olive-600/15 text-olive-700' : 'border border-sand-deep text-ink-soft',
      )}
    >
      {paid ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : null}
      {paid ? t('admin.orders.paid') : t('admin.orders.unpaid')}
    </span>
  )
}

function DeleteButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'tap inline-flex shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-danger/10 hover:text-danger',
        className,
      )}
    >
      <Trash2 className="size-5" aria-hidden="true" />
    </button>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
  allLabel: string
  className?: string
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(className, 'w-full')}
      >
        <option value="">
          {label}: {allLabel}
        </option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
