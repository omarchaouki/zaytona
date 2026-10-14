import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft, ArrowRight, BadgeCheck, Pencil, Phone, Printer, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatusBadge } from '~/components/admin/badges'
import { ConfirmDelete } from '~/components/admin/ConfirmDelete'
import { WhatsappIcon } from '~/components/icons'
import { Button } from '~/components/ui/button'
import type { OrderStatus } from '~/db/schema'
import { type MessageKey, useLocale, useT } from '~/i18n'
import { ORDER_STATUSES } from '~/lib/admin-orders'
import { describeAttribution } from '~/lib/attribution'
import { formatMad } from '~/lib/format'
import { formatPhoneDisplay } from '~/lib/phone'
import { fillTemplate, whatsappLink } from '~/lib/whatsapp'
import {
  adminDeleteOrders,
  adminMarkOrdersSeen,
  adminSetOrderStatus,
  adminSetOrdersPaid,
  adminUpdateOrder,
  getAdminOrder,
} from '~/server/functions/admin'

const orderQuery = (id: string) => ({
  queryKey: ['admin', 'order', id] as const,
  queryFn: () => getAdminOrder({ data: { id } }),
})

export const Route = createFileRoute('/admin/orders/$id')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQuery(params.id)),
  component: OrderPage,
})

type Detail = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>

function OrderPage() {
  const t = useT()
  const locale = useLocale()
  const { id } = Route.useParams()
  const { admin } = Route.useRouteContext()
  const { data } = useQuery({ ...orderQuery(id), initialData: Route.useLoaderData() })
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft
  const markSeen = useServerFn(adminMarkOrdersSeen)
  const queryClient = useQueryClient()
  const unseen = Boolean(data && !data.order.seenAt)

  // Opening an unseen order turns its red notification off, everywhere.
  useEffect(() => {
    if (!unseen) return
    void markSeen({ data: { ids: [id] } }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
    )
  }, [unseen, id, markSeen, queryClient])

  if (!data) {
    return (
      <div>
        <p className="text-lede">{t('admin.order.notFound')}</p>
        <Link to="/admin/orders" className="mt-4 inline-block underline">
          {t('admin.order.back')}
        </Link>
      </div>
    )
  }

  const { order } = data
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-MA', {
    timeZone: 'Africa/Casablanca',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div>
      <div data-print-hide>
        <Link
          to="/admin/orders"
          className="tap inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-olive"
        >
          <Back className="size-4" aria-hidden="true" />
          {t('admin.order.back')}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-h2 tabular-nums" dir="ltr">
            {order.reference}
          </h1>
          <StatusBadge status={order.status} />
          <PaidControl data={data} />
          <div className="flex w-full flex-wrap gap-g1 sm:ms-auto sm:w-auto">
            <Button variant="outline" size="md" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              {t('admin.order.print')}
            </Button>
            {admin.role === 'owner' ? <DeleteOrder data={data} /> : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {t('admin.order.placedOn', { date: dateFmt.format(new Date(order.createdAt)) })}
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <CustomerCard data={data} />
            <ItemsCard data={data} />
            <InternalNoteCard data={data} />
          </div>
          <div className="space-y-5">
            <StatusCard data={data} />
            <Timeline data={data} dateFmt={dateFmt} />
          </div>
        </div>
      </div>

      <PackingSlip data={data} dateFmt={dateFmt} />
    </div>
  )
}

/* ------------------------------------------------------------- helpers */

function Card({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-card bg-white p-5 shadow-lift ring-1 ring-sand-deep/50">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function useRefresh(id: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ])
}

function Feedback({ state }: { state: 'idle' | 'saved' | 'error' }) {
  const t = useT()
  if (state === 'idle') return null
  return (
    <p
      role="status"
      className={
        state === 'saved' ? 'text-sm font-medium text-olive-600' : 'text-sm font-medium text-danger'
      }
    >
      {state === 'saved' ? t('admin.order.saved') : t('admin.order.error')}
    </p>
  )
}

/* ------------------------------------------------------------ customer */

function CustomerCard({ data }: { data: Detail }) {
  const t = useT()
  const { order } = data
  const waText = fillTemplate(data.customerTemplate, {
    name: order.customerName.split(/\s+/)[0] ?? order.customerName,
    reference: order.reference,
  })
  const phoneDigits = order.phoneE164.replace(/^\+/, '')
  return (
    <Card title={t('admin.order.customer')}>
      <p className="text-lg font-bold">{order.customerName}</p>
      <p className="mt-0.5 tabular-nums text-ink-soft" dir="ltr">
        {formatPhoneDisplay(order.phoneE164)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="md">
          <a href={`tel:${order.phoneE164}`}>
            <Phone aria-hidden="true" />
            {t('admin.order.call')}
          </a>
        </Button>
        <Button asChild size="md" variant="whatsapp">
          <a href={whatsappLink(phoneDigits, waText)} target="_blank" rel="noopener noreferrer">
            <WhatsappIcon />
            {t('admin.order.whatsapp')}
          </a>
        </Button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Field label={t('admin.order.city')} value={order.city} />
        <Field
          label={t('admin.order.language')}
          value={order.locale === 'ar' ? 'العربية' : 'Français'}
        />
        {describeAttribution(order.attribution) ? (
          <Field
            label={t('admin.order.source')}
            value={describeAttribution(order.attribution) ?? ''}
            wide
          />
        ) : null}
        {order.address ? (
          <Field label={t('admin.order.address')} value={order.address} wide />
        ) : null}
        {order.note ? <Field label={t('admin.order.note')} value={order.note} wide /> : null}
      </dl>
    </Card>
  )
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-medium whitespace-pre-line">{value}</dd>
    </div>
  )
}

/* --------------------------------------------------------------- items */

function ItemsCard({ data }: { data: Detail }) {
  const t = useT()
  const locale = useLocale()
  const { order, items } = data
  const update = useServerFn(adminUpdateOrder)
  const refresh = useRefresh(order.id)
  const [editing, setEditing] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [fee, setFee] = useState<string>(order.deliveryFee ?? '')
  const [state, setState] = useState<'idle' | 'saved' | 'error' | 'empty'>('idle')

  async function save() {
    const deliveryFee = fee.trim() === '' ? null : Number(fee.replace(',', '.'))
    if (deliveryFee !== null && (!Number.isFinite(deliveryFee) || deliveryFee < 0)) {
      setState('error')
      return
    }
    try {
      const result = await update({ data: { id: order.id, quantities, deliveryFee } })
      if (!result.ok) return setState(result.reason === 'empty' ? 'empty' : 'error')
      setEditing(false)
      setQuantities({})
      setState('saved')
      await refresh()
    } catch {
      setState('error')
    }
  }

  return (
    <Card
      title={t('admin.order.items')}
      action={
        editing ? null : (
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setState('idle')
            }}
            className="tap inline-flex items-center gap-1.5 rounded-full px-3 text-sm text-olive hover:bg-sand"
          >
            <Pencil className="size-4" aria-hidden="true" />
            {t('admin.order.edit')}
          </button>
        )
      }
    >
      <table className="w-full text-sm">
        <thead className="text-xs text-ink-soft">
          <tr>
            <th className="pb-2 text-start font-medium">{t('admin.order.items')}</th>
            <th className="pb-2 text-center font-medium">{t('admin.order.quantity')}</th>
            <th className="pb-2 text-end font-medium">{t('admin.order.lineTotal')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-deep/50">
          {items.map((item) => {
            const q = quantities[item.id] ?? item.quantity
            return (
              <tr key={item.id}>
                <td className="py-2.5">
                  <p className="font-medium">{item.productNameSnapshot}</p>
                  <p className="text-xs text-ink-soft tabular-nums">
                    {formatMad(item.unitPriceSnapshot, locale)}
                  </p>
                </td>
                <td className="py-2.5 text-center tabular-nums">
                  {editing ? (
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={q}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      aria-label={`${t('admin.order.quantity')} — ${item.productNameSnapshot}`}
                      className="field-input min-h-10 w-20 text-center"
                    />
                  ) : (
                    q
                  )}
                </td>
                <td className="py-2.5 text-end tabular-nums">
                  {formatMad(Number(item.unitPriceSnapshot) * q, locale)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1.5 border-t border-sand-deep pt-3 text-sm">
        <Row label={t('admin.order.subtotal')} value={formatMad(order.subtotal, locale)} />
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-soft">{t('admin.order.deliveryFee')}</dt>
          <dd className="tabular-nums">
            {editing ? (
              <input
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                aria-label={t('admin.order.deliveryFeeLabel')}
                placeholder="—"
                className="field-input min-h-10 w-28 text-end"
              />
            ) : order.deliveryFee === null ? (
              t('admin.order.deliveryTbc')
            ) : (
              formatMad(order.deliveryFee, locale)
            )}
          </dd>
        </div>
        <Row label={t('admin.order.total')} value={formatMad(order.total, locale)} strong />
      </dl>

      {editing ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-ink-soft">
            {t('admin.order.deliveryFeeLabel')}. {t('admin.order.removeHint')}
          </p>
          <div className="flex gap-2">
            <Button size="md" onClick={save}>
              {t('admin.order.save')}
            </Button>
            <Button
              size="md"
              variant="outline"
              onClick={() => {
                setEditing(false)
                setQuantities({})
                setFee(order.deliveryFee ?? '')
                setState('idle')
              }}
            >
              {t('admin.order.cancelEdit')}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-2">
        {state === 'empty' ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t('admin.order.emptyError')}
          </p>
        ) : (
          <Feedback state={state} />
        )}
      </div>
    </Card>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? 'font-bold text-olive' : 'text-ink-soft'}>{label}</dt>
      <dd className={strong ? 'font-bold text-olive tabular-nums' : 'tabular-nums'}>{value}</dd>
    </div>
  )
}

/* -------------------------------------------------------------- status */

function StatusCard({ data }: { data: Detail }) {
  const t = useT()
  const { order } = data
  const setStatus = useServerFn(adminSetOrderStatus)
  const refresh = useRefresh(order.id)
  const [status, setStatusValue] = useState<OrderStatus>(order.status)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')

  async function apply() {
    try {
      await setStatus({ data: { ids: [order.id], status, note: note || undefined } })
      setNote('')
      setState('saved')
      await refresh()
    } catch {
      setState('error')
    }
  }

  return (
    <Card title={t('admin.order.status')}>
      {/* As many columns as fit (1 to 3), never narrower than "Confirmée". */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {ORDER_STATUSES.map((s) => (
          <label
            key={s}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-field border border-sand-deep px-3 py-2 text-sm has-[:checked]:border-olive has-[:checked]:bg-olive/5"
          >
            <input
              type="radio"
              name="status"
              value={s}
              checked={status === s}
              onChange={() => setStatusValue(s)}
              className="accent-olive"
            />
            {t(`admin.status.${s}`)}
          </label>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-ink-soft">{t('admin.order.statusNote')}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          className="field-input min-h-10"
        />
      </label>
      <Button
        size="md"
        className="mt-3"
        disabled={status === order.status && !note}
        onClick={apply}
      >
        {t('admin.order.changeStatus')}
      </Button>
      <div className="mt-2">
        <Feedback state={state} />
      </div>
    </Card>
  )
}

/* --------------------------------------------------------- note, timeline */

function InternalNoteCard({ data }: { data: Detail }) {
  const t = useT()
  const update = useServerFn(adminUpdateOrder)
  const refresh = useRefresh(data.order.id)
  const [note, setNote] = useState(data.order.internalNote ?? '')
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  return (
    <Card title={t('admin.order.internalNote')}>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setState('idle')
        }}
        rows={3}
        maxLength={2000}
        aria-label={t('admin.order.internalNote')}
        className="field-input py-3"
      />
      <p className="mt-1.5 text-xs text-ink-soft">{t('admin.order.internalHint')}</p>
      <div className="mt-3 flex items-center gap-3">
        <Button
          size="md"
          variant="outline"
          disabled={note === (data.order.internalNote ?? '')}
          onClick={async () => {
            try {
              await update({ data: { id: data.order.id, internalNote: note } })
              setState('saved')
              await refresh()
            } catch {
              setState('error')
            }
          }}
        >
          {t('admin.order.save')}
        </Button>
        <Feedback state={state} />
      </div>
    </Card>
  )
}

/** System notes are stored as stable English codes; show them in the admin's language. */
const EVENT_NOTES: Record<string, MessageKey> = {
  'placed on website': 'admin.event.placed',
  'placed on website, awaiting deposit': 'admin.event.placedDeposit',
  'deposit received': 'admin.event.depositReceived',
  'deposit waived': 'admin.event.depositWaived',
  'deposit reset to pending': 'admin.event.depositPending',
  'order edited': 'admin.event.edited',
  'marked paid': 'admin.event.paid',
  'payment cancelled': 'admin.event.unpaid',
}

function Timeline({ data, dateFmt }: { data: Detail; dateFmt: Intl.DateTimeFormat }) {
  const t = useT()
  const noteText = (note: string) => {
    const known = EVENT_NOTES[note]
    if (known) return t(known)
    const [head, ...rest] = note.split(': ')
    const prefix = head ? EVENT_NOTES[head] : undefined
    return prefix ? `${t(prefix)}: ${rest.join(': ')}` : note
  }
  return (
    <Card title={t('admin.order.timeline')}>
      <ol className="relative space-y-4 border-s-2 border-sand-deep ps-4">
        {data.events.map((e) => (
          <li key={e.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full bg-olive-600 ring-4 ring-white"
            />
            <p className="text-sm">
              {e.toStatus ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {e.fromStatus ? <StatusBadge status={e.fromStatus} /> : null}
                  {e.fromStatus ? <span aria-hidden="true">→</span> : null}
                  <StatusBadge status={e.toStatus} />
                </span>
              ) : null}
              {e.note ? <span className="block text-ink">{noteText(e.note)}</span> : null}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {dateFmt.format(new Date(e.createdAt))} · {e.adminEmail ?? t('admin.order.system')}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** Owner only: confirm, soft delete, back to the list. */
function DeleteOrder({ data }: { data: Detail }) {
  const t = useT()
  const remove = useServerFn(adminDeleteOrders)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="md"
        className="border-danger/40 text-danger hover:bg-danger/5"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" />
        {t('admin.orders.delete')}
      </Button>
      <ConfirmDelete
        open={open}
        onOpenChange={setOpen}
        count={1}
        onConfirm={async () => {
          await remove({ data: { ids: [data.order.id] } })
          await queryClient.invalidateQueries({ queryKey: ['admin'] })
          await navigate({ to: '/admin/orders' })
        }}
      />
    </>
  )
}

/* ----------------------------------------------------------------- paid */

/** "Paid" badge with the date, or a button to record the cash; undo from the badge. */
function PaidControl({ data }: { data: Detail }) {
  const t = useT()
  const locale = useLocale()
  const setPaid = useServerFn(adminSetOrdersPaid)
  const refresh = useRefresh(data.order.id)
  const [busy, setBusy] = useState(false)
  const paidAt = data.order.paidAt
  async function toggle(paid: boolean) {
    setBusy(true)
    try {
      await setPaid({ data: { ids: [data.order.id], paid } })
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  if (paidAt) {
    const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-MA', {
      timeZone: 'Africa/Casablanca',
      dateStyle: 'medium',
    }).format(new Date(paidAt))
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-olive-600/15 py-0.5 ps-2.5 pe-1 text-xs font-bold text-olive-700">
        <BadgeCheck className="size-4" aria-hidden="true" />
        {t('admin.order.paidOn', { date })}
        <button
          type="button"
          disabled={busy}
          onClick={() => toggle(false)}
          className="tap -my-3 rounded-full px-2 font-medium text-ink-soft underline underline-offset-2 hover:text-danger"
        >
          {t('admin.orders.markUnpaid')}
        </button>
      </span>
    )
  }
  return (
    <Button
      size="md"
      disabled={busy}
      onClick={() => toggle(true)}
      className="bg-olive-600 text-limewash hover:bg-olive-700"
    >
      <BadgeCheck aria-hidden="true" />
      {t('admin.orders.markPaid')}
    </Button>
  )
}

/* --------------------------------------------------------- packing slip */

function PackingSlip({ data, dateFmt }: { data: Detail; dateFmt: Intl.DateTimeFormat }) {
  const t = useT()
  const locale = useLocale()
  const { order, items } = data
  return (
    <section className="print-only text-black" aria-hidden="true">
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-xl font-bold">{data.cooperativeName}</p>
          <p className="text-sm">{t('admin.order.slipTitle')}</p>
        </div>
        <div className="text-end">
          <p className="text-2xl font-bold tabular-nums" dir="ltr">
            {order.reference}
          </p>
          <p className="text-sm">{dateFmt.format(new Date(order.createdAt))}</p>
        </div>
      </div>
      <div className="mt-4 text-lg">
        <p className="font-bold">{order.customerName}</p>
        <p dir="ltr" className="tabular-nums">
          {formatPhoneDisplay(order.phoneE164)}
        </p>
        <p>{order.city}</p>
        {order.address ? <p className="whitespace-pre-line">{order.address}</p> : null}
      </div>
      <table className="mt-4 w-full border-collapse text-base">
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-black/30">
              <td className="py-2">{i.productNameSnapshot}</td>
              <td className="py-2 text-end font-bold tabular-nums">× {i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-4 space-y-1 text-base">
        <div className="flex justify-between">
          <dt>{t('admin.order.total')}</dt>
          <dd className="tabular-nums">{formatMad(order.total, locale)}</dd>
        </div>
        <div className="flex justify-between border-t-2 border-black pt-2 text-xl font-bold">
          <dt>{t('admin.order.slipCollect')}</dt>
          <dd className="tabular-nums">
            {formatMad(order.total, locale)}
            {order.deliveryFee === null ? ` + ${t('admin.order.deliveryFee')}` : ''}
          </dd>
        </div>
      </dl>
    </section>
  )
}
