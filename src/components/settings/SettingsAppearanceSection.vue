<script setup lang="ts">
import { useAppearanceStore, type PlatformChoice, type ThemeChoice } from '@/stores/appearance'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { LOCALES, setLocale, useFormat, type LocaleCode } from '@/i18n'

const appearance = useAppearanceStore()
const finance = useFinanceStore()
const ui = useUiStore()
const { t, locale } = useFormat()

/** Aspetto e tema: di serie automatici, si possono fissare a mano (preferenze di questo dispositivo). */
const PLATFORM_CHOICES: PlatformChoice[] = ['auto', 'ios', 'android', 'desktop']
const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark']

function changeLocale(code: LocaleCode) {
  setLocale(code)
}

/** "Riarmonizza i colori": sostituisce anche i colori scelti a mano, quindi si chiede prima. */
async function harmonize() {
  const ok = await ui.confirm({
    title: t('settings.harmonizeTitle'),
    message: t('settings.harmonizeMessage'),
    confirmLabel: t('settings.harmonize'),
  })
  if (!ok) return
  finance.harmonizeColors()
  ui.toast(t('settings.harmonizeDone'))
}
</script>

<template>
  <div class="space-y-4">
    <div class="card space-y-3">
      <h3 class="text-sm font-semibold text-ink-2">
        <i class="fa-solid fa-palette mr-1 text-recurring" aria-hidden="true"></i> {{ t('settings.appearance') }}
      </h3>
      <div class="space-y-1">
        <p id="appearance-platform" class="text-xs font-medium text-ink-3">{{ t('settings.platform') }}</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="appearance-platform">
          <button
            v-for="c in PLATFORM_CHOICES"
            :key="c"
            type="button"
            class="min-h-10 rounded-lg border px-3 text-sm font-medium"
            :class="appearance.platformChoice === c ? 'border-accent-icon bg-accent-soft text-accent' : 'border-line-strong text-ink-3'"
            :aria-pressed="appearance.platformChoice === c"
            @click="appearance.setPlatform(c)"
          >
            {{ t(`settings.platforms.${c}`) }}
          </button>
        </div>
        <p v-if="appearance.platformChoice === 'auto'" class="text-xs text-ink-4">
          {{ t('settings.platformDetected', { platform: t(`settings.platforms.${appearance.detected}`) }) }}
        </p>
      </div>
      <div class="space-y-1">
        <p id="appearance-theme" class="text-xs font-medium text-ink-3">{{ t('settings.theme') }}</p>
        <div class="grid grid-cols-3 gap-2" role="group" aria-labelledby="appearance-theme">
          <button
            v-for="c in THEME_CHOICES"
            :key="c"
            type="button"
            class="min-h-10 rounded-lg border px-3 text-sm font-medium"
            :class="appearance.themeChoice === c ? 'border-accent-icon bg-accent-soft text-accent' : 'border-line-strong text-ink-3'"
            :aria-pressed="appearance.themeChoice === c"
            @click="appearance.setTheme(c)"
          >
            {{ t(`settings.themes.${c}`) }}
          </button>
        </div>
      </div>
    </div>

    <div class="card space-y-3">
      <h3 class="text-sm font-semibold text-ink-2">
        <i class="fa-solid fa-language mr-1 text-recurring" aria-hidden="true"></i> {{ t('settings.language') }}
      </h3>
      <div class="flex gap-2">
        <button
          v-for="l in LOCALES"
          :key="l.code"
          type="button"
          class="min-h-10 flex-1 rounded-lg border px-3 text-sm font-medium"
          :class="locale === l.code ? 'border-accent-icon bg-accent-soft text-accent' : 'border-line-strong text-ink-3'"
          :aria-pressed="locale === l.code"
          @click="changeLocale(l.code)"
        >
          {{ l.label }}
        </button>
      </div>
    </div>

    <div class="card space-y-3">
      <h3 class="text-sm font-semibold text-ink-2">
        <i class="fa-solid fa-swatchbook mr-1 text-recurring" aria-hidden="true"></i> {{ t('settings.colorsTitle') }}
      </h3>
      <p class="text-xs text-ink-4">{{ t('settings.colorsHint') }}</p>
      <button
        type="button"
        class="flex min-h-10 w-full items-center justify-center rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
        @click="harmonize"
      >
        {{ t('settings.harmonize') }}
      </button>
    </div>
  </div>
</template>
