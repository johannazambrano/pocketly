<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { upcomingCharges } from '@/domain/calculations'
import { yearOf } from '@/utils/dates'
import BalancePanel from '@/components/BalancePanel.vue'
import BreakdownList from '@/components/BreakdownList.vue'
import MonthSelector from '@/components/MonthSelector.vue'
import WelcomePanel from '@/components/WelcomePanel.vue'
import { useMonthStep } from '@/composables/useMonthStep'

const finance = useFinanceStore()
const { t, money, month, date, locale } = useFormat()

const s = computed(() => finance.summary)
/** App ancora vuota: niente saldi a zero, solo il benvenuto con i primi passi. */
const isEmpty = computed(() => {
  const d = finance.data
  return !d.incomes.length && !d.oneTimeExpenses.length && !d.recurringExpenses.length && !d.loans.length
})
/** Tutta la pagina usa lo stesso "oggi" del negozio, che si aggiorna quando l'app torna in primo piano. */
const currentYear = computed(() => yearOf(finance.today))
const isPastYear = computed(() => finance.selectedYear < currentYear.value)
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
/** Un mese futuro non ha ancora un saldo: c'è solo ciò che è programmato, e l'etichetta lo dice. */
const isFutureMonth = computed(() => ms.value?.timing === 'future')
const balanceLabel = computed(() => {
  if (isFutureMonth.value) return t('dashboard.balanceScheduled', monthArgs.value)
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
/**
 * La parte del previsto fatta di entrate stimate, cioè non ancora registrate: si mostra come cifra a sé sotto il previsto,
 * perché è la parte del numero che non è ancora successa.
 */
const estimatedIncome = computed(() => {
  const value = ms.value ? ms.value.projectedIncome - ms.value.income : s.value.projectedIncome - s.value.totalIncome
  return value > 0 ? value : 0
})

/**
 * Quando oggi sei sotto zero ma a fine periodo torni sopra, una frase collega i due numeri: quanto entra ed esce ancora
 * da qui alla fine del mese o dell'anno in corso. Solo per il periodo in corso, l'unico in cui "da qui" ha senso.
 */
const bridge = computed(() => {
  const projection = projectionFigure.value
  if (!projection || displayBalance.value >= 0 || projection.value < 0) return null
  let incoming: number
  let outgoing: number
  let end: string
  if (ms.value) {
    if (!monthToDate.value) return null
    incoming = ms.value.projectedIncome - ms.value.incomeToDate
    outgoing = ms.value.expenses - ms.value.expensesToDate
    end = t('dashboard.bridgeEndMonth', monthArgs.value)
  } else {
    incoming = s.value.projectedIncome - s.value.incomeToDate
    outgoing = s.value.totalExpenses - s.value.expensesToDate
    end = t('dashboard.bridgeEndYear')
  }
  if (incoming <= 0) return null
  const args = { end, income: money(incoming), expenses: money(outgoing) }
  return outgoing > 0 ? t('dashboard.bridge', args) : t('dashboard.bridgeIncomeOnly', args)
})

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

/** Il riquadro principale: in alto saldo e previsione affiancati, sotto entrate e uscite che spiegano il saldo. */
/** Per un mese futuro la cifra resta senza colore di segno: non è un risultato, è un programma. */
const balanceFigure = computed(() => ({
  label: balanceLabel.value,
  value: displayBalance.value,
  hint: balanceHint.value,
  neutral: isFutureMonth.value,
}))
const incomeFigure = computed(() => ({ label: incomeLabel.value, value: displayIncome.value }))
const expensesFigure = computed(() => ({ label: expensesLabel.value, value: displayExpenses.value, hint: expensesHint.value }))
/** Per un anno o un mese passato tutto è avvenuto e il previsto coinciderebbe con il saldo. */
const projectionFigure = computed(() => {
  if (ms.value) {
    if (!showMonthProjection.value) return null
    return {
      label: t('dashboard.projectedMonth', monthArgs.value),
      value: ms.value.projectedBalance,
      hint: t('dashboard.projectedMonthHint'),
      estimated: estimatedIncome.value,
    }
  }
  if (isPastYear.value) return null
  return {
    label: t('dashboard.projected'),
    value: s.value.projectedBalance,
    // La quota stimata è già una cifra a sé ("di cui …"): la nota non la ripete.
    hint: t('dashboard.projectedHint'),
    estimated: estimatedIncome.value,
  }
})

/** In italiano il mese va in minuscolo ("a novembre"), in inglese resta maiuscolo ("in November"). */
const monthName = (m: number) => (locale.value === 'it' ? month(m).toLocaleLowerCase('it') : month(m))

/**
 * Le uscite mostrate nel riquadro, divise tra ricorrenti e variabili: le due parti sommano sempre il totale.
 * Se una parte è zero la divisione ripeterebbe il totale, quindi non si mostra.
 * Le note conservano i due confronti utili: il costo medio mensile delle ricorrenti e le variabili del mese
 * di oggi rispetto alla media dei mesi precedenti ("finora", perché il mese non è finito).
 */
const expensesSplit = computed(() => {
  const m = ms.value
  const recurring = m ? (monthToDate.value ? m.recurringToDate : m.recurringInMonth) : s.value.recurringToDate
  const variable = m ? (monthToDate.value ? m.oneTimeToDate : m.oneTimeTotal) : s.value.oneTimeToDate
  if (recurring <= 0 || variable <= 0) return null

  const v = finance.variableThisMonth
  let recurringNote: string | undefined
  let variableNote: string | undefined
  if (!m) {
    recurringNote = t('dashboard.splitRecurringAverage', { amount: money(Math.round(s.value.monthlyRecurring)) })
    if (v) {
      const args = { month: monthName(v.month), amount: money(v.toDate) }
      variableNote =
        v.previousAverage === null
          ? t('dashboard.splitVariableSoFar', args)
          : t('dashboard.splitVariableSoFarAverage', { ...args, average: money(v.previousAverage) })
    }
  } else if (monthToDate.value && v && v.previousAverage !== null) {
    variableNote = t('dashboard.splitVariableAverage', { amount: money(v.previousAverage) })
  }

  return [
    { key: 'recurring', label: t('dashboard.splitRecurring'), value: recurring, dot: 'bg-indigo-500', note: recurringNote },
    { key: 'variable', label: t('dashboard.splitVariable'), value: variable, dot: 'bg-orange-500', note: variableNote },
  ]
})

/**
 * Cambiare mese senza cercare le frecce: tasti ← → sulla pagina e swipe orizzontale sul riquadro del saldo.
 * I tasti non agiscono mentre si scrive, quando il focus è su un menu (le frecce lì cambiano già la scelta) o con una
 * finestra aperta.
 */
const { previous, next, go } = useMonthStep()

function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const el = e.target as HTMLElement | null
  if (el?.closest('input, select, textarea, [contenteditable="true"]')) return
  if (document.querySelector('[aria-modal="true"]')) return
  if (go(e.key === 'ArrowLeft' ? previous.value : next.value)) e.preventDefault()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

/** Uno swipe conta se è soprattutto orizzontale e lungo almeno 60px: lo scorrimento verticale della pagina resta libero. */
let touchStart: { x: number; y: number } | null = null
function onTouchStart(e: TouchEvent) {
  const t0 = e.touches[0]
  touchStart = e.touches.length === 1 && t0 ? { x: t0.clientX, y: t0.clientY } : null
}
function onTouchEnd(e: TouchEvent) {
  const t1 = e.changedTouches[0]
  if (!touchStart || !t1) return
  const dx = t1.clientX - touchStart.x
  const dy = t1.clientY - touchStart.y
  touchStart = null
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  // Il dito verso sinistra porta avanti nel tempo, come sfogliare un calendario.
  go(dx < 0 ? next.value : previous.value)
}

/** Chi usa un lettore di schermo sente quale periodo è ora mostrato, comunque lo si cambi. */
const announcement = ref('')
watch(
  () => [finance.selectedYear, finance.selectedMonth] as const,
  ([year, m]) => {
    announcement.value = m === 'all' ? `${t('dashboard.allMonths')} ${year}` : `${month(m)} ${year}`
  },
)

/** I prossimi addebiti riguardano il presente: si mostrano solo guardando l'anno in corso o il mese in corso. */
const showUpcoming = computed(
  () => finance.selectedYear === currentYear.value && (!ms.value || ms.value.timing === 'current'),
)
</script>

<template>
  <section class="space-y-4">
    <!--
      La dashboard è la pagina iniziale e la voce attiva del menu dice già dove si è: il titolo resta solo per i lettori
      di schermo, e il filtro del mese prende la riga intera.
    -->
    <h2 class="sr-only">{{ t('dashboard.title') }}</h2>
    <WelcomePanel v-if="isEmpty" />

    <template v-else>
      <div class="flex items-center justify-end">
        <MonthSelector />
      </div>

      <p class="sr-only" aria-live="polite">{{ announcement }}</p>

      <BalancePanel
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
        :balance="balanceFigure"
        :income="incomeFigure"
        :expenses="expensesFigure"
        :split="expensesSplit"
        :projection="projectionFigure"
        :bridge="bridge"
      />

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div v-if="showUpcoming" class="card space-y-3 md:col-span-2">
          <h3 class="text-sm font-semibold text-slate-700">
            <i class="fa-solid fa-calendar-day mr-1 text-indigo-600"></i> {{ t('dashboard.upcoming') }}
          </h3>
          <!-- Su schermi larghi due colonne: l'importo resta vicino al suo nome invece che all'altro capo della pagina. -->
          <ul v-if="upcoming.length" class="grid gap-x-8 md:grid-cols-2">
            <li v-for="c in upcoming" :key="c.id" class="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-b-0 md:[&:nth-child(odd):nth-last-child(2)]:border-b-0">
              <div class="min-w-0">
                <div class="truncate text-sm font-medium">{{ c.name }}</div>
                <div class="text-xs text-slate-500">{{ date(c.date) }} · {{ t('dashboard.dueIn', c.daysLeft) }}</div>
              </div>
              <span class="shrink-0 text-sm font-semibold" :class="c.daysLeft <= 3 ? 'text-rose-600' : 'text-slate-700'">{{ money(c.amount) }}</span>
            </li>
          </ul>
          <p v-else class="text-xs text-slate-500">{{ t('dashboard.noUpcoming') }}</p>
        </div>

        <div class="card space-y-3">
          <h3 class="text-sm font-semibold text-slate-700">{{ t('dashboard.byCategory') }}</h3>
          <BreakdownList kind="categories" linked :totals="categoryTotals" :grand-total="breakdownGrandTotal" :empty-text="categoryEmptyText" />
        </div>

        <div class="card space-y-3">
          <h3 class="text-sm font-semibold text-slate-700">{{ t('dashboard.byPayment') }}</h3>
          <BreakdownList kind="paymentMethods" linked :totals="paymentTotals" :grand-total="breakdownGrandTotal" :empty-text="categoryEmptyText" />
        </div>
      </div>
    </template>
  </section>
</template>
