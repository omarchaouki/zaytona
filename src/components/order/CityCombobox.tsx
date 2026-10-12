import { useId, useMemo, useRef, useState } from 'react'
import { useLocale, useT } from '~/i18n'
import { searchCities } from '~/lib/cities'
import { cn } from '~/lib/cn'

type CityComboboxProps = {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  invalid: boolean
  describedBy?: string
}

/**
 * Searchable city field (ARIA 1.2 combobox with a listbox popup). Matches
 * Arabic and French names, ignoring accents and Arabic letter variants.
 * Free text is always allowed for places that are not in the list.
 */
export function CityCombobox({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
}: CityComboboxProps) {
  const t = useT()
  const locale = useLocale()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const closeTimer = useRef<number | undefined>(undefined)

  const suggestions = useMemo(() => {
    const list = searchCities(value, locale)
    // Nothing to suggest once the value is exactly one of the options.
    return list.length === 1 && list[0] === value ? [] : list
  }, [value, locale])
  const expanded = open && suggestions.length > 0

  function select(city: string) {
    onChange(city)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="address-level2"
        enterKeyHint="next"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => {
          window.clearTimeout(closeTimer.current)
          setOpen(true)
        }}
        onBlur={() => {
          closeTimer.current = window.setTimeout(() => setOpen(false), 120)
          onBlur()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((i) => Math.min(i + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && expanded && active >= 0) {
            e.preventDefault()
            const city = suggestions[active]
            if (city) select(city)
          } else if (e.key === 'Escape' && expanded) {
            e.preventDefault()
            setOpen(false)
          }
        }}
        className="field-input"
      />
      <div
        id={listId}
        role="listbox"
        aria-label={t('orderForm.citySuggestions')}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-field border border-sand-deep bg-white py-1 shadow-lift"
      >
        {suggestions.map((city, i) => (
          // Focus stays on the input (aria-activedescendant); keys are handled there.
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled by the combobox input
          <div
            key={city}
            id={`${listId}-${i}`}
            role="option"
            tabIndex={-1}
            aria-selected={i === active}
            // mousedown fires before the input's blur: keep focus, then select.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(city)}
            className={cn(
              'flex min-h-11 cursor-pointer items-center px-4 text-ink',
              i === active ? 'bg-oil-soft' : 'hover:bg-sand/60',
            )}
          >
            {city}
          </div>
        ))}
      </div>
    </div>
  )
}
