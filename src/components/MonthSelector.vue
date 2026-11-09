<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { parseIsoDate } from '@/utils/dates'

const finance = useFinanceStore()
const { t, month } = useFormat()

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

/**
 * Il mese prima o dopo quello scelto. Da gennaio si torna a dicembre dell'anno prima, da dicembre si va a gennaio
 * dell'anno dopo, ma solo verso anni che compaiono nel menu dell'anno in alto. Con "Tutti i mesi" non c'è un mese da cui partire.
 */
function neighbour(delta: -1 | 1): { year: number; month: number } | null {
  if (finance.selectedMonth === 'all') return null
  let m = finance.selectedMonth + delta
  let y = finance.selectedYear
  if (m < 0) {
    m = 11
    y -= 1
  } else if (m > 11) {
    m = 0
    y += 1
  }
  return finance.years.includes(y) ? { year: y, month: m } : null
}
const previous = computed(() => neighbour(-1))
const next = computed(() => neighbour(1))

function go(target: { year: number; month: number } | null) {
  if (!target) return
  finance.selectedYear = target.year
  finance.selectedMonth = target.month
}

/** Nel nome sulla freccia l'anno compare solo quando cambia: "Dicembre 2025", ma "Ottobre". */
function targetName(target: { year: number; month: number } | null): string {
  if (!target) return ''
  return target.year === finance.selectedYear ? month(target.month) : `${month(target.month)} ${target.year}`
}
const previousLabel = computed(() =>
  previous.value ? t('dashboard.previousMonth', { month: targetName(previous.value) }) : t('dashboard.previousMonthNone'),
)
const nextLabel = computed(() =>
  next.value ? t('dashboard.nextMonth', { month: targetName(next.value) }) : t('dashboard.nextMonthNone'),
)

const arrow =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white'
</script>

<template>
  <div class="flex min-w-0 items-center justify-end gap-1.5">
    <!--
      Su schermi larghi il pulsante tiene sempre il suo posto, così il menu non si sposta quando compare o sparisce.
      Sul telefono lo spazio è poco: il pulsante mostra solo l'icona e, quando non serve, sparisce del tutto.
    -->
    <button
      type="button"
      class="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs md:px-3 font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
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
    <div class="flex min-w-0 items-center rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        :class="[arrow, 'rounded-l-lg border-r border-slate-200']"
        :disabled="!previous"
        :aria-label="previousLabel"
        :title="previousLabel"
        @click="go(previous)"
      >
        <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
      </button>
      <select
        ref="select"
        v-model="finance.selectedMonth"
        class="h-10 min-w-0 bg-white px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        :aria-label="t('dashboard.filterMonth')"
      >
        <option value="all">{{ t('dashboard.allMonths') }}</option>
        <option v-for="m in 12" :key="m - 1" :value="m - 1">
          {{ month(m - 1) }}{{ isCurrentYear && m - 1 === currentMonth ? ` (${t('common.current')})` : '' }}
        </option>
      </select>
      <button
        type="button"
        :class="[arrow, 'rounded-r-lg border-l border-slate-200']"
        :disabled="!next"
        :aria-label="nextLabel"
        :title="nextLabel"
        @click="go(next)"
      >
        <i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>
