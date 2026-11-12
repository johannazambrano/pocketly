<script setup lang="ts">
/**
 * L'intestazione segue le convenzioni della piattaforma:
 * - iPhone: barra traslucida senza titolo (il titolo grande sta nella pagina), l'anno a sinistra come pulsante a
 *   tendina nella tinta, il "+" a destra in un cerchio tenue;
 * - Android: barra in alto (top app bar) con il nome della pagina, l'anno e lo stato della sincronizzazione; il "+" è
 *   il pulsante flottante in basso (vedi `BottomNav`), salvo su schermi larghi dove sta qui;
 * - PC: barra chiara con il marchio, l'anno e il pulsante "+ Nuova spesa" con il nome dell'azione.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useFormat } from '@/i18n'
import { TABS } from '@/router'
import { useAppearanceStore } from '@/stores/appearance'
import { useFinanceStore } from '@/stores/finance'
import { useSyncStore } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'

const { t, month } = useFormat()
const route = useRoute()
const appearance = useAppearanceStore()
const finance = useFinanceStore()
const sync = useSyncStore()
const ui = useUiStore()

/**
 * Il nome della pagina per la barra di Android: quello della voce di menu, anche per le pagine di approfondimento.
 * Sulla dashboard è il periodo che si sta guardando ("Novembre 2026", "Tutto il 2026"): lo stato del selettore si legge
 * sempre in alto, anche quando il selettore è scorso via.
 */
const pageTitle = computed(() => {
  if (route.name === 'dashboard') {
    const year = finance.selectedYear
    return finance.selectedMonth === 'all' ? t('dashboard.yearTitle', { year }) : `${month(finance.selectedMonth)} ${year}`
  }
  const name = (route.meta.navParent as string | undefined) ?? (route.name as string | undefined)
  return TABS.some((tab) => tab.name === name) ? t(`nav.${name}`) : t('app.name')
})

const yearSelect = computed(() => {
  switch (appearance.platform) {
    case 'ios':
      return 'h-11 rounded-lg bg-transparent pr-1 text-[17px] font-medium text-accent'
    case 'android':
      return 'h-8 rounded-lg border border-line-strong bg-transparent px-2 text-sm font-medium text-ink-3'
    default:
      return 'h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm font-semibold text-ink-2'
  }
})
</script>

<template>
  <header
    class="pt-safe px-safe sticky top-0 z-40"
    :class="{
      'border-b border-line-soft bg-canvas/85 backdrop-blur-xl': appearance.platform === 'ios',
      'bg-canvas': appearance.platform === 'android',
      'border-b border-line bg-surface': appearance.platform === 'desktop',
    }"
  >
    <div class="mx-auto flex max-w-xl items-center gap-2 px-4 md:max-w-6xl md:px-6" :class="appearance.platform === 'ios' ? 'py-1' : 'py-2'">
      <!-- Il nome dell'app resta il titolo principale della pagina per i lettori di schermo anche dove non si vede. -->
      <h1
        class="flex items-center gap-2 font-bold"
        :class="appearance.platform === 'desktop' ? 'text-lg text-ink' : 'sr-only'"
      >
        <i class="fa-solid fa-wallet text-accent-icon" aria-hidden="true"></i> {{ t('app.name') }}
      </h1>
      <p v-if="appearance.platform === 'android'" class="min-w-0 flex-1 truncate text-[22px] leading-7 text-ink" aria-hidden="true">
        {{ pageTitle }}
      </p>

      <select v-model.number="finance.selectedYear" :aria-label="t('app.year')" :class="yearSelect">
        <option v-for="y in finance.years" :key="y" :value="y">{{ y }}</option>
      </select>

      <span v-if="appearance.platform !== 'android'" class="flex-1"></span>

      <RouterLink
        v-if="sync.enabled"
        to="/impostazioni"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base hover:bg-surface-3"
        :aria-label="`${t('sync.headerLabel')}: ${t(`sync.status.${sync.status}`)}`"
        :title="t(`sync.status.${sync.status}`)"
      >
        <i v-if="sync.status === 'syncing'" class="fa-solid fa-arrows-rotate fa-spin text-sync"></i>
        <i v-else-if="sync.status === 'error'" class="fa-solid fa-triangle-exclamation text-caution"></i>
        <i v-else class="fa-solid fa-cloud" :class="sync.status === 'synced' ? 'text-sync' : 'text-ink-4'"></i>
      </RouterLink>

      <!-- Pulsante Cerca Omnisearch per piattaforma -->
      <button
        v-if="appearance.platform === 'ios'"
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent"
        :aria-label="t('search.title')"
        @click="ui.openSearch()"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft" aria-hidden="true">
          <i class="fa-solid fa-magnifying-glass"></i>
        </span>
      </button>
      <button
        v-else-if="appearance.platform === 'android'"
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3"
        :aria-label="t('search.title')"
        @click="ui.openSearch()"
      >
        <i class="fa-solid fa-magnifying-glass text-lg" aria-hidden="true"></i>
      </button>
      <button
        v-else
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink-3 shadow-2xs hover:bg-surface-2 transition-colors"
        :aria-label="t('search.title')"
        @click="ui.openSearch()"
      >
        <i class="fa-solid fa-magnifying-glass text-ink-4" aria-hidden="true"></i>
        <span class="hidden sm:inline">{{ t('search.title') }}</span>
        <kbd class="hidden sm:inline-flex items-center rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink-4">Ctrl K</kbd>
      </button>

      <!-- iPhone: "+" tondo nella tinta. PC (e Android su schermi larghi): pulsante con il nome dell'azione. -->
      <button
        v-if="appearance.platform === 'ios'"
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent"
        :aria-label="t('onetime.new')"
        @click="ui.quickAddOpen = true"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>
      </button>
      <button
        v-else
        type="button"
        class="btn-primary shrink-0 gap-2"
        :class="{ 'max-md:hidden': appearance.platform === 'android' }"
        @click="ui.quickAddOpen = true"
      >
        <i class="fa-solid fa-plus" aria-hidden="true"></i>{{ t('app.newExpense') }}
      </button>
    </div>
  </header>
</template>
