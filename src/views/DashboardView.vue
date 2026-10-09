<script setup lang="ts">
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { upcomingCharges } from '@/domain/calculations'
import { todayIso } from '@/utils/dates'
import KpiCard from '@/components/KpiCard.vue'
import BreakdownList from '@/components/BreakdownList.vue'

const finance = useFinanceStore()
const { t, money, month, date } = useFormat()

const s = computed(() => finance.summary)
const grandTotal = computed(() => s.value.totalExpenses || 1)
const upcoming = computed(() => upcomingCharges(finance.data, todayIso(), 30))
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800">{{ t('dashboard.title') }}</h2>
      <span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
        {{ t('dashboard.period', { from: month(s.periodStartMonth, 'short'), to: month(11, 'short'), year: finance.selectedYear }) }}
      </span>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard :label="t('dashboard.income')" :value="money(s.totalIncome)" color="text-emerald-600" />
      <KpiCard :label="t('dashboard.expenses')" :value="money(s.totalExpenses)" color="text-rose-600" />
      <KpiCard
        :label="t('dashboard.balance')"
        :value="money(s.balance)"
        :color="s.balance >= 0 ? 'text-blue-600' : 'text-rose-600'"
      />
      <KpiCard :label="t('dashboard.monthlyRecurring')" :value="money(Math.round(s.monthlyRecurring))" color="text-indigo-600" />
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="card space-y-3 md:col-span-2">
        <h3 class="text-sm font-semibold text-slate-700">
          <i class="fa-solid fa-calendar-day mr-1 text-indigo-600"></i> {{ t('dashboard.upcoming') }}
        </h3>
        <ul v-if="upcoming.length" class="divide-y divide-slate-100 text-xs">
          <li v-for="c in upcoming" :key="c.id" class="flex items-center justify-between gap-2 py-1.5">
            <div class="min-w-0">
              <div class="truncate font-medium">{{ c.name }}</div>
              <div class="text-[11px] text-slate-400">{{ date(c.date) }} · {{ t('dashboard.dueIn', c.daysLeft) }}</div>
            </div>
            <span class="shrink-0 font-semibold" :class="c.daysLeft <= 3 ? 'text-rose-600' : 'text-slate-700'">{{ money(c.amount) }}</span>
          </li>
        </ul>
        <p v-else class="text-xs text-slate-400">{{ t('dashboard.noUpcoming') }}</p>
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">{{ t('dashboard.byCategory') }}</h3>
        <BreakdownList kind="categories" :totals="s.byCategory" :grand-total="grandTotal" :empty-text="t('dashboard.empty')" />
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">{{ t('dashboard.byPayment') }}</h3>
        <BreakdownList kind="paymentMethods" :totals="s.byPaymentMethod" :grand-total="grandTotal" :empty-text="t('dashboard.empty')" />
      </div>
    </div>
  </section>
</template>
