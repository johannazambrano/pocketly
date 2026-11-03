<script setup lang="ts">
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { upcomingCharges } from '@/domain/calculations'
import { todayIso } from '@/utils/dates'
import KpiCard from '@/components/KpiCard.vue'
import BreakdownList from '@/components/BreakdownList.vue'
import MonthSelector from '@/components/MonthSelector.vue'

const finance = useFinanceStore()
const { t, money, month, date, locale } = useFormat()

const s = computed(() => finance.summary)
const isPastYear = computed(() => finance.selectedYear < new Date().getFullYear())
const grandTotal = computed(() => s.value.totalExpenses || 1)
const upcoming = computed(() => upcomingCharges(finance.data, todayIso(), 30))

const selectedMonthName = computed(() => {
  if (finance.selectedMonth === 'all') return ''
  const name = month(finance.selectedMonth)
  return locale.value === 'it' ? name.toLocaleLowerCase('it') : name
})

const displayIncome = computed(() => {
  return finance.isMonthFiltered ? finance.monthSummaryData!.income : s.value.incomeToDate
})
const incomeLabel = computed(() => {
  return finance.isMonthFiltered
    ? t('dashboard.incomeMonth', { month: selectedMonthName.value })
    : t('dashboard.income')
})

const displayExpenses = computed(() => {
  return finance.isMonthFiltered ? finance.monthSummaryData!.expenses : s.value.expensesToDate
})
const expensesLabel = computed(() => {
  if (finance.isMonthFiltered) {
    return t('dashboard.expensesMonth', { month: selectedMonthName.value })
  }
  return t(isPastYear.value ? 'dashboard.expenses' : 'dashboard.expensesToDate')
})
const expensesHint = computed(() => {
  if (finance.isMonthFiltered) return undefined
  return isPastYear.value ? undefined : t('dashboard.expensesHint')
})

const displayBalance = computed(() => {
  return finance.isMonthFiltered ? finance.monthSummaryData!.balance : s.value.balanceToDate
})
const balanceLabel = computed(() => {
  if (finance.isMonthFiltered) {
    return t('dashboard.balanceMonth', { month: selectedMonthName.value })
  }
  return t(isPastYear.value ? 'dashboard.balanceYear' : 'dashboard.balanceToDate')
})

const categoryTotals = computed(() => {
  return finance.isMonthFiltered ? finance.monthSummaryData!.byCategory : s.value.byCategory
})
const categoryGrandTotal = computed(() => {
  return finance.isMonthFiltered ? (finance.monthSummaryData!.expenses || 1) : grandTotal.value
})
const categoryEmptyText = computed(() => {
  if (!finance.isMonthFiltered) return t('dashboard.empty')
  return t('dashboard.emptyMonth', { month: selectedMonthName.value })
})

const paymentTotals = computed(() => {
  return finance.isMonthFiltered ? finance.monthSummaryData!.byPaymentMethod : s.value.byPaymentMethod
})
const paymentGrandTotal = computed(() => {
  return finance.isMonthFiltered ? (finance.monthSummaryData!.expenses || 1) : grandTotal.value
})

/** Per un anno passato "a oggi" coincide con tutto l'anno e il previsto non aggiunge nulla. */
/** In italiano il mese va in minuscolo ("di ottobre"), in inglese resta maiuscolo ("in October"). */
const variableLabel = computed(() => {
  const v = finance.variableThisMonth
  if (!v) return ''
  const name = month(v.month)
  return t('dashboard.variable', { month: locale.value === 'it' ? name.toLocaleLowerCase('it') : name })
})
const variableHint = computed(() => {
  const v = finance.variableThisMonth
  if (!v) return undefined
  const note = t('dashboard.variableNote')
  return v.previousAverage === null ? note : `${note}\n${t('dashboard.variableHint', { amount: money(v.previousAverage) })}`
})
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-lg font-bold text-slate-800">{{ t('dashboard.title') }}</h2>
      <MonthSelector />
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <KpiCard :label="incomeLabel" :value="money(displayIncome)" color="text-emerald-600" />
      <KpiCard
        :label="expensesLabel"
        :value="money(displayExpenses)"
        color="text-rose-600"
        :hint="expensesHint"
      />
      <KpiCard
        :label="balanceLabel"
        :value="money(displayBalance)"
        :color="displayBalance >= 0 ? 'text-blue-600' : 'text-rose-600'"
        :hint="finance.isMonthFiltered ? undefined : (isPastYear ? undefined : t('dashboard.balanceHint'))"
      />

      <!-- Se la vista è annuale: le 3 card classiche -->
      <template v-if="!finance.isMonthFiltered">
        <KpiCard
          v-if="!isPastYear"
          :label="t('dashboard.projected')"
          :value="money(s.projectedBalance)"
          :color="s.projectedBalance >= 0 ? 'text-blue-600' : 'text-rose-600'"
          :hint="finance.data.forecast.estimateIncome ? t('dashboard.projectedHintEstimate') : t('dashboard.projectedHint')"
        />
        <KpiCard
          :label="t('dashboard.monthlyRecurring')"
          :value="money(Math.round(s.monthlyRecurring))"
          color="text-indigo-600"
          :hint="t('dashboard.monthlyRecurringHint')"
        />
        <KpiCard
          v-if="finance.variableThisMonth"
          :label="variableLabel"
          :value="money(finance.variableThisMonth.total)"
          color="text-orange-600"
          :hint="variableHint"
        />
      </template>

      <!-- Se la vista è filtrata per mese: ricorrenti vs una tantum del mese -->
      <template v-else>
        <KpiCard
          :label="t('dashboard.recurringInMonth')"
          :value="money(finance.monthSummaryData!.recurringInMonth)"
          color="text-indigo-600"
          :hint="t('dashboard.recurringInMonthHint')"
        />
        <KpiCard
          :label="t('dashboard.oneTimeInMonth')"
          :value="money(finance.monthSummaryData!.oneTimeTotal)"
          color="text-orange-600"
          :hint="t('dashboard.oneTimeInMonthHint')"
        />
      </template>
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
        <BreakdownList kind="categories" :totals="categoryTotals" :grand-total="categoryGrandTotal" :empty-text="categoryEmptyText" />
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">{{ t('dashboard.byPayment') }}</h3>
        <BreakdownList kind="paymentMethods" :totals="paymentTotals" :grand-total="paymentGrandTotal" :empty-text="t('dashboard.empty')" />
      </div>
    </div>
  </section>
</template>
