<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { parseIsoDate } from '@/utils/dates'
import { useMonthStep, type MonthTarget } from '@/composables/useMonthStep'

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

const { previous, next, go } = useMonthStep()

/** Se dopo il passo la freccia si spegne (fine dell'elenco), il focus passa al menu invece di perdersi sulla pagina. */
async function step(target: MonthTarget | null, event: MouseEvent) {
  const button = event.currentTarget as HTMLButtonElement
  if (!go(target)) return
  await nextTick()
  if (button.disabled) select.value?.focus()
}

/** Nel nome sulla freccia l'anno compare solo quando cambia: "Dicembre 2025", ma "Ottobre". */
function targetName(target: MonthTarget | null): string {
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
        @click="step(previous, $event)"
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
        @click="step(next, $event)"
      >
        <i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>
