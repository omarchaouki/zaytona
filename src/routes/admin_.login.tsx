import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { AlertCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { z } from 'zod'
import { ArchMark } from '~/components/icons'
import { Button } from '~/components/ui/button'
import { type MessageKey, translate, useT } from '~/i18n'
import { LOCALES } from '~/i18n/config'
import { adminLogin, getAdminSession } from '~/server/functions/admin'

export const Route = createFileRoute('/admin_/login')({
  validateSearch: z.object({
    lang: z.enum(LOCALES).optional().catch(undefined),
    redirect: z.string().max(300).optional().catch(undefined),
  }),
  beforeLoad: async ({ search }) => {
    if (await getAdminSession()) throw redirect({ to: '/admin' })
    return { uiLocale: search.lang ?? 'ar' }
  },
  head: ({ match }) => ({
    meta: [
      { title: translate(match.context.uiLocale, 'admin.login.title') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: LoginPage,
})

function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const { lang, redirect: back } = Route.useSearch()
  const login = useServerFn(adminLogin)
  const ids = { email: useId(), password: useId() }
  const [error, setError] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)
  const other = (lang ?? 'ar') === 'ar' ? 'fr' : 'ar'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const result = await login({
        data: {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        },
      })
      if (!result.ok) {
        setError(
          result.reason === 'rate_limited' ? 'admin.login.rateLimited' : 'admin.login.invalid',
        )
        return
      }
      // Only same-site admin paths are allowed as a return target.
      const target = back?.startsWith('/admin') ? back : '/admin'
      await navigate({ to: result.mustChangePassword ? '/admin/password' : target })
    } catch {
      setError('admin.login.network')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="glow-olive flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between text-limewash">
          <div className="flex items-center gap-2.5">
            <ArchMark className="h-8 w-6 [&_path:first-child]:fill-olive-400" />
            <span className="font-display text-lg font-bold">{t('admin.nav.brand')}</span>
          </div>
          <a
            href={`/admin/login?lang=${other}`}
            className="tap inline-flex items-center rounded-full border border-limewash/25 px-3 text-sm hover:bg-limewash/10"
          >
            {t('admin.nav.switchLanguage')}
          </a>
        </div>
        <form
          method="post"
          onSubmit={onSubmit}
          className="rounded-[20px] bg-limewash p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)] sm:p-8"
        >
          <h1 className="text-h2">{t('admin.login.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('admin.login.subtitle')}</p>

          <label htmlFor={ids.email} className="mt-6 mb-1.5 block font-medium text-olive">
            {t('admin.login.email')}
          </label>
          <input
            id={ids.email}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            required
            className="field-input"
          />
          <label htmlFor={ids.password} className="mt-4 mb-1.5 block font-medium text-olive">
            {t('admin.login.password')}
          </label>
          <input
            id={ids.password}
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            className="field-input"
          />

          {error ? (
            <p role="alert" className="mt-4 flex items-start gap-2 text-sm font-medium text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t(error)}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
            {busy ? t('admin.login.submitting') : t('admin.login.submit')}
          </Button>
        </form>
      </div>
    </main>
  )
}
