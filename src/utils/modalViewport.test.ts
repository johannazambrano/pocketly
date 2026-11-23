import { describe, expect, it, vi } from 'vitest'
import {
  createBackgroundScrollLock,
  readVisualViewportBox,
  shouldPreventModalTouchMove,
  type ScrollLockDocument,
  type ScrollLockWindow,
  type ScrollableElement,
} from './modalViewport'

function makeEnv(opts: { scrollX?: number; scrollY?: number; innerWidth?: number; clientWidth?: number } = {}) {
  const scrollTo = vi.fn()
  const doc: ScrollLockDocument = {
    documentElement: {
      clientWidth: opts.clientWidth ?? 390,
      style: { overflow: '', overscrollBehavior: '' },
    },
    body: {
      style: {
        overflow: '',
        overscrollBehavior: '',
        position: '',
        top: '',
        left: '',
        right: '',
        width: '',
        paddingRight: '',
      },
    },
  }
  const win: ScrollLockWindow = {
    scrollX: opts.scrollX ?? 0,
    scrollY: opts.scrollY ?? 0,
    innerWidth: opts.innerWidth ?? 390,
    scrollTo,
  }
  return { doc, win, scrollTo }
}

const verticalBox = (overrides: Partial<ScrollableElement> = {}): ScrollableElement => ({
  scrollTop: 80,
  scrollHeight: 900,
  clientHeight: 400,
  scrollLeft: 0,
  scrollWidth: 360,
  clientWidth: 360,
  ...overrides,
})

const horizontalStrip = (overrides: Partial<ScrollableElement> = {}): ScrollableElement => ({
  scrollTop: 0,
  scrollHeight: 36,
  clientHeight: 36,
  scrollLeft: 40,
  scrollWidth: 600,
  clientWidth: 320,
  ...overrides,
})

describe('readVisualViewportBox', () => {
  it('legge altezza e offsetTop quando non c è zoom', () => {
    expect(readVisualViewportBox({ height: 482.4, offsetTop: 12.6, scale: 1 })).toEqual({ top: 13, height: 482 })
    expect(readVisualViewportBox({ height: 844, offsetTop: -4, scale: 1 })).toEqual({ top: 0, height: 844 })
  })

  it('restituisce null con pinch-zoom attivo o viewport non valido', () => {
    expect(readVisualViewportBox({ height: 400, offsetTop: 0, scale: 1.5 })).toBeNull()
    expect(readVisualViewportBox({ height: 0, offsetTop: 0, scale: 1 })).toBeNull()
    expect(readVisualViewportBox(null)).toBeNull()
  })
})

describe('createBackgroundScrollLock', () => {
  it('blocca html e body salvando scrollY e compensando la scrollbar desktop, poi ripristina tutto', () => {
    const env = makeEnv({ scrollX: 0, scrollY: 320, innerWidth: 1280, clientWidth: 1265 })
    const lock = createBackgroundScrollLock(() => env)

    lock.lock()
    expect(lock.isLocked()).toBe(true)
    expect(env.doc.documentElement.style.overflow).toBe('hidden')
    expect(env.doc.documentElement.style.overscrollBehavior).toBe('none')
    expect(env.doc.body.style.position).toBe('fixed')
    expect(env.doc.body.style.top).toBe('-320px')
    expect(env.doc.body.style.width).toBe('100%')
    expect(env.doc.body.style.paddingRight).toBe('15px')

    // Una seconda lock (es. conferma sopra un modulo) non sovrascrive scrollY anche se window.scrollY è passato a 0.
    env.win.scrollY = 0
    lock.lock()
    expect(env.doc.body.style.top).toBe('-320px')

    lock.unlock()
    expect(lock.isLocked()).toBe(false)
    expect(env.doc.documentElement.style.overflow).toBe('')
    expect(env.doc.documentElement.style.overscrollBehavior).toBe('')
    expect(env.doc.body.style.position).toBe('')
    expect(env.doc.body.style.top).toBe('')
    expect(env.doc.body.style.paddingRight).toBe('')
    expect(env.scrollTo).toHaveBeenCalledWith(0, 320)
  })
})

describe('shouldPreventModalTouchMove', () => {
  it('blocca sempre fuori dal corpo scorrevole (sfondo o intestazione) e nelle modali corte senza overflow', () => {
    expect(
      shouldPreventModalTouchMove({ inScrollBody: false, dx: 0, dy: -20, xScroller: null, yScroller: verticalBox() }),
    ).toBe(true)
    expect(
      shouldPreventModalTouchMove({ inScrollBody: true, dx: 0, dy: -20, xScroller: null, yScroller: null }),
    ).toBe(true)
    expect(
      shouldPreventModalTouchMove({ inScrollBody: true, dx: 15, dy: 12, xScroller: null, yScroller: null }),
    ).toBe(true)
  })

  it('consente lo scorrimento verticale interno e blocca il trascinamento oltre i bordi top/bottom', () => {
    const mid = verticalBox({ scrollTop: 80 })
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 0, dy: -15, xScroller: null, yScroller: mid })).toBe(false)
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 0, dy: 15, xScroller: null, yScroller: mid })).toBe(false)

    const atTop = verticalBox({ scrollTop: 0 })
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 0, dy: 10, xScroller: null, yScroller: atTop })).toBe(true)
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 0, dy: -10, xScroller: null, yScroller: atTop })).toBe(false)

    const atBottom = verticalBox({ scrollTop: 500, scrollHeight: 900, clientHeight: 400 })
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 0, dy: -10, xScroller: null, yScroller: atBottom })).toBe(true)
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 0, dy: 10, xScroller: null, yScroller: atBottom })).toBe(false)
  })

  it('blocca i gesti orizzontali e circolari sul modulo, ma preserva lo scorrimento orizzontale dei Frequenti', () => {
    const mid = verticalBox({ scrollTop: 80 })
    // Scorrimento orizzontale puro senza xScroller -> bloccato
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 20, dy: 0, xScroller: null, yScroller: mid })).toBe(true)
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: -18, dy: 4, xScroller: null, yScroller: mid })).toBe(true)

    // Lieve arco del pollice in un gesto quasi verticale -> non interrompe lo scroll verticale
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 6, dy: -5.5, xScroller: null, yScroller: mid })).toBe(false)

    // Barra orizzontale dei Frequenti: scorre all'interno e si ferma ai bordi
    const strip = horizontalStrip({ scrollLeft: 40 })
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: -15, dy: 2, xScroller: strip, yScroller: mid })).toBe(false)
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 15, dy: 2, xScroller: strip, yScroller: mid })).toBe(false)

    const stripAtLeft = horizontalStrip({ scrollLeft: 0 })
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: 15, dy: 0, xScroller: stripAtLeft, yScroller: mid })).toBe(true)
    expect(shouldPreventModalTouchMove({ inScrollBody: true, dx: -15, dy: 0, xScroller: stripAtLeft, yScroller: mid })).toBe(false)
  })
})
