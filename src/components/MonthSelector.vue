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
const onCurrentMonth = computed(() => finance.selectedMonth === currentMonth.value)

/** Dopo "Questo mese" il pulsante si nasconde: il focus passa al menu, che resta dov'era, invece di perdersi. */
const select = ref<HTMLSelectElement | null>(null)
function goToCurrentMonth() {
  finance.selectedMonth = currentMonth.value
  select.value?.focus()
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1.5">
    <!--
      Su schermi larghi il pulsante tiene sempre il suo posto nell'anno in corso, così il menu non si sposta quando compare
      o sparisce. Sul telefono lo spazio è poco: quando non serve il pulsante sparisce del tutto.
    -->
    <button
      v-if="isCurrentYear"
      type="button"
      class="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
      :class="{ 'invisible max-md:hidden': onCurrentMonth }"
      :aria-hidden="onCurrentMonth || undefined"
      :tabindex="onCurrentMonth ? -1 : undefined"
      :title="t('dashboard.currentMonth')"
      @click="goToCurrentMonth"
    >
      {{ t('dashboard.currentMonthShort') }}
    </button>
    <select
      ref="select"
      v-model="finance.selectedMonth"
      class="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      :aria-label="t('dashboard.filterMonth')"
    >
      <option value="all">{{ t('dashboard.allMonths') }}</option>
      <option v-for="m in 12" :key="m - 1" :value="m - 1">
        {{ month(m - 1) }}{{ isCurrentYear && m - 1 === currentMonth ? ` (${t('common.current')})` : '' }}
      </option>
    </select>
  </div>
</template>
