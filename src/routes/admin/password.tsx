import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '~/components/ui/button'
import { type MessageKey, useT } from '~/i18n'
import { adminChangePassword } from '~/server/functions/admin'

export const Route = createFileRoute('/admin/password')({
  component: PasswordPage,
})

function PasswordPage() {
  const { admin } = Route.useRouteContext()
  const t = useT()
  const router = useRouter()
  const navigate = useNavigate()
  const change = useServerFn(adminChangePassword)
  const ids = { current: useId(), next: useId(), confirm: useId(), hint: useId() }
  const [error, setError] = useState<MessageKey | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const current = String(form.get('current') ?? '')
    const next = String(form.get('next') ?? '')
    setError(null)
    if (next.length < 12) return setError('admin.password.tooWeak')
    if (next !== String(form.get('confirm') ?? '')) return setError('admin.password.mismatch')
    setBusy(true)
    try {
      const result = await change({ data: { current, next } })
      if (!result.ok) {
        setError(
          result.reason === 'wrong_current'
            ? 'admin.password.wrongCurrent'
            : 'admin.password.tooWeak',
        )
        return
      }
      setSaved(true)
      e.currentTarget?.reset()
      await router.invalidate()
      if (admin.mustChangePassword) await navigate({ to: '/admin' })
    } catch {
      setError('admin.order.error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-h2">{t('admin.password.title')}</h1>
      {admin.mustChangePassword ? (
        <p className="mt-3 rounded-card border border-oil bg-oil-soft/60 p-4 text-ink">
          {t('admin.password.forced')}
        </p>
      ) : null}
      <form
        method="post"
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-card bg-white p-5 shadow-lift sm:p-6"
      >
        {/* Lets password managers attach the new password to the right account. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={admin.email}
          readOnly
          hidden
        />
        {(
          [
            ['current', 'admin.password.current', 'current-password'],
            ['next', 'admin.password.next', 'new-password'],
            ['confirm', 'admin.password.confirm', 'new-password'],
          ] as const
        ).map(([name, label, autoComplete]) => (
          <div key={name}>
            <label htmlFor={ids[name]} className="mb-1.5 block font-medium text-olive">
              {t(label)}
            </label>
            <input
              id={ids[name]}
              name={name}
              type="password"
              autoComplete={autoComplete}
              dir="ltr"
              required
              minLength={name === 'current' ? undefined : 12}
              aria-describedby={name === 'next' ? ids.hint : undefined}
              className="field-input"
            />
            {name === 'next' ? (
              <p id={ids.hint} className="mt-1.5 text-sm text-ink-soft">
                {t('admin.password.hint')}
              </p>
            ) : null}
          </div>
        ))}
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t(error)}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-olive-600">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t('admin.password.saved')}
          </p>
        ) : null}
        <Button type="submit" disabled={busy} className="w-full">
          {t('admin.password.submit')}
        </Button>
      </form>
    </div>
  )
}
