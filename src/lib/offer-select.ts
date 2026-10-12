/*
 * "Order this offer" buttons are plain links to #order (they scroll natively,
 * even before the page's JavaScript is ready, and never reload the page).
 * Once the app runs, a click also tells the order form which offer to select.
 */

const EVENT = 'offer:select'

export function selectOffer(slug: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: slug }))
}

export function onOfferSelect(fn: (slug: string) => void) {
  const listener = (e: Event) => fn((e as CustomEvent<string>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
