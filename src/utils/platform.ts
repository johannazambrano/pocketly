/**
 * L'aspetto dell'app segue le convenzioni del sistema su cui gira: iPhone e iPad (Apple), Android (Material 3), oppure
 * il PC (aspetto neutro). Qui si riconosce la piattaforma dal browser; la scelta a mano nelle Impostazioni la può
 * sostituire (vedi `stores/appearance.ts`).
 */
export type Platform = 'ios' | 'android' | 'desktop'

export interface PlatformHints {
  userAgent: string
  /** `navigator.maxTouchPoints`: distingue un iPad (che si presenta come Mac) da un Mac vero. */
  maxTouchPoints?: number
}

export function detectPlatform({ userAgent, maxTouchPoints = 0 }: PlatformHints): Platform {
  const ua = userAgent.toLowerCase()
  if (ua.includes('android')) return 'android'
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  // Da iPadOS 13 Safari si presenta come un Mac: lo si riconosce dallo schermo touch.
  if (ua.includes('macintosh') && maxTouchPoints > 1) return 'ios'
  return 'desktop'
}
