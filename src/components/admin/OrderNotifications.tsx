import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Bell, BellOff, BellRing, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocale, useT } from '~/i18n'
import { armAudioUnlock, audioUnlocked, chime, onAudioUnlock } from '~/lib/chime'
import { cn } from '~/lib/cn'
import { formatMad } from '~/lib/format'
import { adminMarkOrdersSeen, getUnseenOrders } from '~/server/functions/admin'

const SOUND_KEY = 'admin-new-order-sound'
const DISMISSED_KEY = 'admin-dismissed-orders'
const POLL_MS = 10_000

export const unseenQuery = {
  queryKey: ['admin', 'unseen'] as const,
  queryFn: () => getUnseenOrders(),
  refetchInterval: POLL_MS,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
  staleTime: 0,
}

/** Shared by the nav badge and the notifications (one request, one cache entry). */
export function useUnseenOrders() {
  return useQuery(unseenQuery)
}

function readSoundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0' // on by default
  } catch {
    return true
  }
}

const SOUND_EVENT = 'admin-sound-change'

/** The chime preference (on by default), shared by the bell and the notifications. */
function useSoundPref() {
  const [sound, setSound] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => {
    setSound(readSoundPref())
    armAudioUnlock()
    setUnlocked(audioUnlocked())
    const sync = () => setSound(readSoundPref())
    window.addEventListener(SOUND_EVENT, sync)
    const off = onAudioUnlock(() => setUnlocked(true))
    return () => {
      window.removeEventListener(SOUND_EVENT, sync)
      off()
    }
  }, [])
  function toggle() {
    const next = !sound
    try {
      localStorage.setItem(SOUND_KEY, next ? '1' : '0')
    } catch {}
    setSound(next)
    window.dispatchEvent(new Event(SOUND_EVENT))
    if (next) chime()
  }
  return { sound, unlocked, toggle }
}

/**
 * Live new-order notifications for the whole admin: a red card per unseen
 * order (bottom corner) that stays until the order is opened or the card is
 * closed, a chime when a new one arrives, and "(3)" in the tab title. Unseen
 * orders also stay red in the orders list until someone opens them.
 */
export function OrderNotifications() {
  const t = useT()
  const locale = useLocale()
  const { data } = useUnseenOrders()
  const queryClient = useQueryClient()
  const markSeen = useServerFn(adminMarkOrdersSeen)
  const known = useRef<Set<string> | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const { sound } = useSoundPref()

  // A closed notification stays closed while the tab is open (not only until the next page).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DISMISSED_KEY)
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])
  function dismiss(ids: string[]) {
    setDismissed((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      try {
        sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next].slice(-50)))
      } catch {}
      return next
    })
  }

  // Chime for orders that were not there at the previous poll (not on first load).
  useEffect(() => {
    if (!data) return
    const ids = data.latest.map((o) => o.id)
    if (known.current === null) {
      known.current = new Set(ids)
      return
    }
    const arrived = ids.filter((id) => !known.current?.has(id))
    known.current = new Set(ids)
    if (arrived.length && sound) chime()
    if (arrived.length) void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
    if (arrived.length) void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }, [data, sound, queryClient])

  // "(3) Admin": the count shows in the browser tab even when it is in the background.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = data?.count ? `(${data.count}) ${base}` : base
  }, [data?.count])

  async function markAllSeen() {
    await markSeen({ data: {} })
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const open = (data?.latest ?? []).filter((o) => !dismissed.has(o.id))
  const cards = open.slice(0, 1)
  const newest = open[0]
  const timeFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-MA', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <section
      aria-label={t('admin.notify.label')}
      aria-live="polite"
      data-print-hide
      className="pointer-events-none fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:end-4 sm:w-[22rem] lg:bottom-4"
    >
      {/* Phones: one slim bar, so the page underneath stays usable. */}
      {newest && data ? (
        <div className="notify-in pointer-events-auto flex items-center gap-2 rounded-full bg-danger py-1 ps-3 pe-1 text-white shadow-[0_12px_30px_-12px_rgb(163_39_27/0.8)] ring-1 ring-white/20 sm:hidden">
          <BellRing className="notify-ring size-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-bold">
              {data.count > 1
                ? t('admin.notify.countShort', { count: data.count })
                : t('admin.notify.title')}
            </span>{' '}
            · <bdi>{newest.customerName}</bdi>
          </p>
          {data.count > 1 ? (
            <Link
              to="/admin/orders"
              search={{ unseen: true }}
              className="tap inline-flex shrink-0 items-center rounded-full bg-white px-3 text-sm font-bold text-danger"
            >
              {t('admin.notify.view')}
            </Link>
          ) : (
            <Link
              to="/admin/orders/$id"
              params={{ id: newest.id }}
              className="tap inline-flex shrink-0 items-center rounded-full bg-white px-3 text-sm font-bold text-danger"
            >
              {t('admin.notify.open')}
            </Link>
          )}
          <button
            type="button"
            onClick={() => dismiss(open.map((o) => o.id))}
            aria-label={t('admin.notify.close')}
            className="tap inline-flex shrink-0 items-center justify-center rounded-full text-white/85 hover:bg-white/15"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {cards.map((o) => (
        <div
          key={o.id}
          className="notify-in pointer-events-auto relative hidden overflow-hidden rounded-card bg-danger sm:block text-white shadow-[0_18px_40px_-16px_rgb(163_39_27/0.8)] ring-1 ring-white/20"
        >
          <span aria-hidden="true" className="absolute inset-y-0 start-0 w-1.5 bg-white/40" />
          <div className="flex items-start gap-3 p-3 ps-4">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <BellRing className="notify-ring size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t('admin.notify.title')}</p>
              <p className="truncate text-sm text-white/90">
                <span dir="ltr" className="font-bold tabular-nums">
                  {o.reference}
                </span>{' '}
                · <bdi>{o.customerName}</bdi> · {o.city}
              </p>
              <p className="text-sm text-white/90 tabular-nums">
                {formatMad(o.total, locale)} · {timeFmt.format(new Date(o.createdAt))}
              </p>
              <Link
                to="/admin/orders/$id"
                params={{ id: o.id }}
                className="tap mt-1 inline-flex items-center rounded-full bg-white px-4 text-sm font-bold text-danger hover:bg-white/90"
              >
                {t('admin.notify.open')}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss([o.id])}
              aria-label={t('admin.notify.close')}
              className="tap -m-1 inline-flex items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {data && data.count > 1 && cards.length > 0 ? (
        <div className="pointer-events-auto hidden items-center justify-between gap-2 rounded-card bg-olive-950/95 sm:flex px-3 py-1 text-sm text-limewash shadow-lift">
          <span>{t('admin.notify.count', { count: data.count })}</span>
          <button
            type="button"
            onClick={markAllSeen}
            className="tap rounded-full px-2 font-bold text-oil-bright hover:bg-limewash/10"
          >
            {t('admin.notify.markAll')}
          </button>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Bell in the admin header: icon only. While the browser still blocks sound
 * (until the first tap or key on the page), a pulsing dot says so; tapping the
 * bell then unlocks it and rings once.
 */
export function SoundToggle({ className }: { className?: string }) {
  const t = useT()
  const { sound: on, unlocked, toggle } = useSoundPref()
  const blocked = on && !unlocked
  const label = blocked
    ? t('admin.notify.soundBlocked')
    : on
      ? t('admin.notify.soundOn')
      : t('admin.notify.soundOff')
  return (
    <button
      type="button"
      onClick={() => (blocked ? window.setTimeout(chime, 60) : toggle())}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        'tap relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
        on ? 'text-limewash hover:bg-limewash/10' : 'text-limewash/55 hover:bg-limewash/10',
        className,
      )}
    >
      {on ? (
        <Bell className={cn('size-5', !blocked && 'text-oil-bright')} aria-hidden="true" />
      ) : (
        <BellOff className="size-5" aria-hidden="true" />
      )}
      {blocked ? (
        <span aria-hidden="true" className="absolute end-2.5 top-2 flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-oil opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-oil-bright" />
        </span>
      ) : null}
    </button>
  )
}
