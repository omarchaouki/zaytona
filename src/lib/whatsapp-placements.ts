/** Where a WhatsApp button sits; stored with each anonymous click. */
export const WHATSAPP_PLACEMENTS = [
  'hero',
  'floating',
  'mobile_bar',
  'products_help',
  'product_unavailable',
  'why_us',
  'onssa',
  'order_section',
  'faq_more',
  'final_cta',
  'footer',
  'confirmation',
] as const

export type WhatsappPlacement = (typeof WHATSAPP_PLACEMENTS)[number]
