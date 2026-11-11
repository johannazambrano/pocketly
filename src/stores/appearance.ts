import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'
import { detectPlatform, type Platform } from '@/utils/platform'

export type PlatformChoice = 'auto' | Platform
export type ThemeChoice = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const PLATFORM_KEY = 'appearance-platform'
const THEME_KEY = 'appearance-theme'

/** Le preferenze d'aspetto sono del dispositivo, come la lingua: stanno nel localStorage e non si sincronizzano. */
function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // navigazione privata: la scelta vale finché la pagina resta aperta
  }
}

/**
 * Aspetto dell'app: piattaforma (iPhone, Android, PC) e tema (chiaro, scuro). Di serie la piattaforma si riconosce dal
 * dispositivo e il tema segue il sistema; dalle Impostazioni si possono scegliere a mano. Il risultato va su <html>
 * come `data-platform` e `data-theme`, che gli stili usano per cambiare i valori dei gettoni (vedi `style.css`).
 */
export const useAppearanceStore = defineStore('appearance', () => {
  const platformChoice = ref<PlatformChoice>(read(PLATFORM_KEY, ['auto', 'ios', 'android', 'desktop'] as const, 'auto'))
  const themeChoice = ref<ThemeChoice>(read(THEME_KEY, ['system', 'light', 'dark'] as const, 'system'))

  const detected = detectPlatform({
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
  })
  const platform = computed<Platform>(() => (platformChoice.value === 'auto' ? detected : platformChoice.value))

  /** Il tema del sistema, seguito anche mentre l'app è aperta (per esempio quando il telefono passa allo scuro di sera). */
  const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const systemDark = ref(media?.matches ?? false)
  media?.addEventListener?.('change', (e) => (systemDark.value = e.matches))
  const theme = computed<Theme>(() =>
    themeChoice.value === 'system' ? (systemDark.value ? 'dark' : 'light') : themeChoice.value,
  )

  function setPlatform(choice: PlatformChoice) {
    platformChoice.value = choice
    write(PLATFORM_KEY, choice)
  }
  function setTheme(choice: ThemeChoice) {
    themeChoice.value = choice
    write(THEME_KEY, choice)
  }

  if (typeof document !== 'undefined') {
    watchEffect(() => {
      const root = document.documentElement
      root.dataset.platform = platform.value
      root.dataset.theme = theme.value
      // I controlli del browser (campi data, menu, barre di scorrimento) seguono lo stesso tema.
      root.style.colorScheme = theme.value
    })
  }

  return { platformChoice, themeChoice, platform, theme, detected, setPlatform, setTheme }
})
