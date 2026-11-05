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
const upcoming = computed(() => upcomingCharges(finance.data, todayIso(), 30))

/**
 * Una sola regola per tutta la dashboard: le card e le ripartizioni contano ciò che è già avvenuto,
 * la previsione dice dove si arriverà. Un mese passato è tutto avvenuto; uno futuro mostra ciò che è programmato.
 */
const ms = computed(() => finance.monthSummaryData)
const monthToDate = computed(() => ms.value?.timing === 'current')

const selectedMonthName = computed(() => {
  if (finance.selectedMonth === 'all') return ''
  const name = month(finance.selectedMonth)
  return locale.value === 'it' ? name.toLocaleLowerCase('it') : name
})
const monthArgs = computed(() => ({ month: selectedMonthName.value }))

const displayIncome = computed(() => {
  if (!ms.value) return s.value.incomeToDate
  return monthToDate.value ? ms.value.incomeToDate : ms.value.income
})
const incomeLabel = computed(() => {
  if (ms.value) return t(monthToDate.value ? 'dashboard.incomeMonthToDate' : 'dashboard.incomeMonth', monthArgs.value)
  return t(isPastYear.value ? 'dashboard.income' : 'dashboard.incomeToDate')
})

const displayExpenses = computed(() => {
  if (!ms.value) return s.value.expensesToDate
  return monthToDate.value ? ms.value.expensesToDate : ms.value.expenses
})
const expensesLabel = computed(() => {
  if (ms.value) return t(monthToDate.value ? 'dashboard.expensesMonthToDate' : 'dashboard.expensesMonth', monthArgs.value)
  return t(isPastYear.value ? 'dashboard.expenses' : 'dashboard.expensesToDate')
})
/** Sotto le uscite "a oggi", quanto è ancora in arrivo: spiega perché il previsto è più basso del saldo. */
const expensesHint = computed(() => {
  if (ms.value) {
    if (ms.value.timing === 'future') return t('dashboard.scheduledHint')
    if (ms.value.timing === 'past') return undefined
    const toCome = ms.value.expenses - ms.value.expensesToDate
    return toCome > 0 ? t('dashboard.stillToComeMonth', { amount: money(toCome) }) : t('dashboard.expensesHint')
  }
  if (isPastYear.value) return undefined
  const toCome = s.value.totalExpenses - s.value.expensesToDate
  return toCome > 0 ? t('dashboard.stillToComeYear', { amount: money(toCome) }) : t('dashboard.expensesHint')
})

const displayBalance = computed(() => {
  if (!ms.value) return s.value.balanceToDate
  return monthToDate.value ? ms.value.balanceToDate : ms.value.balance
})
const balanceLabel = computed(() => {
  if (ms.value) return t(monthToDate.value ? 'dashboard.balanceMonthToDate' : 'dashboard.balanceMonth', monthArgs.value)
  return t(isPastYear.value ? 'dashboard.balanceYear' : 'dashboard.balanceToDate')
})
const balanceHint = computed(() => {
  if (ms.value) return monthToDate.value ? t('dashboard.balanceHint') : undefined
  return isPastYear.value ? undefined : t('dashboard.balanceHint')
})

/**
 * Il previsto a fine mese compare solo se dice qualcosa in più del saldo: mai per un mese passato (tutto avvenuto),
 * e per un mese futuro solo quando la stima delle entrate lo rende diverso da ciò che è già programmato.
 */
const showMonthProjection = computed(
  () => !!ms.value && ms.value.timing !== 'past' && ms.value.projectedBalance !== displayBalance.value,
)
const monthProjectionHint = computed(() =>
  t(finance.data.forecast.estimateIncome ? 'dashboard.projectedMonthHintEstimate' : 'dashboard.projectedMonthHint'),
)

/** Le ripartizioni seguono la stessa regola delle card, così la somma delle righe torna con le uscite mostrate. */
const categoryTotals = computed(() => {
  if (!ms.value) return s.value.byCategoryToDate
  return monthToDate.value ? ms.value.byCategoryToDate : ms.value.byCategory
})
const paymentTotals = computed(() => {
  if (!ms.value) return s.value.byPaymentMethodToDate
  return monthToDate.value ? ms.value.byPaymentMethodToDate : ms.value.byPaymentMethod
})
const breakdownGrandTotal = computed(() => displayExpenses.value || 1)
const categoryEmptyText = computed(() => {
  if (!ms.value) return t('dashboard.empty')
  return t('dashboard.emptyMonth', monthArgs.value)
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
        :hint="balanceHint"
      />

      <!-- Vista annuale: previsto a fine anno, costo mensile delle ricorrenti, spese variabili del mese di oggi -->
      <template v-if="!ms">
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

      <!-- Vista mensile: previsto a fine mese (non per i mesi passati), ricorrenti e una tantum di tutto il mese -->
      <template v-else>
        <KpiCard
          v-if="showMonthProjection"
          :label="t('dashboard.projectedMonth', monthArgs)"
          :value="money(ms.projectedBalance)"
          :color="ms.projectedBalance >= 0 ? 'text-blue-600' : 'text-rose-600'"
          :hint="monthProjectionHint"
        />
        <KpiCard
          :label="t('dashboard.recurringInMonth')"
          :value="money(ms.recurringInMonth)"
          color="text-indigo-600"
          :hint="t('dashboard.recurringInMonthHint')"
        />
        <KpiCard
          :label="t('dashboard.oneTimeInMonth', monthArgs)"
          :value="money(ms.oneTimeTotal)"
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
        <BreakdownList kind="categories" :totals="categoryTotals" :grand-total="breakdownGrandTotal" :empty-text="categoryEmptyText" />
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">{{ t('dashboard.byPayment') }}</h3>
        <BreakdownList kind="paymentMethods" :totals="paymentTotals" :grand-total="breakdownGrandTotal" :empty-text="categoryEmptyText" />
      </div>
    </div>
  </section>
</template>
