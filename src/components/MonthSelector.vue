<script setup lang="ts">
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { parseIsoDate } from '@/utils/dates'

const finance = useFinanceStore()
const { t, month } = useFormat()

const todayParts = computed(() => parseIsoDate(finance.today))
const currentMonth = computed(() => todayParts.value.month)
const isCurrentYear = computed(() => finance.selectedYear === todayParts.value.year)
</script>

<template>
  <div class="flex min-w-0 items-center gap-1.5">
    <button
      v-if="isCurrentYear && finance.selectedMonth !== currentMonth"
      type="button"
      class="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
      :title="t('dashboard.currentMonth')"
      @click="finance.selectedMonth = currentMonth"
    >
      {{ t('dashboard.currentMonthShort') }}
    </button>
    <select
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
