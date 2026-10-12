import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock,
  MessageCircle,
  Package,
  PackageCheck,
  Truck,
  Wallet,
} from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { StatusBadge } from '~/components/admin/badges'
import { useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatMad, formatNumber } from '~/lib/format'
import { getDashboard } from '~/server/functions/admin'

const dashboardQuery = {
  queryKey: ['admin', 'dashboard'] as const,
  queryFn: () => getDashboard(),
  refetchInterval: 30_000,
  refetchIntervalInBackground: true,
}

export const Route = createFileRoute('/admin/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
})

type OrdersSearch = {
  status?: 'new' | 'confirmed' | 'delivered'
  paid?: 'paid' | 'unpaid'
}

/*
 * Mobile-first dashboard, in the order the cooperative looks at things:
 * 1. money (cash recorded as received, this month, delivered but unpaid),
 * 2. what needs doing now (new, to deliver), then the counters,
 * 3. setup reminders folded into one line, 4. the 30-day chart, 5. latest orders.
 * Every number that maps to a list opens the orders filtered to it.
 */
function Dashboard() {
  const t = useT()
  const locale = useLocale()
  const { data } = useQuery({ ...dashboardQuery, initialData: Route.useLoaderData() })
  const n = (v: number) => formatNumber(v, locale)
  const warnings = [
    data.warnings.noWhatsapp ? t('admin.dashboard.warnNoWhatsapp') : null,
    data.warnings.demoPrice ? t('admin.dashboard.warnDemoPrice') : null,
    data.warnings.demoProducts > 0
      ? t('admin.dashboard.warnDemo', { count: data.warnings.demoProducts })
      : null,
    data.warnings.demoReviews > 0
      ? t('admin.dashboard.warnDemoReviews', { count: data.warnings.demoReviews })
      : null,
  ].filter((w): w is string => Boolean(w))

  return (
    <div className="space-y-g3 lg:space-y-g4">
      <header>
        <h1 className="text-h2">{t('admin.dashboard.title')}</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
          <span className="notify-pulse size-2 rounded-full bg-olive-600" aria-hidden="true" />
          {t('admin.dashboard.autoRefresh')}
        </p>
      </header>

      <div className="grid gap-g3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start [&>*]:min-w-0">
        {/* 1. Money */}
        <section
          aria-labelledby="money-title"
          className="overflow-hidden rounded-[20px] bg-olive-950 text-limewash shadow-lift"
        >
          <Link
            to="/admin/orders"
            search={{ paid: 'paid' } satisfies OrdersSearch}
            className="block px-g3 pt-g3 pb-g2 transition-colors hover:bg-limewash/[0.04]"
          >
            <p id="money-title" className="flex items-center gap-2 text-sm text-limewash/75">
              <Wallet className="size-4 text-oil-bright" aria-hidden="true" />
              {t('admin.dashboard.paidTotal')}
            </p>
            <p className="mt-1 font-display text-[2.25rem] leading-tight font-bold text-oil-bright tabular-nums">
              {formatMad(data.paid.amount, locale)}
            </p>
            <p className="text-sm text-limewash/70">
              {t('admin.dashboard.paidCount', { count: n(data.paid.count) })}
            </p>
          </Link>
          <div className="grid grid-cols-2 divide-x divide-limewash/10 border-t border-limewash/10 rtl:divide-x-reverse">
            <MoneyCell
              Icon={BadgeCheck}
              label={t('admin.dashboard.paidMonth')}
              amount={formatMad(data.paid.monthAmount, locale)}
              sub={t('admin.dashboard.ordersCount', { count: n(data.paid.monthCount) })}
              search={{ paid: 'paid' }}
            />
            <MoneyCell
              Icon={AlertTriangle}
              label={t('admin.dashboard.unpaidDelivered')}
              amount={formatMad(data.unpaidDelivered.amount, locale)}
              sub={t('admin.dashboard.ordersCount', { count: n(data.unpaidDelivered.count) })}
              search={{ status: 'delivered', paid: 'unpaid' }}
              warn={data.unpaidDelivered.count > 0}
            />
          </div>
        </section>

        {/* 2. What needs doing, then the counters */}
        <section aria-label={t('admin.dashboard.title')}>
          <ul className="grid grid-cols-2 gap-g1 sm:gap-g2">
            <Stat
              Icon={Clock}
              label={t('admin.dashboard.pending')}
              value={n(data.pending)}
              search={{ status: 'new' }}
              highlight={data.pending > 0}
            />
            <Stat
              Icon={Truck}
              label={t('admin.dashboard.toDeliver')}
              value={n(data.toDeliver.count)}
              sub={formatMad(data.toDeliver.amount, locale)}
              search={{ status: 'confirmed' }}
            />
            <Stat Icon={Package} label={t('admin.dashboard.today')} value={n(data.today)} />
            <Stat
              Icon={PackageCheck}
              label={t('admin.dashboard.delivered')}
              value={n(data.delivered)}
              search={{ status: 'delivered' }}
            />
            <Stat Icon={Package} label={t('admin.dashboard.total')} value={n(data.total)} />
            <Stat
              Icon={MessageCircle}
              label={t('admin.dashboard.whatsappClicks')}
              value={n(data.whatsappClicks30)}
            />
          </ul>
        </section>
      </div>

      {/* 3. Setup reminders, folded */}
      {warnings.length ? (
        <details className="group rounded-card border border-oil/60 bg-oil-soft/50 text-sm">
          <summary className="tap flex cursor-pointer list-none items-center gap-2 px-g2 font-bold text-oil-deep [&::-webkit-details-marker]:hidden">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('admin.dashboard.warningsTitle', { count: warnings.length })}
            <ChevronDown
              className="ms-auto size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="space-y-2 px-g2 pb-g2 text-ink">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-oil-deep"
                  aria-hidden="true"
                />
                {w}
              </li>
            ))}
            <li className="text-xs text-ink-soft">{t('admin.dashboard.settingsSoon')}</li>
          </ul>
        </details>
      ) : null}

      <div className="grid gap-g3 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
        {/* 4. Last 30 days */}
        <Chart days={data.days} />

        {/* 5. Latest orders */}
        <section aria-labelledby="latest-title">
          <div className="flex items-center justify-between">
            <h2 id="latest-title" className="text-h3">
              {t('admin.dashboard.latest')}
            </h2>
            <Link
              to="/admin/orders"
              className="tap inline-flex items-center px-1 text-sm font-medium text-olive underline underline-offset-4"
            >
              {t('admin.dashboard.seeAll')}
            </Link>
          </div>
          {data.latest.length === 0 ? (
            <p className="mt-g1 rounded-card bg-white p-g3 text-ink-soft">
              {t('admin.dashboard.empty')}
            </p>
          ) : (
            <ul className="mt-g1 divide-y divide-sand-deep/60 overflow-hidden rounded-card bg-white shadow-lift ring-1 ring-sand-deep/50">
              {data.latest.map((o) => (
                <LatestRow key={o.id} order={o} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function MoneyCell({
  Icon,
  label,
  amount,
  sub,
  search,
  warn,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  amount: string
  sub: string
  search: OrdersSearch
  warn?: boolean
}) {
  return (
    <Link
      to="/admin/orders"
      search={search}
      className={cn(
        'block min-w-0 px-g2 py-g2 transition-colors hover:bg-limewash/[0.04] sm:px-g3',
        warn && 'bg-oil/15',
      )}
    >
      <p className="flex items-start gap-1.5 text-xs leading-snug text-limewash/70">
        <Icon
          className={cn('mt-px size-3.5 shrink-0', warn ? 'text-oil-bright' : 'text-olive-400')}
          aria-hidden="true"
        />
        {label}
      </p>
      <p className="mt-1 text-lg leading-tight font-bold break-words text-limewash tabular-nums sm:text-xl">
        {amount}
      </p>
      <p className="text-xs text-limewash/60">{sub}</p>
    </Link>
  )
}

function Stat({
  Icon,
  label,
  value,
  sub,
  search,
  highlight,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  value: string
  sub?: string
  search?: OrdersSearch
  highlight?: boolean
}) {
  const body: ReactNode = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm leading-snug text-ink-soft">{label}</span>
        <Icon
          className={cn('size-4 shrink-0', highlight ? 'text-danger' : 'text-olive-600')}
          aria-hidden="true"
        />
      </span>
      <span
        className={cn(
          'mt-1 block font-display text-[1.75rem] leading-none font-bold tabular-nums',
          highlight ? 'text-danger' : 'text-olive',
        )}
      >
        {value}
      </span>
      {sub ? <span className="mt-1 block text-xs text-oil-deep tabular-nums">{sub}</span> : null}
    </>
  )
  const cls = cn(
    'flex h-full flex-col rounded-card bg-white p-g2 shadow-lift ring-1 ring-sand-deep/50',
    highlight && 'ring-2 ring-danger/50',
  )
  return (
    <li>
      {search ? (
        <Link
          to="/admin/orders"
          search={search}
          className={cn(cls, 'transition-transform active:scale-[0.98] hover:-translate-y-0.5')}
        >
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}

function Chart({ days }: { days: Array<{ day: string; count: number }> }) {
  const t = useT()
  const locale = useLocale()
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((s, d) => s + d.count, 0)
  return (
    <section
      aria-labelledby="chart-title"
      className="rounded-card bg-white p-g2 shadow-lift ring-1 ring-sand-deep/50 sm:p-g3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="chart-title" className="text-h3">
          {t('admin.dashboard.chartTitle')}
        </h2>
        <span className="text-sm font-bold text-olive tabular-nums">
          {t('admin.dashboard.ordersCount', { count: formatNumber(total, locale) })}
        </span>
      </div>
      {/* Bars read left → right (oldest → today) in both languages, like a calendar. */}
      <div className="mt-g2 flex h-28 items-end gap-[2px] sm:h-36 sm:gap-[3px]" dir="ltr">
        {days.map((d) => {
          const label = t('admin.dashboard.chartLabel', { count: d.count, day: d.day.slice(5) })
          return (
            <div key={d.day} title={label} className="group flex h-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-t-[2px] transition-colors',
                  d.count ? 'bg-olive-600 group-hover:bg-oil' : 'bg-sand',
                )}
                style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              />
              <span className="sr-only">{label}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-soft tabular-nums" dir="ltr">
        <span>{days[0]?.day.slice(5)}</span>
        <span>{days.at(-1)?.day.slice(5)}</span>
      </div>
    </section>
  )
}

function LatestRow({
  order: o,
}: {
  order: {
    id: string
    reference: string
    customerName: string
    city: string
    total: string
    status: Parameters<typeof StatusBadge>[0]['status']
    createdAt: Date | string
  }
}) {
  const locale = useLocale()
  const Chevron = locale === 'ar' ? ArrowLeft : ArrowRight
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-MA', {
    timeZone: 'Africa/Casablanca',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <li>
      <Link
        to="/admin/orders/$id"
        params={{ id: o.id }}
        className="flex items-center gap-g1 px-g2 py-3 transition-colors hover:bg-sand/40 active:bg-sand/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-bold text-ink">{o.customerName}</span>
            <span className="shrink-0 font-bold text-olive tabular-nums">
              {formatMad(o.total, locale)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-ink-soft">
            <span className="min-w-0 truncate">
              <span dir="ltr" className="tabular-nums">
                {o.reference}
              </span>{' '}
              · {o.city}
            </span>
            <StatusBadge status={o.status} />
          </div>
          <p className="mt-0.5 text-xs text-ink-soft tabular-nums">
            {dateFmt.format(new Date(o.createdAt))}
          </p>
        </div>
        <Chevron className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
      </Link>
    </li>
  )
}
