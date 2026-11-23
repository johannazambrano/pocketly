/**
 * Gestione del viewport e del blocco scroll per le finestre modali (`BaseModal.vue`), pensata in particolare per iOS
 * Safari e PWA su iPhone:
 * - blocca davvero lo sfondo (`html` + `body` `position: fixed` con ripristino della posizione di scorrimento),
 *   evitando il rimbalzo o trascinamento della pagina dietro la modale;
 * - segue `window.visualViewport` quando la tastiera virtuale riduce lo spazio visibile (senza interferire con lo
 *   zoom a due dita per l'accessibilità);
 * - impedisce ai gesti touch a un dito fuori dall'area scorrevole (o su assi e bordi senza scorrimento) di muovere
 *   il contenuto in 2D.
 */

export interface VisualViewportLike {
  height: number
  offsetTop: number
  scale?: number
}

export interface ViewportBox {
  top: number
  height: number
}

/**
 * Ricava posizione verticale e altezza del viewport visibile (es. spazio sopra la tastiera su iPhone).
 * Se l'utente ha ingrandito la pagina con pinch-zoom (`scale > 1.01`) restituisce `null` per non rimpicciolire la
 * finestra modale.
 */
export function readVisualViewportBox(vv: VisualViewportLike | null | undefined): ViewportBox | null {
  if (!vv || !Number.isFinite(vv.height) || vv.height <= 0) return null
  if (typeof vv.scale === 'number' && vv.scale > 1.01) return null
  const top = Number.isFinite(vv.offsetTop) ? Math.max(0, Math.round(vv.offsetTop)) : 0
  return { top, height: Math.round(vv.height) }
}

export interface StyleTarget {
  overflow: string
  overscrollBehavior: string
  position?: string
  top?: string
  left?: string
  right?: string
  width?: string
  paddingRight?: string
}

export interface ScrollLockDocument {
  documentElement: { style: StyleTarget; clientWidth: number }
  body: { style: StyleTarget }
}

export interface ScrollLockWindow {
  scrollX: number
  scrollY: number
  innerWidth: number
  scrollTo: (x: number, y: number) => void
}

interface SavedScrollState {
  scrollX: number
  scrollY: number
  htmlOverflow: string
  htmlOverscroll: string
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyRight: string
  bodyWidth: string
  bodyOverflow: string
  bodyOverscroll: string
  bodyPaddingRight: string
}

/**
 * Blocco dello scroll di sfondo compatibile con iOS WebKit: fissa `body` alla quota corrente (`top: -scrollY`) e
 * blocca `html`, compensando l'eventuale barra di scorrimento su desktop. Idempotente: chiamate ripetute a `lock()`
 * (modali sovrapposte) non sovrascrivono la posizione salvata.
 */
export function createBackgroundScrollLock(getEnv?: () => { doc: ScrollLockDocument; win: ScrollLockWindow } | null) {
  let saved: SavedScrollState | null = null

  function resolveEnv() {
    if (getEnv) return getEnv()
    if (typeof document === 'undefined' || typeof window === 'undefined') return null
    return { doc: document, win: window }
  }

  function lock() {
    if (saved) return
    const env = resolveEnv()
    if (!env) return
    const { doc, win } = env
    const htmlStyle = doc.documentElement.style
    const bodyStyle = doc.body.style
    const scrollX = win.scrollX || 0
    const scrollY = win.scrollY || 0
    const scrollbarWidth = Math.max(0, win.innerWidth - doc.documentElement.clientWidth)

    saved = {
      scrollX,
      scrollY,
      htmlOverflow: htmlStyle.overflow,
      htmlOverscroll: htmlStyle.overscrollBehavior,
      bodyPosition: bodyStyle.position ?? '',
      bodyTop: bodyStyle.top ?? '',
      bodyLeft: bodyStyle.left ?? '',
      bodyRight: bodyStyle.right ?? '',
      bodyWidth: bodyStyle.width ?? '',
      bodyOverflow: bodyStyle.overflow,
      bodyOverscroll: bodyStyle.overscrollBehavior,
      bodyPaddingRight: bodyStyle.paddingRight ?? '',
    }

    htmlStyle.overflow = 'hidden'
    htmlStyle.overscrollBehavior = 'none'
    bodyStyle.position = 'fixed'
    bodyStyle.top = `${-scrollY}px`
    bodyStyle.left = '0'
    bodyStyle.right = '0'
    bodyStyle.width = '100%'
    bodyStyle.overflow = 'hidden'
    bodyStyle.overscrollBehavior = 'none'
    if (scrollbarWidth > 0 && !saved.bodyPaddingRight) {
      bodyStyle.paddingRight = `${scrollbarWidth}px`
    }
  }

  function unlock() {
    if (!saved) return
    const env = resolveEnv()
    const state = saved
    saved = null
    if (!env) return
    const { doc, win } = env
    const htmlStyle = doc.documentElement.style
    const bodyStyle = doc.body.style

    htmlStyle.overflow = state.htmlOverflow
    htmlStyle.overscrollBehavior = state.htmlOverscroll
    bodyStyle.position = state.bodyPosition
    bodyStyle.top = state.bodyTop
    bodyStyle.left = state.bodyLeft
    bodyStyle.right = state.bodyRight
    bodyStyle.width = state.bodyWidth
    bodyStyle.overflow = state.bodyOverflow
    bodyStyle.overscrollBehavior = state.bodyOverscroll
    bodyStyle.paddingRight = state.bodyPaddingRight

    win.scrollTo(state.scrollX, state.scrollY)
  }

  return {
    lock,
    unlock,
    isLocked: () => saved !== null,
  }
}

export interface ScrollableElement {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}

export interface ModalTouchDecisionInput {
  /** Il tocco è partito dentro il corpo scorrevole del foglio (non su sfondo o intestazione). */
  inScrollBody: boolean
  /** Spostamento orizzontale del dito rispetto al campione precedente (> 0 verso destra). */
  dx: number
  /** Spostamento verticale del dito rispetto al campione precedente (> 0 verso il basso). */
  dy: number
  /** Eventuale contenitore con scorrimento orizzontale interno al corpo (es. chip «Frequenti»). */
  xScroller: ScrollableElement | null
  /** Contenitore con scorrimento verticale (il corpo del foglio o una lista interna). */
  yScroller: ScrollableElement | null
}

/**
 * Decide se bloccare un evento `touchmove` dentro una modale aperta per impedire ad iOS Safari di trascinare o far
 * rimbalzare il viewport in 2D:
 * - fuori dal corpo scorrevole (sfondo, maniglia, intestazione): blocca sempre;
 * - senza overflow su nessun asse (modale corta): blocca sempre;
 * - dentro uno scroller orizzontale interno (es. chip «Frequenti» con `overscroll-x-contain`): lascia passare gesti
 *   con componente orizzontale così micro-oscillazioni del dito o `scrollLeft === 0` non annullano lo scroll su iOS;
 * - altrove su gesti orizzontali/2D: blocca;
 * - su gesti verticali: consente solo finché lo scroller verticale non sta tirando oltre il bordo superiore o inferiore.
 */
export function shouldPreventModalTouchMove({ inScrollBody, dx, dy, xScroller, yScroller }: ModalTouchDecisionInput): boolean {
  if (!inScrollBody) return true
  if (!xScroller && !yScroller) return true

  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX === 0 && absY === 0) return false

  if (xScroller && absX >= absY * 0.5) return false

  if (absX > absY) {
    if (!yScroller) return true
    // Gesto nettamente orizzontale (o rotatorio) senza scroller X: blocca; tollera un lieve arco del pollice in verticale.
    if (absX > absY * 1.2) return true
  }

  if (!yScroller) return true
  const atTop = yScroller.scrollTop <= 0
  const atBottom = yScroller.scrollTop + yScroller.clientHeight >= yScroller.scrollHeight - 1
  return (atTop && dy > 0) || (atBottom && dy < 0)
}

function isScrollableOverflow(value: string): boolean {
  return value === 'auto' || value === 'scroll' || value === 'overlay'
}

/**
 * Risale dal nodo toccato fino a `scrollBody` cercando gli eventuali contenitori realmente scorrevoli su X e su Y.
 * `scrollBody` stesso ha `overflow-x: hidden`, quindi viene valutato solo per lo scorrimento verticale.
 */
export function findModalScrollables(
  target: EventTarget | null,
  scrollBody: HTMLElement | null,
): { inScrollBody: boolean; xScroller: ScrollableElement | null; yScroller: ScrollableElement | null } {
  if (!scrollBody || typeof Node === 'undefined' || !(target instanceof Node)) {
    return { inScrollBody: false, xScroller: null, yScroller: null }
  }
  const start: Element | null = target instanceof Element ? target : target.parentElement
  if (!start || !scrollBody.contains(start)) {
    return { inScrollBody: false, xScroller: null, yScroller: null }
  }

  let xScroller: ScrollableElement | null = null
  let yScroller: ScrollableElement | null = null
  let el: Element | null = start

  while (el) {
    const style = getComputedStyle(el)
    if (!xScroller && el !== scrollBody && isScrollableOverflow(style.overflowX) && el.scrollWidth > el.clientWidth + 1) {
      xScroller = el
    }
    if (!yScroller && isScrollableOverflow(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      yScroller = el
    }
    if (el === scrollBody) break
    el = el.parentElement
  }

  return { inScrollBody: true, xScroller, yScroller }
}

export function isRangeInput(target: EventTarget | null): boolean {
  return typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement && target.type === 'range'
}

export interface HorizontalScrollerCandidate {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}

/**
 * Su iOS WebKit, quando una modale apre subito la tastiera (`initialFocus`) durante la transizione di ingresso e il
 * ridimensionamento di `visualViewport`, un contenitore `overflow-x: auto` annidato nel corpo può non attivare subito
 * il proprio `WKChildScrollView`. Un micro-aggiornamento sincrono pre-paint (`1 -> 0`) sui soli contenitori fermi a
 * `scrollLeft === 0` forza WebKit a registrarlo senza alcun salto visivo.
 */
export function nudgeHorizontalScrollers(
  root: { querySelectorAll: (selector: string) => Iterable<HorizontalScrollerCandidate> } | null,
  getOverflowX?: (el: HorizontalScrollerCandidate) => string,
): void {
  if (!root) return
  const resolveOverflowX =
    getOverflowX ??
    ((el) => (typeof getComputedStyle === 'function' ? getComputedStyle(el as unknown as Element).overflowX : ''))
  const candidates: HorizontalScrollerCandidate[] = []
  for (const el of root.querySelectorAll('*')) {
    if (el.scrollLeft !== 0) continue
    if (!isScrollableOverflow(resolveOverflowX(el))) continue
    if (el.scrollWidth > el.clientWidth + 1) candidates.push(el)
  }
  for (const el of candidates) {
    el.scrollLeft = 1
    el.scrollLeft = 0
  }
}
