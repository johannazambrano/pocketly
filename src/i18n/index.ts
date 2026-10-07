import { computed } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import it from './it'
import en from './en'
import { formatCents } from '@/utils/money'
import { formatDate, monthName } from '@/utils/dates'
import type { Cents, IsoDate } from '@/types/models'

export const LOCALES = [
  { code: 'it', label: 'Italiano', intl: 'it-IT' },
  { code: 'en', label: 'English', intl: 'en-GB' },
] as const

export type LocaleCode = (typeof LOCALES)[number]['code']

const STORAGE_KEY = 'locale'

function detectLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (LOCALES.some((l) => l.code === saved)) return saved as LocaleCode
  } catch {
    // localStorage non disponibile (es. navigazione privata)
  }
  return navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { it, en },
})

export function setLocale(code: LocaleCode) {
  i18n.global.locale.value = code
  document.documentElement.lang = code
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // ignora: la lingua tornerà quella del browser al prossimo avvio
  }
}

/** Traduzioni più formattatori di importi, date e mesi nella lingua corrente. */
export function useFormat() {
  const { t, locale } = useI18n()
  const intl = computed(() => LOCALES.find((l) => l.code === locale.value)?.intl ?? 'it-IT')
  return {
    t,
    locale,
    money: (cents: Cents) => formatCents(cents, intl.value),
    date: (d: IsoDate) => formatDate(d, intl.value),
    month: (m: number, style: 'long' | 'short' = 'long') => monthName(m, intl.value, style),
    percent: (ratio: number) =>
      new Intl.NumberFormat(intl.value, { style: 'percent', maximumFractionDigits: 1 }).format(ratio),
  }
}
