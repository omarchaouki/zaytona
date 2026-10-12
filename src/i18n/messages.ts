import ar from './ar.json'
import type { Locale } from './config'
import fr from './fr.json'

/* Compile-time parity check: both files must have exactly the same keys. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> }
const _frHasEveryArKey: Shape<typeof ar> = fr
const _arHasEveryFrKey: Shape<typeof fr> = ar
void _frHasEveryArKey
void _arHasEveryFrKey

export type Messages = Shape<typeof ar>

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Messages>

export const messages: Record<Locale, Messages> = { ar, fr }

export type TranslateParams = Record<string, string | number>

export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  let node: unknown = messages[locale]
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  if (typeof node !== 'string') {
    // Unreachable with a typed key; keeps a visible marker if JSON is edited by hand.
    return key
  }
  if (!params) return node
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}
