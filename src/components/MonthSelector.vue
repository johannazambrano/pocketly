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
  <div class="flex items-center gap-1.5">
    <button
      v-if="isCurrentYear && finance.selectedMonth !== currentMonth"
      type="button"
      class="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
      :title="t('dashboard.currentMonth')"
      @click="finance.selectedMonth = currentMonth"
    >
      {{ t('dashboard.currentMonthShort') }}
    </button>
    <select
      v-model="finance.selectedMonth"
      class="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm outline-none hover:bg-slate-50 focus:border-emerald-500"
      :aria-label="t('dashboard.filterMonth')"
    >
      <option value="all">{{ t('dashboard.allMonths') }}</option>
      <option v-for="m in 12" :key="m - 1" :value="m - 1">
        {{ month(m - 1) }}{{ isCurrentYear && m - 1 === currentMonth ? ` (${t('common.current')})` : '' }}
      </option>
    </select>
  </div>
</template>
