import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { BadgeCheck, Check, Pencil, Pin, PinOff, Search, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Picture } from '~/components/Picture'
import { Stars } from '~/components/reviews/Stars'
import { Button } from '~/components/ui/button'
import { type MessageKey, useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import {
  adminDeleteReviews,
  adminEditReview,
  adminGetReviews,
  adminModerateReviews,
} from '~/server/functions/reviews'

const STATUSES = ['pending', 'approved', 'rejected'] as const
type Status = (typeof STATUSES)[number]

const searchSchema = z.object({
  status: z
    .enum([...STATUSES, 'all'])
    .optional()
    .catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
})

const reviewsQuery = (status: Status | undefined, q: string | undefined) => ({
  queryKey: ['admin', 'reviews', status ?? 'all', q ?? ''] as const,
  queryFn: () => adminGetReviews({ data: { status, q } }),
  refetchInterval: 30_000,
})

export const Route = createFileRoute('/admin/reviews')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const status = deps.status === 'all' ? undefined : (deps.status ?? 'pending')
    return context.queryClient.ensureQueryData(reviewsQuery(status, deps.q))
  },
  component: ReviewsAdmin,
})

type Row = Awaited<ReturnType<typeof adminGetReviews>>['rows'][number]

function ReviewsAdmin() {
  const t = useT()
  const { admin } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/admin/reviews' })
  const queryClient = useQueryClient()
  const status = search.status === 'all' ? undefined : (search.status ?? 'pending')
  const { data } = useQuery({
    ...reviewsQuery(status, search.q),
    initialData: Route.useLoaderData(),
  })
  const moderate = useServerFn(adminModerateReviews)
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [q, setQ] = useState(search.q ?? '')

  useEffect(() => {
    const id = window.setTimeout(() => {
      if ((search.q ?? '') !== q) void navigate({ search: (p) => ({ ...p, q: q || undefined }) })
    }, 350)
    return () => window.clearTimeout(id)
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  async function bulk(type: 'approve' | 'reject') {
    const res = await moderate({ data: { ids: selected, action: { type } } })
    setSelected([])
    setMessage(t('admin.reviews.done', { count: res.changed }))
    await refresh()
  }

  const tabs: Array<{ key: Status | 'all'; label: MessageKey; count?: number }> = [
    { key: 'pending', label: 'admin.reviews.pending', count: data.counts.pending },
    { key: 'approved', label: 'admin.reviews.approved', count: data.counts.approved },
    { key: 'rejected', label: 'admin.reviews.rejected', count: data.counts.rejected },
    { key: 'all', label: 'admin.reviews.all' },
  ]
  const current = search.status ?? 'pending'

  return (
    <div>
      <h1 className="text-h2">{t('admin.reviews.title')}</h1>

      <div className="mt-g3 flex flex-col gap-g1 sm:flex-row sm:items-center">
        {/* Segmented control: four equal parts on phones, natural widths from 640px. */}
        <div
          className="grid grid-cols-4 gap-1 rounded-full bg-white p-1 ring-1 ring-sand-deep sm:inline-flex sm:gap-g1"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={current === tab.key}
              onClick={() => {
                setSelected([])
                void navigate({ search: (p) => ({ ...p, status: tab.key }) })
              }}
              className={cn(
                'tap inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium transition-colors sm:px-4',
                current === tab.key ? 'bg-olive text-limewash' : 'text-ink hover:bg-sand',
              )}
            >
              {t(tab.label)}
              {tab.count ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                    tab.key === 'pending' ? 'bg-oil text-olive-950' : 'bg-sand-deep/70 text-ink',
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:ms-auto sm:w-64">
          <span className="sr-only">{t('admin.reviews.search')}</span>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.reviews.search')}
            className="field-input min-h-11 ps-9"
          />
        </label>
      </div>

      {selected.length > 0 ? (
        <div className="sticky top-14 z-20 mt-g2 flex flex-wrap items-center gap-g2 rounded-card bg-olive-950 px-4 py-3 text-limewash shadow-lift lg:top-2">
          <span className="font-bold">
            {t('admin.reviews.selected', { count: selected.length })}
          </span>
          <Button
            size="md"
            className="bg-oil text-olive-950 hover:bg-oil-bright"
            onClick={() => bulk('approve')}
          >
            <Check aria-hidden="true" />
            {t('admin.reviews.bulkApprove')}
          </Button>
          <Button
            size="md"
            variant="outline"
            className="border-limewash/30 text-limewash hover:bg-limewash/10"
            onClick={() => bulk('reject')}
          >
            <X aria-hidden="true" />
            {t('admin.reviews.bulkReject')}
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="mt-g2 text-sm font-medium text-olive-600">
          {message}
        </p>
      ) : null}

      {data.rows.length === 0 ? (
        <p className="mt-g3 rounded-card bg-white p-g4 text-center text-ink-soft">
          {t('admin.reviews.empty')}
        </p>
      ) : (
        <ul className="mt-g3 space-y-g2">
          {data.rows.map((row) => (
            <ReviewRow
              key={row.id}
              row={row}
              isOwner={admin.role === 'owner'}
              selected={selected.includes(row.id)}
              onSelect={(on) =>
                setSelected((prev) => (on ? [...prev, row.id] : prev.filter((id) => id !== row.id)))
              }
              onChanged={refresh}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewRow({
  row,
  isOwner,
  selected,
  onSelect,
  onChanged,
}: {
  row: Row
  isOwner: boolean
  selected: boolean
  onSelect: (on: boolean) => void
  onChanged: () => Promise<unknown>
}) {
  const t = useT()
  const locale = useLocale()
  const moderate = useServerFn(adminModerateReviews)
  const remove = useServerFn(adminDeleteReviews)
  const edit = useServerFn(adminEditReview)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState(row.comment)
  const [replyAr, setReplyAr] = useState(row.replyAr ?? '')
  const [replyFr, setReplyFr] = useState(row.replyFr ?? '')
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-MA', {
    timeZone: 'Africa/Casablanca',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(row.createdAt))

  async function act(action: Parameters<typeof moderate>[0]['data']['action']) {
    await moderate({ data: { ids: [row.id], action } })
    setRejecting(false)
    await onChanged()
  }

  return (
    <li
      className={cn(
        'rounded-card bg-white p-g2 shadow-lift ring-1 sm:p-g3',
        selected ? 'ring-2 ring-oil' : 'ring-sand-deep/50',
        row.status === 'pending' && 'border-s-4 border-s-oil',
      )}
    >
      <div className="flex items-start gap-g2">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-olive"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={t('admin.reviews.selectRow', { name: row.authorName })}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-g1 gap-y-1">
            <p className="font-bold">{row.authorName}</p>
            {row.city ? <p className="text-sm text-ink-soft">· {row.city}</p> : null}
            <Stars value={row.rating} size="sm" />
            {row.isFeatured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-oil-soft px-2 py-0.5 text-xs font-bold text-oil-deep">
                <Pin className="size-3" aria-hidden="true" />
                {t('admin.reviews.featured')}
              </span>
            ) : null}
            <span className="text-xs text-ink-soft">{date}</span>
            {row.isDemo ? (
              <span className="rounded-full bg-ink/80 px-2 py-0.5 text-xs font-medium text-limewash">
                {t('reviews.demo')}
              </span>
            ) : null}
          </div>
          {row.verified && row.orderReference ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-olive-600">
              <BadgeCheck className="size-4" aria-hidden="true" />
              {t('admin.reviews.verified', { reference: row.orderReference })}
            </p>
          ) : null}

          {editing ? (
            <div className="mt-g2 space-y-g2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-olive">
                  {t('admin.reviews.comment')}
                </span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={600}
                  className="field-input py-3"
                  dir="auto"
                />
              </label>
              <div className="grid gap-g2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-olive">
                    {t('admin.reviews.replyAr')}
                  </span>
                  <textarea
                    value={replyAr}
                    onChange={(e) => setReplyAr(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="field-input py-3"
                    dir="rtl"
                    lang="ar"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-olive">
                    {t('admin.reviews.replyFr')}
                  </span>
                  <textarea
                    value={replyFr}
                    onChange={(e) => setReplyFr(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="field-input py-3"
                    dir="ltr"
                    lang="fr"
                  />
                </label>
              </div>
              <div className="flex gap-g1">
                <Button
                  size="md"
                  onClick={async () => {
                    await edit({
                      data: {
                        id: row.id,
                        comment: comment.trim() !== row.comment ? comment : undefined,
                        replyAr: replyAr || null,
                        replyFr: replyFr || null,
                      },
                    })
                    setEditing(false)
                    await onChanged()
                  }}
                >
                  {t('admin.reviews.save')}
                </Button>
                <Button size="md" variant="outline" onClick={() => setEditing(false)}>
                  {t('admin.trust.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-g1 whitespace-pre-line" dir="auto">
                {row.comment}
              </p>
              {row.originalComment ? (
                <p className="mt-1 text-xs text-ink-soft" dir="auto">
                  {t('admin.reviews.original', { text: row.originalComment })}
                </p>
              ) : null}
              {row.replyAr || row.replyFr ? (
                <div className="mt-g1 rounded-field border-s-4 border-oil bg-sand/60 px-g2 py-g1 text-sm">
                  {row.replyAr ? <p dir="rtl">{row.replyAr}</p> : null}
                  {row.replyFr ? <p dir="ltr">{row.replyFr}</p> : null}
                </div>
              ) : null}
            </>
          )}

          {row.photo ? (
            <a
              href={row.photo.fallback}
              target="_blank"
              rel="noreferrer"
              className="mt-g2 inline-block overflow-hidden rounded-field ring-1 ring-sand-deep"
              aria-label={t('admin.reviews.photo')}
            >
              <Picture image={row.photo} alt="" sizes="6rem" className="block size-24" />
            </a>
          ) : null}

          {row.status === 'rejected' && row.rejectionReason ? (
            <p className="mt-g1 text-sm text-danger">
              {t('admin.reviews.rejection', { reason: row.rejectionReason })}
            </p>
          ) : null}

          {rejecting ? (
            <div className="mt-g2 flex flex-wrap items-end gap-g1">
              <label className="block min-w-[14rem] flex-1">
                <span className="mb-1 block text-sm font-medium text-olive">
                  {t('admin.reviews.rejectReason')}
                </span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  className="field-input min-h-11"
                />
              </label>
              <Button
                size="md"
                variant="outline"
                className="border-danger/40 text-danger"
                onClick={() => act({ type: 'reject', reason: reason || undefined })}
              >
                {t('admin.reviews.reject')}
              </Button>
              <Button size="md" variant="ghost" onClick={() => setRejecting(false)}>
                {t('admin.trust.cancel')}
              </Button>
            </div>
          ) : (
            <div className="mt-g2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">
              {row.status !== 'approved' ? (
                <Button
                  size="md"
                  className="col-span-2 bg-oil text-olive-950 hover:bg-oil-bright"
                  onClick={() => act({ type: 'approve' })}
                >
                  <Check aria-hidden="true" />
                  {t('admin.reviews.approve')}
                </Button>
              ) : null}
              {row.status !== 'rejected' ? (
                <Button size="md" variant="outline" onClick={() => setRejecting(true)}>
                  <X aria-hidden="true" />
                  {t('admin.reviews.reject')}
                </Button>
              ) : null}
              <Button
                size="md"
                variant="outline"
                onClick={() => act({ type: 'feature', featured: !row.isFeatured })}
              >
                {row.isFeatured ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                {row.isFeatured ? t('admin.reviews.unfeature') : t('admin.reviews.feature')}
              </Button>
              <Button size="md" variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {t('admin.reviews.edit')}
              </Button>
              {isOwner ? (
                <Button
                  size="md"
                  variant="outline"
                  className="border-danger/40 text-danger hover:bg-danger/5"
                  onClick={async () => {
                    if (!window.confirm(t('admin.reviews.deleteConfirm'))) return
                    await remove({ data: { ids: [row.id] } })
                    await onChanged()
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  {t('admin.reviews.delete')}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
