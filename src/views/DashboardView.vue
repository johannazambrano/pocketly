<script setup lang="ts">
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { upcomingCharges } from '@/domain/calculations'
import KpiCard from '@/components/KpiCard.vue'
import BalancePanel from '@/components/BalancePanel.vue'
import BreakdownList from '@/components/BreakdownList.vue'
import MonthSelector from '@/components/MonthSelector.vue'

const finance = useFinanceStore()
const { t, money, month, date, locale } = useFormat()

const s = computed(() => finance.summary)
const isPastYear = computed(() => finance.selectedYear < new Date().getFullYear())
const upcoming = computed(() => upcomingCharges(finance.data, finance.today, 30))

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
  if (ms.value) {
    if (ms.value.timing === 'future') return t('dashboard.balanceScheduledHint')
    return monthToDate.value ? t('dashboard.balanceHint') : undefined
  }
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

/** Il riquadro principale: saldo in primo piano, entrate e uscite che lo spiegano, previsione in fondo. */
const balanceFigure = computed(() => ({ label: balanceLabel.value, value: displayBalance.value, hint: balanceHint.value }))
const incomeFigure = computed(() => ({ label: incomeLabel.value, value: displayIncome.value }))
const expensesFigure = computed(() => ({ label: expensesLabel.value, value: displayExpenses.value, hint: expensesHint.value }))
/** Per un anno o un mese passato tutto è avvenuto e il previsto coinciderebbe con il saldo. */
const projectionFigure = computed(() => {
  if (ms.value) {
    if (!showMonthProjection.value) return null
    return { label: t('dashboard.projectedMonth', monthArgs.value), value: ms.value.projectedBalance, hint: monthProjectionHint.value }
  }
  if (isPastYear.value) return null
  return {
    label: t('dashboard.projected'),
    value: s.value.projectedBalance,
    hint: t(finance.data.forecast.estimateIncome ? 'dashboard.projectedHintEstimate' : 'dashboard.projectedHint'),
  }
})

/** Il dettaglio delle uscite, un livello sotto: ricorrenti e spese variabili, sempre affiancate. */
const detailCards = computed(() => {
  if (ms.value) {
    return [
      { key: 'recurring', label: t('dashboard.recurringInMonth'), value: ms.value.recurringInMonth, color: 'text-indigo-600', hint: t('dashboard.recurringInMonthHint') },
      { key: 'variable', label: t('dashboard.oneTimeInMonth', monthArgs.value), value: ms.value.oneTimeTotal, color: 'text-orange-700', hint: t('dashboard.oneTimeInMonthHint') },
    ]
  }
  const cards = [
    { key: 'recurring', label: t('dashboard.monthlyRecurring'), value: Math.round(s.value.monthlyRecurring), color: 'text-indigo-600', hint: t('dashboard.monthlyRecurringHint') },
  ]
  const v = finance.variableThisMonth
  if (v) cards.push({ key: 'variable', label: variableLabel.value, value: v.total, color: 'text-orange-700', hint: variableHint.value ?? '' })
  return cards
})

/** I prossimi addebiti riguardano il presente: si mostrano solo guardando l'anno in corso o il mese in corso. */
const showUpcoming = computed(
  () => finance.selectedYear === new Date().getFullYear() && (!ms.value || ms.value.timing === 'current'),
)
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-bold text-slate-800">{{ t('dashboard.title') }}</h2>
      <MonthSelector />
    </div>

    <BalancePanel :balance="balanceFigure" :income="incomeFigure" :expenses="expensesFigure" :projection="projectionFigure" />

    <div class="grid grid-cols-2 gap-3">
      <KpiCard
        v-for="card in detailCards"
        :key="card.key"
        :class="detailCards.length === 1 ? 'col-span-2' : ''"
        :label="card.label"
        :value="money(card.value)"
        :color="card.color"
        :hint="card.hint"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div v-if="showUpcoming" class="card space-y-3 md:col-span-2">
        <h3 class="text-sm font-semibold text-slate-700">
          <i class="fa-solid fa-calendar-day mr-1 text-indigo-600"></i> {{ t('dashboard.upcoming') }}
        </h3>
        <ul v-if="upcoming.length" class="divide-y divide-slate-100 text-xs">
          <li v-for="c in upcoming" :key="c.id" class="flex items-center justify-between gap-2 py-1.5">
            <div class="min-w-0">
              <div class="truncate font-medium">{{ c.name }}</div>
              <div class="text-xs text-slate-500">{{ date(c.date) }} · {{ t('dashboard.dueIn', c.daysLeft) }}</div>
            </div>
            <span class="shrink-0 font-semibold" :class="c.daysLeft <= 3 ? 'text-rose-600' : 'text-slate-700'">{{ money(c.amount) }}</span>
          </li>
        </ul>
        <p v-else class="text-xs text-slate-500">{{ t('dashboard.noUpcoming') }}</p>
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
