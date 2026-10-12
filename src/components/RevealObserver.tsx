import { useEffect } from 'react'

/**
 * Marks [data-reveal] elements as revealed when they scroll into view (one
 * shared IntersectionObserver). A MutationObserver picks up elements added
 * later (route changes, "load more", form steps), so everything animates.
 */
export function RevealObserver() {
  useEffect(() => {
    const reveal = (el: Element) => {
      ;(el as HTMLElement).dataset.revealed = ''
    }
    if (!('IntersectionObserver' in window)) {
      for (const el of document.querySelectorAll('[data-reveal]')) reveal(el)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          reveal(entry.target)
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    const watch = (root: ParentNode) => {
      for (const el of root.querySelectorAll('[data-reveal]:not([data-revealed])')) io.observe(el)
    }
    watch(document)
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches('[data-reveal]:not([data-revealed])')) io.observe(node)
          watch(node)
        }
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])
  return null
}
