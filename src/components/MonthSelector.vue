<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { parseIsoDate } from '@/utils/dates'
import { useMonthStep, type MonthTarget } from '@/composables/useMonthStep'

const finance = useFinanceStore()
const { t, month, locale } = useFormat()

const todayParts = computed(() => parseIsoDate(finance.today))
const currentMonth = computed(() => todayParts.value.month)
const isCurrentYear = computed(() => finance.selectedYear === todayParts.value.year)
const onCurrentMonth = computed(() => isCurrentYear.value && finance.selectedMonth === currentMonth.value)

/** Dopo "Questo mese" il pulsante si nasconde: il focus passa al menu, che resta dov'era, invece di perdersi. */
const select = ref<HTMLSelectElement | null>(null)
function goToCurrentMonth() {
  finance.selectedYear = todayParts.value.year
  finance.selectedMonth = currentMonth.value
  select.value?.focus()
}

const { previous, next, go } = useMonthStep()

/**
 * Tasti ← → per il mese prima e dopo, su qualunque pagina mostri questo filtro (dashboard, dettaglio, spese variabili).
 * Non agiscono mentre si scrive, quando il focus è su un menu (lì le frecce cambiano già la scelta) o con una finestra
 * aperta.
 */
function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const el = e.target as HTMLElement | null
  if (el?.closest('input, select, textarea, [contenteditable="true"]')) return
  if (document.querySelector('[aria-modal="true"]')) return
  if (go(e.key === 'ArrowLeft' ? previous.value : next.value)) e.preventDefault()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

/** Se dopo il passo la freccia si spegne (fine dell'elenco), il focus passa al menu invece di perdersi sulla pagina. */
async function step(target: MonthTarget | null, event: MouseEvent) {
  const button = event.currentTarget as HTMLButtonElement
  if (!go(target)) return
  await nextTick()
  if (button.disabled) select.value?.focus()
}

/**
 * Nel nome sulla freccia l'anno compare solo quando cambia: "dicembre 2025", ma "ottobre". In una frase italiana il mese
 * va in minuscolo ("Vai a ottobre"); in inglese resta maiuscolo.
 */
function targetName(target: MonthTarget | null): string {
  if (!target) return ''
  const name = locale.value === 'it' ? month(target.month).toLocaleLowerCase('it') : month(target.month)
  return target.year === finance.selectedYear ? name : `${name} ${target.year}`
}
/** Da "Tutti i mesi" la freccia non va a un mese "precedente" ma entra in un mese: l'etichetta dice dove. */
const fromAll = computed(() => finance.selectedMonth === 'all')
const previousLabel = computed(() => {
  if (!previous.value) return t('dashboard.previousMonthNone')
  const args = { month: targetName(previous.value) }
  return fromAll.value ? t('dashboard.goToMonth', args) : t('dashboard.previousMonth', args)
})
const nextLabel = computed(() => {
  if (!next.value) return t('dashboard.nextMonthNone')
  const args = { month: targetName(next.value) }
  return fromAll.value ? t('dashboard.goToMonth', args) : t('dashboard.nextMonth', args)
})

const arrow =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-strong disabled:cursor-not-allowed disabled:text-ink-6 disabled:hover:bg-surface'
</script>

<template>
  <div class="flex min-w-0 items-center justify-end gap-1.5">
    <!--
      Su schermi larghi il pulsante tiene sempre il suo posto, così il menu non si sposta quando compare o sparisce.
      Sul telefono lo spazio è poco: il pulsante mostra solo l'icona e, quando non serve, sparisce del tutto.
    -->
    <button
      type="button"
      class="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs md:px-3 font-semibold text-accent transition-colors hover:bg-accent-soft-2"
      :class="{ 'invisible max-md:hidden': onCurrentMonth }"
      :aria-hidden="onCurrentMonth || undefined"
      :tabindex="onCurrentMonth ? -1 : undefined"
      :title="t('dashboard.currentMonth')"
      @click="goToCurrentMonth"
    >
      <!-- md:hidden su un contenitore: sull'icona perderebbe contro il display di Font Awesome. -->
      <span class="md:hidden" aria-hidden="true"><i class="fa-solid fa-calendar-day text-sm"></i></span>
      <span class="max-md:sr-only">{{ t('dashboard.currentMonthShort') }}</span>
    </button>

    <!-- Frecce e menu formano un solo controllo: ‹ mese › -->
    <!-- Niente overflow-hidden: taglierebbe il contorno del focus. Gli angoli li arrotondano le frecce. -->
    <div class="flex min-w-0 items-center rounded-lg border border-line bg-surface shadow-sm">
      <button
        type="button"
        :class="[arrow, 'rounded-l-lg border-r border-line']"
        :disabled="!previous"
        :aria-label="previousLabel"
        :title="previousLabel"
        @click="step(previous, $event)"
      >
        <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
      </button>
      <select
        ref="select"
        v-model="finance.selectedMonth"
        class="h-10 min-w-0 bg-surface px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2"
        :aria-label="t('dashboard.filterMonth')"
      >
        <option value="all">{{ t('dashboard.allMonths') }}</option>
        <option v-for="m in 12" :key="m - 1" :value="m - 1">
          {{ month(m - 1) }}{{ isCurrentYear && m - 1 === currentMonth ? ` (${t('common.current')})` : '' }}
        </option>
      </select>
      <button
        type="button"
        :class="[arrow, 'rounded-r-lg border-l border-line']"
        :disabled="!next"
        :aria-label="nextLabel"
        :title="nextLabel"
        @click="step(next, $event)"
      >
        <i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>
