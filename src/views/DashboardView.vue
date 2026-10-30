<script setup lang="ts">
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { upcomingCharges } from '@/domain/calculations'
import { todayIso, yearOf } from '@/utils/dates'
import KpiCard from '@/components/KpiCard.vue'
import BreakdownList from '@/components/BreakdownList.vue'

const finance = useFinanceStore()
const { t, money, month, date, locale } = useFormat()

const s = computed(() => finance.summary)
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
const isPastYear = computed(() => finance.selectedYear < new Date().getFullYear())
/**
 * Con almeno un conto, nell'anno in corso il saldo a oggi è quello reale dei conti (saldo di partenza compreso)
 * e il previsto a fine anno ci aggiunge ciò che deve ancora entrare e uscire fino a dicembre.
 */
const useAccounts = computed(() => finance.balances.length > 0 && finance.selectedYear === yearOf(finance.today))
const accountsTotal = computed(() => finance.balances.reduce((acc, b) => acc + b.balance, 0))
const balanceToDate = computed(() => (useAccounts.value ? accountsTotal.value : s.value.balanceToDate))
const projected = computed(() =>
  useAccounts.value ? accountsTotal.value + s.value.projectedBalance - s.value.balanceToDate : s.value.projectedBalance,
)
const balanceHint = computed(() => {
  if (isPastYear.value) return undefined
  return t(useAccounts.value ? 'dashboard.balanceHintAccounts' : 'dashboard.balanceHint')
})
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

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <KpiCard :label="t('dashboard.income')" :value="money(s.incomeToDate)" color="text-emerald-600" />
      <KpiCard
        :label="t(isPastYear ? 'dashboard.expenses' : 'dashboard.expensesToDate')"
        :value="money(s.expensesToDate)"
        color="text-rose-600"
        :hint="isPastYear ? undefined : t('dashboard.expensesHint')"
      />
      <KpiCard
        :label="t(isPastYear ? 'dashboard.balanceYear' : 'dashboard.balanceToDate')"
        :value="money(balanceToDate)"
        :color="balanceToDate >= 0 ? 'text-blue-600' : 'text-rose-600'"
        :hint="balanceHint"
      />
      <KpiCard
        v-if="!isPastYear"
        :label="t('dashboard.projected')"
        :value="money(projected)"
        :color="projected >= 0 ? 'text-blue-600' : 'text-rose-600'"
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
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div v-if="finance.balances.length" class="card space-y-3 md:col-span-2">
        <h3 class="text-sm font-semibold text-slate-700">
          <i class="fa-solid fa-building-columns mr-1 text-blue-600"></i> {{ t('dashboard.accounts') }}
        </h3>
        <ul class="divide-y divide-slate-100 text-xs">
          <li v-for="b in finance.balances" :key="b.id" class="flex items-center justify-between gap-2 py-1.5">
            <span class="truncate font-medium">{{ b.name }}</span>
            <span class="shrink-0 font-semibold" :class="b.balance >= 0 ? 'text-blue-600' : 'text-rose-600'">{{ money(b.balance) }}</span>
          </li>
        </ul>
      </div>

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
