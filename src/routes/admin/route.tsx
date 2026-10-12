import { useQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  Droplets,
  ExternalLink,
  KeyRound,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Package,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Dialog } from 'radix-ui'
import { type ComponentType, type SVGProps, useState } from 'react'
import {
  OrderNotifications,
  SoundToggle,
  useUnseenOrders,
} from '~/components/admin/OrderNotifications'
import { ArchMark } from '~/components/icons'
import { Button } from '~/components/ui/button'
import { type MessageKey, translate, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { setClientCsrfToken } from '~/lib/csrf-client'
import { adminLogout, adminSetLocale, getAdminSession } from '~/server/functions/admin'
import { adminPendingReviews } from '~/server/functions/reviews'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const session = await getAdminSession()
    if (!session) {
      throw redirect({ to: '/admin/login', search: { redirect: location.href } })
    }
    if (session.admin.mustChangePassword && location.pathname !== '/admin/password') {
      throw redirect({ to: '/admin/password' })
    }
    if (typeof window !== 'undefined') setClientCsrfToken(session.csrfToken)
    return { admin: session.admin, csrfToken: session.csrfToken, uiLocale: session.admin.uiLocale }
  },
  head: ({ match }) => ({
    meta: [
      { title: translate(match.context.uiLocale, 'admin.nav.brand') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AdminLayout,
  errorComponent: AdminError,
})

type NavTo =
  | '/admin'
  | '/admin/orders'
  | '/admin/offers'
  | '/admin/reviews'
  | '/admin/trust'
  | '/admin/settings'
  | '/admin/password'

type NavItem = {
  to: NavTo
  label: MessageKey
  /** Shorter label for the bottom tab bar (about 70px wide per tab). */
  short?: MessageKey
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  exact?: boolean
}

/** Daily work: the bottom tabs on phones, the top of the sidebar on computers. */
const PRIMARY: NavItem[] = [
  { to: '/admin', label: 'admin.nav.dashboard', Icon: LayoutDashboard, exact: true },
  { to: '/admin/orders', label: 'admin.nav.orders', Icon: Package },
  {
    to: '/admin/offers',
    label: 'admin.nav.offers',
    short: 'admin.nav.offersShort',
    Icon: Droplets,
  },
  { to: '/admin/reviews', label: 'admin.nav.reviews', Icon: MessageSquareQuote },
]
/** Occasional settings: the "More" sheet on phones. */
const SECONDARY: NavItem[] = [
  { to: '/admin/trust', label: 'admin.nav.trust', Icon: ShieldCheck },
  { to: '/admin/settings', label: 'admin.nav.settings', Icon: Settings },
  { to: '/admin/password', label: 'admin.nav.password', Icon: KeyRound },
]

/*
 * Admin shell.
 * - Phones and tablets (< 1024px): a slim top bar (brand + sound bell) and a
 *   bottom tab bar within thumb reach: 4 daily screens + "More" (certificates,
 *   settings, password, language, site, sign out) in a bottom sheet.
 * - Computers: the sidebar with everything.
 */
function AdminLayout() {
  const { admin, csrfToken, uiLocale } = Route.useRouteContext()
  if (typeof window !== 'undefined') setClientCsrfToken(csrfToken)
  const t = useT()
  const router = useRouter()
  const navigate = useNavigate()
  const logout = useServerFn(adminLogout)
  const setLocale = useServerFn(adminSetLocale)
  const { data: pendingReviews = 0 } = useQuery({
    queryKey: ['admin', 'pending-reviews'],
    queryFn: () => adminPendingReviews(),
    refetchInterval: 60_000,
  })
  const unseen = useUnseenOrders().data?.count ?? 0
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [moreOpen, setMoreOpen] = useState(false)

  async function switchLanguage() {
    setMoreOpen(false)
    await setLocale({ data: { locale: uiLocale === 'ar' ? 'fr' : 'ar' } })
    await router.invalidate()
  }

  async function signOut() {
    setMoreOpen(false)
    await logout()
    setClientCsrfToken(null)
    await navigate({ to: '/admin/login' })
  }

  const badgeFor = (to: NavTo) =>
    to === '/admin/orders' && unseen > 0 ? (
      <Badge tone="danger" pulse>
        {unseen}
      </Badge>
    ) : to === '/admin/reviews' && pendingReviews > 0 ? (
      <Badge tone="gold">{pendingReviews}</Badge>
    ) : null

  const sideLink =
    'tap flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-limewash/75 transition-colors hover:bg-limewash/10 hover:text-limewash'
  const sideActive = 'bg-oil text-olive-950 hover:bg-oil hover:text-olive-950'
  const moreActive = SECONDARY.some((n) => pathname.startsWith(n.to))

  return (
    <div className="min-h-dvh bg-sand/40 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* ------------------------------------------------ computers: sidebar */}
      <aside
        data-print-hide
        className="sticky top-0 hidden h-dvh overflow-y-auto bg-olive-950 text-limewash lg:block"
      >
        <div className="flex items-center gap-2.5 px-5 py-6">
          <ArchMark className="h-7 w-5 [&_path:first-child]:fill-olive-400" />
          <span className="font-display text-base font-bold">{t('admin.nav.brand')}</span>
          <SoundToggle className="ms-auto" />
        </div>
        <nav aria-label={t('admin.nav.main')} className="px-3">
          <ul className="space-y-1">
            {[...PRIMARY, ...SECONDARY].map(({ to, label, Icon, exact }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  className={sideLink}
                  activeProps={{ className: sideActive, 'aria-current': 'page' }}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {t(label)}
                  <span className="ms-auto">{badgeFor(to)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 border-t border-limewash/10 px-3 py-4">
          <p className="truncate px-3 text-xs text-limewash/60" dir="ltr">
            {admin.email}
          </p>
          <div className="mt-3 space-y-1">
            <button type="button" onClick={switchLanguage} className={cn(sideLink, 'w-full')}>
              <Languages className="size-5" aria-hidden="true" />
              {t('admin.nav.switchLanguage')}
            </button>
            <a href={`/${uiLocale}`} target="_blank" rel="noreferrer" className={sideLink}>
              <ExternalLink className="size-5" aria-hidden="true" />
              {t('admin.nav.viewSite')}
            </a>
            <button type="button" onClick={signOut} className={cn(sideLink, 'w-full')}>
              <LogOut className="size-5" aria-hidden="true" />
              {t('admin.nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* ------------------------------------- phones/tablets: top bar */}
        <header
          data-print-hide
          className="sticky top-0 z-30 flex h-14 items-center gap-2.5 bg-olive-950 px-4 pt-[env(safe-area-inset-top)] text-limewash shadow-[0_6px_20px_-12px_rgb(20_27_12/0.7)] lg:hidden"
        >
          <ArchMark className="h-6 w-4 [&_path:first-child]:fill-olive-400" />
          <span className="min-w-0 truncate font-display text-base font-bold">
            {t('admin.nav.brand')}
          </span>
          <SoundToggle className="ms-auto" />
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-6xl px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-10"
        >
          <Outlet />
        </main>
        <OrderNotifications />

        {/* ------------------------------ phones/tablets: bottom tab bar */}
        <nav
          aria-label={t('admin.nav.main')}
          data-print-hide
          className="fixed inset-x-0 bottom-0 z-40 border-t border-limewash/10 bg-olive-950/95 pb-[env(safe-area-inset-bottom)] text-limewash backdrop-blur lg:hidden"
        >
          <ul className="mx-auto grid max-w-xl grid-cols-5">
            {PRIMARY.map(({ to, label, short, Icon, exact }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  aria-label={short ? t(label) : undefined}
                  className="tab-link group relative flex h-16 flex-col items-center justify-center gap-1 text-limewash/65 transition-colors"
                  activeProps={{ className: 'is-active text-oil-bright', 'aria-current': 'page' }}
                >
                  <span className="tab-indicator absolute inset-x-4 top-0 h-0.5 rounded-full bg-oil-bright" />
                  <span className="relative">
                    <Icon className="size-6" aria-hidden="true" />
                    <span className="absolute -end-3 -top-2">{badgeFor(to)}</span>
                  </span>
                  <span className="max-w-full truncate px-1 text-[0.75rem] font-medium">
                    {t(short ?? label)}
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
                <Dialog.Trigger
                  className={cn(
                    'tab-link relative flex h-16 w-full flex-col items-center justify-center gap-1 transition-colors',
                    moreActive ? 'is-active text-oil-bright' : 'text-limewash/65',
                  )}
                >
                  <span className="tab-indicator absolute inset-x-4 top-0 h-0.5 rounded-full bg-oil-bright" />
                  <Menu className="size-6" aria-hidden="true" />
                  <span className="text-[0.75rem] font-medium">{t('admin.nav.more')}</span>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-ink/50" />
                  <Dialog.Content className="sheet-content fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-limewash px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lift focus:outline-none">
                    <div
                      aria-hidden="true"
                      className="mx-auto mb-2 h-1 w-10 rounded-full bg-sand-deep"
                    />
                    <div className="flex items-center justify-between px-2">
                      <Dialog.Title className="font-display text-h3 text-olive">
                        {t('admin.nav.more')}
                      </Dialog.Title>
                      <Dialog.Close
                        className="tap inline-flex items-center justify-center rounded-full text-olive hover:bg-sand"
                        aria-label={t('admin.nav.close')}
                      >
                        <X className="size-5" aria-hidden="true" />
                      </Dialog.Close>
                    </div>
                    <Dialog.Description className="truncate px-2 text-sm text-ink-soft" dir="ltr">
                      {admin.email}
                    </Dialog.Description>
                    <ul className="mt-3 space-y-1">
                      {SECONDARY.map(({ to, label, Icon }) => (
                        <li key={to}>
                          <Link
                            to={to}
                            onClick={() => setMoreOpen(false)}
                            className="sheet-row"
                            activeProps={{ className: 'is-active', 'aria-current': 'page' }}
                          >
                            <Icon className="size-5 text-olive-600" aria-hidden="true" />
                            {t(label)}
                          </Link>
                        </li>
                      ))}
                      <li>
                        <button type="button" onClick={switchLanguage} className="sheet-row w-full">
                          <Languages className="size-5 text-olive-600" aria-hidden="true" />
                          {t('admin.nav.switchLanguage')}
                        </button>
                      </li>
                      <li>
                        <a
                          href={`/${uiLocale}`}
                          target="_blank"
                          rel="noreferrer"
                          className="sheet-row"
                        >
                          <ExternalLink className="size-5 text-olive-600" aria-hidden="true" />
                          {t('admin.nav.viewSite')}
                        </a>
                      </li>
                    </ul>
                    {/* Sign out stands apart from the rest. */}
                    <button
                      type="button"
                      onClick={signOut}
                      className="sheet-row mt-2 w-full border-t border-sand-deep pt-3 text-danger"
                    >
                      <LogOut className="size-5" aria-hidden="true" />
                      {t('admin.nav.logout')}
                    </button>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}

function Badge({
  tone,
  pulse,
  children,
}: {
  tone: 'danger' | 'gold'
  pulse?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums',
        tone === 'danger' ? 'bg-danger text-white' : 'bg-oil text-olive-950',
        pulse && 'notify-pulse',
      )}
    >
      {children}
    </span>
  )
}

function AdminError({ error, reset }: ErrorComponentProps) {
  const unauthenticated = /unauthenticated|csrf/.test(error instanceof Error ? error.message : '')
  return (
    <main className="container-page py-16">
      <p className="text-lede">
        {unauthenticated ? 'Session expirée — الجلسة انتهت' : 'Erreur — خطأ'}
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <a href="/admin/login">Connexion · دخول</a>
        </Button>
        {!unauthenticated ? (
          <Button variant="outline" onClick={reset}>
            Réessayer · إعادة المحاولة
          </Button>
        ) : null}
      </div>
    </main>
  )
}
