import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { AlertCircle, Check, Pencil, ShieldCheck } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { type MessageKey, useLocale, useT } from '~/i18n'
import { currentAttribution } from '~/lib/attribution'
import { cn } from '~/lib/cn'
import { formatMad } from '~/lib/format'
import { onOfferSelect } from '~/lib/offer-select'
import { computeTotals, optionalFieldInputs, orderFields, type PricedLine } from '~/lib/order'
import { clearDraft, type DraftField, loadDraft, saveDraft } from '~/lib/order-draft'
import { formatPhoneDisplay, normalizeMoroccanPhone } from '~/lib/phone'
import type { CreateOrderResult } from '~/server/functions/orders'
import { createOrder } from '~/server/functions/orders'
import type { LandingData, LandingProduct } from '~/server/landing'
import { WhatsappIcon } from '../icons'
import { Button, buttonVariants } from '../ui/button'
import { useProofOfWork } from '../useProofOfWork'
import { WhatsappLink } from '../WhatsappLink'
import { CityCombobox } from './CityCombobox'
import { Turnstile } from './Turnstile'

type OrderFormProps = {
  products: LandingProduct[]
  delivery: LandingData['settings']['delivery']
  formToken: string
  turnstileSiteKey: string | null
  /** Slug from ?product=, set by the product cards' "Order" buttons. */
  selectedProduct: string | null
  /** Price per litre and the "other quantity" limits (null when that option is off). */
  pricing: LandingData['settings']['pricing']
}

type FormValues = {
  /** Chosen offer id, 'custom' for a number of litres, '' before choosing. */
  choice: string
  customLiters: string
  name: string
  phone: string
  city: string
  address: string
  note: string
  website: string
}

type FieldName = 'choice' | 'customLiters' | 'name' | 'phone' | 'city' | 'address' | 'note'

/*
 * Three steps: 1 products, 2 contact details, 3 review & send. All steps stay
 * mounted (inactive ones are `hidden`) so every field keeps its validators;
 * "Continue" validates only the current step's fields. Server-side errors
 * send the visitor back to the step that holds the field.
 */
const STEPS: Array<{ label: MessageKey; fields: FieldName[] }> = [
  { label: 'orderForm.step1', fields: ['choice', 'customLiters'] },
  { label: 'orderForm.step2', fields: ['name', 'phone', 'city', 'address', 'note'] },
  { label: 'orderForm.step3', fields: [] },
]
const stepOf = (field: FieldName) => STEPS.findIndex((s) => s.fields.includes(field))

/** First error of a field as a translated message (schema issues or i18n keys). */
function useErrorText() {
  const t = useT()
  return (errors: readonly unknown[]): string | undefined => {
    const first = errors.find(Boolean)
    if (!first) return undefined
    const key = typeof first === 'string' ? first : (first as { message?: string }).message
    return key?.startsWith('validation.') ? t(key as MessageKey) : t('validation.invalid')
  }
}

export function OrderForm({
  products,
  delivery,
  formToken,
  turnstileSiteKey,
  selectedProduct,
  pricing,
}: OrderFormProps) {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const submitOrder = useServerFn(createOrder)
  const errorText = useErrorText()
  const formRef = useRef<HTMLFormElement>(null)
  const pow = useProofOfWork(formRef)
  const headingRefs = useRef<Array<HTMLHeadingElement | null>>([])
  const ids = {
    name: useId(),
    phone: useId(),
    city: useId(),
    address: useId(),
    note: useId(),
    liters: useId(),
  }
  const [step, setStep] = useState(0)
  const [formError, setFormError] = useState<MessageKey | null>(null)
  /** Sending failed twice: offer retry, WhatsApp with the order, or a reload (nothing is lost). */
  const [networkFailed, setNetworkFailed] = useState(false)
  const [duplicate, setDuplicate] = useState<Extract<
    CreateOrderResult,
    { status: 'duplicate' }
  > | null>(null)

  const available = products.filter((p) => p.stockStatus !== 'out_of_stock')
  const customLitersRef = useRef<HTMLInputElement>(null)

  /** ?product= slug (or "custom") → the choice it stands for, if it can be ordered. */
  const choiceFor = (slug: string | null) => {
    if (slug === 'custom') return pricing.custom ? 'custom' : ''
    const product = available.find((p) => p.slug === slug)
    if (product) return product.id
    // A single option is selected by default.
    return available.length === 1 && !pricing.custom && available[0] ? available[0].id : ''
  }

  /** The order line the current choice stands for (live total, review step). */
  const linesFor = (values: Pick<FormValues, 'choice' | 'customLiters'>) => {
    if (values.choice === 'custom') {
      const liters = Number.parseInt(values.customLiters, 10)
      if (!pricing.custom || pricing.pricePerLiter === null || !(liters > 0)) return []
      return [
        {
          key: 'custom',
          label: t('orderForm.customLine', { liters }),
          unitPrice: pricing.pricePerLiter,
          quantity: liters,
        },
      ]
    }
    const p = products.find((x) => x.id === values.choice)
    return p
      ? [
          {
            key: p.id,
            label: [p.name, p.sizeLabel].filter(Boolean).join(' — '),
            unitPrice: Number.parseFloat(p.price),
            quantity: 1,
          },
        ]
      : []
  }

  const form = useForm({
    defaultValues: {
      choice: choiceFor(selectedProduct),
      customLiters: '',
      name: '',
      phone: '',
      city: '',
      address: '',
      note: '',
      website: '',
    } satisfies FormValues as FormValues,
    onSubmit: async ({ value }) => send(value, false),
    onSubmitInvalid: () => goToFirstInvalid(),
  })

  // Clicking "Order" on an offer card selects it and brings the visitor back to step 1.
  // biome-ignore lint/correctness/useExhaustiveDependencies: react to the URL only
  useEffect(() => {
    if (!selectedProduct) return
    const choice = choiceFor(selectedProduct)
    if (!choice) return
    form.setFieldValue('choice', choice)
    setStep(0)
    if (choice === 'custom') requestAnimationFrame(() => customLitersRef.current?.focus())
  }, [selectedProduct])

  // Keep what the visitor typed across a refresh (lib/order-draft). Restored
  // after hydration; an offer chosen in the URL (?product=) wins over the draft.
  const stepRef = useRef(step)
  stepRef.current = step
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore once, then save on change
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      for (const [field, value] of Object.entries(draft.values) as Array<[DraftField, string]>) {
        if (field === 'choice' && (selectedProduct || !isChoiceAvailable(value))) continue
        form.setFieldValue(field, value)
      }
      if (draft.step > 0) setStep(draft.step)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const subscription = form.store.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(() => saveDraft(form.state.values, stepRef.current), 250)
    })
    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: save the step as it changes
  useEffect(() => {
    saveDraft(form.state.values, step)
  }, [step])

  /** The order as a WhatsApp message, when the website could not send it. */
  function whatsappFallback(values: FormValues) {
    const items = linesFor(values)
      .map((l) => (l.key === 'custom' ? l.label : `${l.quantity} × ${l.label}`))
      .join(locale === 'ar' ? '، ' : ', ')
    return t('orderForm.whatsappOrder', {
      items: items || '—',
      name: values.name || '—',
      phone: values.phone || '—',
      city: values.city || '—',
      address: values.address || '—',
    })
  }

  /** An offer id (or "custom") that can still be ordered. */
  function isChoiceAvailable(choice: string) {
    if (choice === 'custom') return Boolean(pricing.custom)
    return available.some((p) => p.id === choice)
  }

  // Offer cards are plain #order links; they announce the chosen offer here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: subscribe once
  useEffect(
    () =>
      onOfferSelect((slug) => {
        const choice = choiceFor(slug)
        if (!choice) return
        form.setFieldValue('choice', choice)
        setStep(0)
        if (choice === 'custom') requestAnimationFrame(() => customLitersRef.current?.focus())
      }),
    [],
  )

  function goTo(next: number, focus = true) {
    setStep(next)
    setFormError(null)
    if (!focus) return
    // After the step renders: put focus on its heading so screen readers announce it.
    requestAnimationFrame(() => headingRefs.current[next]?.focus())
  }

  function focusFirstInvalid() {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>('section:not([hidden]) [aria-invalid="true"]')
        ?.focus()
    })
  }

  function goToFirstInvalid() {
    const invalid = (Object.keys(form.state.fieldMeta) as FieldName[]).filter(
      (name) => (form.getFieldMeta(name)?.errors.length ?? 0) > 0,
    )
    const target = Math.min(...invalid.map(stepOf).filter((i) => i >= 0), step)
    setStep(target)
    focusFirstInvalid()
  }

  async function next() {
    const fields = STEPS[step]?.fields ?? []
    await Promise.all(fields.map((f) => form.validateField(f, 'submit')))
    const hasError = fields.some((f) => (form.getFieldMeta(f)?.errors.length ?? 0) > 0)
    if (hasError) {
      focusFirstInvalid()
      return
    }
    goTo(step + 1)
  }

  async function send(value: FormValues, confirmDuplicate: boolean) {
    setFormError(null)
    setDuplicate(null)
    const turnstileToken =
      formRef.current?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
        ?.value || undefined
    setNetworkFailed(false)
    let result: CreateOrderResult
    const attempt = async () => {
      const altcha = await pow.take()
      return submitOrder({
        data: {
          name: value.name,
          phone: value.phone,
          city: value.city,
          address: value.address,
          note: value.note,
          items:
            value.choice && value.choice !== 'custom'
              ? [{ productId: value.choice, quantity: 1 }]
              : [],
          customLiters:
            value.choice === 'custom' ? Number.parseInt(value.customLiters, 10) : undefined,
          locale,
          formToken,
          website: value.website,
          confirmDuplicate,
          turnstileToken,
          altcha,
          attribution: currentAttribution(),
        },
      })
    }
    try {
      result = await attempt()
    } catch {
      // A dropped connection on a phone: wait a moment and try once more.
      try {
        await new Promise((ok) => setTimeout(ok, 1200))
        result = await attempt()
      } catch {
        setFormError('orderForm.errorNetwork')
        setNetworkFailed(true)
        return
      }
    }

    switch (result.status) {
      case 'created':
        clearDraft()
        await navigate({
          to: '/$locale/order/$reference',
          params: { locale, reference: result.reference },
          search: { t: result.viewToken },
        })
        return
      case 'duplicate':
        setDuplicate(result)
        return
      case 'invalid': {
        for (const [field, key] of Object.entries(result.fieldErrors)) {
          const name = (field === 'items' ? 'choice' : field) as FieldName
          form.setFieldMeta(name, (meta) => ({
            ...meta,
            isTouched: true,
            errorMap: { ...meta.errorMap, onServer: key },
          }))
        }
        goToFirstInvalid()
        setFormError('orderForm.errorSummary')
        return
      }
      case 'unavailable':
        goTo(0)
        setFormError('orderForm.errorUnavailable')
        return
      case 'rate_limited':
        setFormError('orderForm.errorRateLimited')
        return
      default:
        setFormError('orderForm.errorRejected')
    }
  }

  const stepHeading = (index: number, text: string) => (
    <h3
      ref={(el) => {
        headingRefs.current[index] = el
      }}
      tabIndex={-1}
      className="font-display text-h3 text-olive outline-none"
    >
      {text}
    </h3>
  )

  return (
    <form
      method="post"
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (step < STEPS.length - 1) void next()
        else void form.handleSubmit()
      }}
      className="rounded-[20px] bg-limewash p-5 text-ink shadow-lift sm:p-8"
    >
      <Stepper step={step} onSelect={(i) => i < step && goTo(i)} />

      {/* ---------------------------------------------------- 1. products */}
      <section hidden={step !== 0} aria-labelledby={undefined} className="step-enter">
        <form.Field
          name="choice"
          validators={{
            onSubmit: ({ value }) => (value ? undefined : 'validation.itemsRequired'),
          }}
        >
          {(field) => {
            const error = errorText(field.state.meta.errors)
            const option = (selected: boolean, disabled = false) =>
              cn(
                'flex cursor-pointer items-center gap-3 rounded-card border-2 px-3 py-3 transition-colors',
                selected
                  ? 'border-oil bg-oil/10'
                  : 'border-sand-deep bg-white hover:border-olive-600/40',
                disabled && 'cursor-not-allowed opacity-60',
              )
            return (
              <fieldset aria-describedby={error ? 'choice-error' : undefined}>
                <legend className="sr-only">{t('orderForm.productsLegend')}</legend>
                {stepHeading(0, t('orderForm.productsLegend'))}
                <ul className="mt-3 grid gap-2">
                  {products.map((p) => {
                    const unavailable = p.stockStatus === 'out_of_stock'
                    const selected = field.state.value === p.id
                    return (
                      <li key={p.id}>
                        <label className={option(selected, unavailable)}>
                          <input
                            type="radio"
                            name="offer"
                            value={p.id}
                            checked={selected}
                            disabled={unavailable}
                            onChange={() => field.handleChange(p.id)}
                            className="size-5 shrink-0 accent-olive"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-olive tabular-nums">
                              {p.sizeLabel ?? p.name}
                            </span>
                            {p.sizeLabel ? (
                              <span className="block text-sm text-ink-soft">{p.name}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-end font-bold text-olive tabular-nums">
                            {unavailable ? t('orderForm.unavailable') : formatMad(p.price, locale)}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                  {pricing.custom && pricing.pricePerLiter !== null ? (
                    <li>
                      <label className={option(field.state.value === 'custom')}>
                        <input
                          type="radio"
                          name="offer"
                          value="custom"
                          checked={field.state.value === 'custom'}
                          onChange={() => {
                            field.handleChange('custom')
                            requestAnimationFrame(() => customLitersRef.current?.focus())
                          }}
                          className="size-5 shrink-0 accent-olive"
                        />
                        <span className="min-w-0 flex-1 font-bold text-olive">
                          {t('orderForm.customOption')}
                        </span>
                        <span className="shrink-0 text-sm text-ink-soft tabular-nums">
                          {t('products.perLiter', {
                            price: formatMad(pricing.pricePerLiter, locale),
                          })}
                        </span>
                      </label>
                      {field.state.value === 'custom' ? (
                        <form.Field
                          name="customLiters"
                          validators={{
                            onSubmit: ({ value }) => {
                              const custom = pricing.custom
                              if (form.getFieldValue('choice') !== 'custom' || !custom) {
                                return undefined
                              }
                              const n = Number.parseInt(value, 10)
                              if (Number.isNaN(n)) return 'validation.litersRequired'
                              return n < custom.min || n > custom.max
                                ? 'validation.litersRange'
                                : undefined
                            },
                          }}
                        >
                          {(litersField) => (
                            <FormField
                              id={ids.liters}
                              label={t('orderForm.litersLabel')}
                              hint={t('orderForm.litersHint', {
                                min: pricing.custom?.min ?? 1,
                                max: pricing.custom?.max ?? 999,
                                price: formatMad(pricing.pricePerLiter ?? 0, locale),
                              })}
                              error={errorText(litersField.state.meta.errors)}
                              className="mt-2 rounded-card bg-oil/10 p-3"
                            >
                              {(describedBy, invalid) => (
                                <div className="relative">
                                  <input
                                    ref={customLitersRef}
                                    id={ids.liters}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoComplete="off"
                                    enterKeyHint="next"
                                    dir="ltr"
                                    value={litersField.state.value}
                                    onChange={(e) =>
                                      litersField.handleChange(
                                        e.target.value.replace(/\D/g, '').slice(0, 3),
                                      )
                                    }
                                    onBlur={litersField.handleBlur}
                                    aria-invalid={invalid || undefined}
                                    aria-describedby={describedBy}
                                    className="field-input pr-14 text-lg font-bold tabular-nums"
                                  />
                                  {/* Physical right: the number is written left to right. */}
                                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-ink-soft">
                                    {t('orderForm.litersUnit')}
                                  </span>
                                </div>
                              )}
                            </FormField>
                          )}
                        </form.Field>
                      ) : null}
                    </li>
                  ) : null}
                </ul>
                {error ? (
                  <p
                    id="choice-error"
                    className="mt-2 text-sm font-medium text-danger"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </fieldset>
            )
          }}
        </form.Field>
        <form.Subscribe
          selector={(s) => ({ choice: s.values.choice, customLiters: s.values.customLiters })}
        >
          {(values) => <Totals lines={linesFor(values)} delivery={delivery} compact />}
        </form.Subscribe>
      </section>

      {/* ------------------------------------------------- 2. your details */}
      <section hidden={step !== 1} className="step-enter">
        {stepHeading(1, t('orderForm.detailsTitle'))}
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <form.Field
            name="name"
            validators={{ onBlur: orderFields.name, onSubmit: orderFields.name }}
          >
            {(field) => (
              <FormField
                id={ids.name}
                label={t('orderForm.name')}
                error={errorText(field.state.meta.errors)}
              >
                {(describedBy, invalid) => (
                  <input
                    id={ids.name}
                    name="name"
                    type="text"
                    autoComplete="name"
                    enterKeyHint="next"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className="field-input"
                  />
                )}
              </FormField>
            )}
          </form.Field>

          <form.Field
            name="phone"
            validators={{ onBlur: orderFields.phone, onSubmit: orderFields.phone }}
          >
            {(field) => (
              <FormField
                id={ids.phone}
                label={t('orderForm.phone')}
                hint={t('orderForm.phoneHint')}
                error={errorText(field.state.meta.errors)}
              >
                {(describedBy, invalid) => (
                  <input
                    id={ids.phone}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    enterKeyHint="next"
                    dir="ltr"
                    placeholder="06 12 34 56 78"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className="field-input text-start rtl:text-end"
                  />
                )}
              </FormField>
            )}
          </form.Field>

          <form.Field
            name="city"
            validators={{ onBlur: orderFields.city, onSubmit: orderFields.city }}
          >
            {(field) => (
              <FormField
                id={ids.city}
                label={t('orderForm.city')}
                hint={t('orderForm.cityHint')}
                error={errorText(field.state.meta.errors)}
                className="sm:col-span-2"
              >
                {(describedBy, invalid) => (
                  <CityCombobox
                    id={ids.city}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    invalid={invalid}
                    describedBy={describedBy}
                  />
                )}
              </FormField>
            )}
          </form.Field>

          <form.Field
            name="address"
            validators={{
              onBlur: optionalFieldInputs.address,
              onSubmit: optionalFieldInputs.address,
            }}
          >
            {(field) => (
              <FormField
                id={ids.address}
                label={t('orderForm.address')}
                optional
                error={errorText(field.state.meta.errors)}
              >
                {(describedBy, invalid) => (
                  <textarea
                    id={ids.address}
                    name="address"
                    rows={2}
                    autoComplete="street-address"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className="field-input py-3"
                  />
                )}
              </FormField>
            )}
          </form.Field>

          <form.Field
            name="note"
            validators={{ onBlur: optionalFieldInputs.note, onSubmit: optionalFieldInputs.note }}
          >
            {(field) => (
              <FormField
                id={ids.note}
                label={t('orderForm.note')}
                optional
                error={errorText(field.state.meta.errors)}
              >
                {(describedBy, invalid) => (
                  <textarea
                    id={ids.note}
                    name="note"
                    rows={2}
                    placeholder={t('orderForm.notePlaceholder')}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className="field-input py-3"
                  />
                )}
              </FormField>
            )}
          </form.Field>
        </div>
      </section>

      {/* ---------------------------------------------- 3. review and send */}
      <section hidden={step !== 2} className="step-enter">
        {stepHeading(2, t('orderForm.reviewTitle'))}
        <form.Subscribe selector={(s) => s.values}>
          {(values) => {
            const chosen = linesFor(values)
            const phone = normalizeMoroccanPhone(values.phone)
            return (
              <div className="mt-4 space-y-4">
                <ReviewBlock
                  title={t('orderForm.reviewProducts')}
                  editLabel={t('orderForm.editStep', { step: t('orderForm.step1') })}
                  onEdit={() => goTo(0)}
                >
                  <ul className="space-y-1">
                    {chosen.map((line) => (
                      <li key={line.key} className="flex justify-between gap-3">
                        <span>{line.label}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatMad(line.unitPrice * line.quantity, locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ReviewBlock>
                <ReviewBlock
                  title={t('orderForm.reviewDetails')}
                  editLabel={t('orderForm.editStep', { step: t('orderForm.step2') })}
                  onEdit={() => goTo(1)}
                >
                  <p className="font-medium">{values.name}</p>
                  <p className="text-ink-soft tabular-nums" dir="ltr">
                    {phone ? formatPhoneDisplay(phone) : values.phone}
                  </p>
                  <p>{values.city}</p>
                  {values.address ? (
                    <p className="whitespace-pre-line text-ink-soft">{values.address}</p>
                  ) : null}
                  {values.note ? <p className="text-sm text-ink-soft">“{values.note}”</p> : null}
                </ReviewBlock>
                <Totals lines={chosen} delivery={delivery} />
              </div>
            )
          }}
        </form.Subscribe>

        {turnstileSiteKey ? <Turnstile siteKey={turnstileSiteKey} /> : null}

        {duplicate ? (
          <div role="alert" className="mt-6 rounded-card border border-oil bg-oil-soft/60 p-4">
            <p className="font-bold text-olive">{t('orderForm.duplicateTitle')}</p>
            <p className="mt-1 text-ink">
              {t('orderForm.duplicateBody', {
                minutes: duplicate.minutesAgo,
                reference: duplicate.reference,
              })}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void send(form.state.values, true)}
              >
                {t('orderForm.duplicateConfirm')}
              </Button>
              <WhatsappLink
                placement="order_section"
                className="tap inline-flex items-center font-medium text-olive underline decoration-oil decoration-2 underline-offset-4"
              >
                {t('faq.moreLink')}
              </WhatsappLink>
            </div>
          </div>
        ) : null}
      </section>

      {/* Honeypot: off-screen, skipped by keyboard and screen readers. */}
      <form.Field name="website">
        {(field) => (
          <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
            <label>
              {t('orderForm.honeypot')}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          </div>
        )}
      </form.Field>

      {formError ? (
        <div
          role="alert"
          className="mt-6 rounded-card border border-danger/30 bg-danger/[0.05] p-g2"
        >
          <p className="flex items-start gap-2 font-medium text-danger">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {t(formError)}
          </p>
          {networkFailed ? (
            <>
              <p className="mt-1 text-sm text-ink-soft">{t('orderForm.draftKept')}</p>
              <div className="mt-g1 flex flex-col gap-2 sm:flex-row">
                <Button type="submit" variant="outline" className="sm:flex-1">
                  {t('orderForm.retry')}
                </Button>
                <WhatsappLink
                  placement="order_section"
                  text={whatsappFallback(form.state.values)}
                  className={cn(buttonVariants({ variant: 'whatsapp' }), 'sm:flex-1')}
                >
                  <WhatsappIcon />
                  {t('orderForm.sendByWhatsapp')}
                </WhatsappLink>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" size="lg" onClick={() => goTo(step - 1)}>
            {t('orderForm.back')}
          </Button>
        ) : null}
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              size="lg"
              className={cn(
                'flex-1',
                step === STEPS.length - 1 &&
                  'bg-oil text-olive-950 shadow-[0_10px_30px_-12px_rgb(217_162_27/0.8)] hover:bg-oil-bright',
              )}
              disabled={isSubmitting}
            >
              {step < STEPS.length - 1
                ? t('orderForm.next')
                : isSubmitting
                  ? t('orderForm.submitting')
                  : t('orderForm.submit')}
            </Button>
          )}
        </form.Subscribe>
      </div>

      <p className="mt-4 flex items-start justify-center gap-2 text-center text-sm text-ink-soft">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden="true" />
        {t('orderForm.payOnDelivery')}
      </p>
    </form>
  )
}

/* ------------------------------------------------------------- pieces */

function Stepper({ step, onSelect }: { step: number; onSelect: (i: number) => void }) {
  const t = useT()
  return (
    <nav aria-label={t('orderForm.progressLabel')} className="mb-g3">
      <p className="sr-only" aria-live="polite">
        {t('orderForm.stepOf', { current: step + 1, total: STEPS.length })}:{' '}
        {t(STEPS[step]?.label ?? 'orderForm.step1')}
      </p>
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < step
          const current = i === step
          return (
            <li key={s.label} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={!done}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full text-sm font-medium transition-colors disabled:cursor-default',
                  done && 'text-olive-600 hover:text-olive',
                  current && 'text-olive',
                  !done && !current && 'text-ink-soft',
                )}
              >
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors',
                    done && 'bg-olive-600 text-limewash',
                    current && 'bg-oil text-olive-950 ring-4 ring-oil/25',
                    !done && !current && 'border border-sand-deep bg-white text-ink-soft',
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn(!current && 'hidden sm:inline')}>{t(s.label)}</span>
              </button>
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    done ? 'bg-olive-600' : 'bg-sand-deep',
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function ReviewBlock({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string
  editLabel: string
  onEdit: () => void
  children: ReactNode
}) {
  const t = useT()
  return (
    <div className="rounded-card border border-sand-deep bg-white/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-olive">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="tap -my-2 inline-flex items-center gap-1 rounded-full px-2 text-sm text-olive-600 hover:bg-sand"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          {t('orderForm.edit')}
        </button>
      </div>
      {children}
    </div>
  )
}

function Totals({
  lines,
  delivery,
  compact,
}: {
  lines: PricedLine[]
  delivery: LandingData['settings']['delivery']
  compact?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const totals = computeTotals(lines, delivery)

  if (compact) {
    return (
      <p
        className="mt-4 flex items-baseline justify-between gap-3 rounded-card bg-sand/70 px-4 py-3"
        aria-live="polite"
      >
        <span className="text-sm text-ink-soft">
          {totals.deliveryFee === null ? t('orderForm.totalWithoutDelivery') : t('orderForm.total')}
        </span>
        <span className="font-display text-h3 text-olive tabular-nums">
          {formatMad(totals.total, locale)}
        </span>
      </p>
    )
  }

  return (
    <dl className="space-y-1.5 rounded-card bg-sand/70 p-4 text-[0.9375rem] sm:p-5">
      <Row label={t('orderForm.subtotal')} value={formatMad(totals.subtotal, locale)} />
      <Row
        label={t('orderForm.delivery')}
        value={
          totals.deliveryFee === null
            ? t('orderForm.deliveryConfirm')
            : totals.deliveryFee === 0
              ? t('orderForm.deliveryFree')
              : formatMad(totals.deliveryFee, locale)
        }
      />
      <div className="flex items-baseline justify-between gap-4 border-t border-sand-deep pt-2">
        <dt className="font-bold text-olive">
          {totals.deliveryFee === null ? t('orderForm.totalWithoutDelivery') : t('orderForm.total')}
        </dt>
        <dd className="font-display text-h3 text-olive tabular-nums">
          {formatMad(totals.total, locale)}
        </dd>
      </div>
    </dl>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function FormField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
  children: (describedBy: string | undefined, invalid: boolean) => ReactNode
}) {
  const t = useT()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block font-medium text-olive">
        {label}
        {optional ? (
          <span className="ms-1.5 text-sm font-normal text-ink-soft">
            ({t('orderForm.optional')})
          </span>
        ) : null}
      </label>
      {children(describedBy, Boolean(error))}
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
