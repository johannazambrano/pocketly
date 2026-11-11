<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useFormat } from '@/i18n'
import { upcomingCharges } from '@/domain/calculations'
import { addDays, lastDayOfMonth, yearOf } from '@/utils/dates'
import BalancePanel from '@/components/BalancePanel.vue'
import BreakdownList from '@/components/BreakdownList.vue'
import MonthSelector from '@/components/MonthSelector.vue'
import WelcomePanel from '@/components/WelcomePanel.vue'
import { useMonthStep } from '@/composables/useMonthStep'

const finance = useFinanceStore()
const ui = useUiStore()
const router = useRouter()
const { t, money, month, date, locale } = useFormat()

/**
 * Tornando indietro da un dettaglio, il focus riparte dalla riga da cui si era entrati, non dall'inizio della pagina:
 * con la tastiera o un lettore di schermo si continua da lì. La cronologia dice da quale pagina si torna (`forward`);
 * `preventScroll` lascia la pagina nel punto che il router ha già ripristinato.
 */
onMounted(() => {
  const from = router.options.history.state.forward
  if (typeof from !== 'string' || !from.startsWith('/dettaglio/')) return
  document.querySelector<HTMLElement>(`a[href="${CSS.escape(from)}"]`)?.focus({ preventScroll: true })
})

const s = computed(() => finance.summary)
/** App ancora vuota: niente saldi a zero, solo il benvenuto con i primi passi. */
const isEmpty = computed(() => {
  const d = finance.data
  return !d.incomes.length && !d.oneTimeExpenses.length && !d.recurringExpenses.length && !d.loans.length
})
/** Tutta la pagina usa lo stesso "oggi" del negozio, che si aggiorna quando l'app torna in primo piano. */
const currentYear = computed(() => yearOf(finance.today))
const isPastYear = computed(() => finance.selectedYear < currentYear.value)

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

/**
 * Il riquadro principale ha una sola cifra grande, la risposta a "dove arriverò": il previsto a fine periodo per
 * l'anno e il mese in corso e per i mesi futuri, il saldo finale per i periodi passati (lì tutto è già avvenuto).
 * Il saldo di oggi resta, ma come frase sotto la cifra ("Oggi sei a …"). Sotto ancora, entrate e uscite fino a oggi,
 * ciascuna con quanto deve ancora arrivare: sono loro a spiegare la distanza tra oggi e la fine del periodo,
 * e ogni cifra compare una volta sola.
 */
const isFutureMonth = computed(() => ms.value?.timing === 'future')
/** Fino a quando arriva il previsto, nelle note di entrate e uscite: "fine mese" per un mese, "dicembre" per l'anno. */
const until = computed(() => t(ms.value ? 'dashboard.untilMonthEnd' : 'dashboard.untilDecember'))

const displayIncome = computed(() => {
  if (!ms.value) return s.value.incomeToDate
  return monthToDate.value ? ms.value.incomeToDate : ms.value.income
})
const incomeLabel = computed(() => {
  if (ms.value) return t(monthToDate.value ? 'dashboard.incomeToDate' : 'dashboard.incomeMonth', monthArgs.value)
  return t(isPastYear.value ? 'dashboard.income' : 'dashboard.incomeToDate')
})

/**
 * Entrate che devono ancora arrivare da qui alla fine del periodo, divise tra quelle già registrate con una data futura
 * e quelle stimate. "(stima)" si scrive solo sulla parte davvero stimata.
 */
const incomeAhead = computed(() => {
  if (ms.value) {
    if (ms.value.timing === 'past') return { toCome: 0, estimated: 0 }
    const from = ms.value.timing === 'future' ? ms.value.income : ms.value.incomeToDate
    return {
      toCome: Math.max(0, ms.value.projectedIncome - from),
      estimated: Math.max(0, ms.value.projectedIncome - ms.value.income),
    }
  }
  if (isPastYear.value) return { toCome: 0, estimated: 0 }
  return {
    toCome: Math.max(0, s.value.projectedIncome - s.value.incomeToDate),
    estimated: Math.max(0, s.value.projectedIncome - s.value.totalIncome),
  }
})

const incomeHint = computed(() => {
  const { toCome, estimated } = incomeAhead.value
  if (toCome <= 0) return undefined
  if (isFutureMonth.value) {
    const key = estimated >= toCome ? 'dashboard.incomeMoreEstimated' : 'dashboard.incomeMore'
    return t(key, { amount: money(toCome), estimated: money(estimated) })
  }
  const args = { amount: money(toCome), estimated: money(estimated), until: until.value }
  if (estimated >= toCome) return t('dashboard.incomeToComeEstimated', args)
  if (estimated > 0) return t('dashboard.incomeToComePartlyEstimated', args)
  return t('dashboard.incomeToCome', args)
})

const displayExpenses = computed(() => {
  if (!ms.value) return s.value.expensesToDate
  return monthToDate.value ? ms.value.expensesToDate : ms.value.expenses
})
const expensesLabel = computed(() => {
  if (ms.value) {
    if (isFutureMonth.value) return t('dashboard.expensesScheduled')
    return t(monthToDate.value ? 'dashboard.expensesToDate' : 'dashboard.expensesMonth', monthArgs.value)
  }
  return t(isPastYear.value ? 'dashboard.expenses' : 'dashboard.expensesToDate')
})
/** Sotto le uscite "a oggi", quanto è ancora in arrivo: insieme alla nota delle entrate spiega il previsto. */
const expensesHint = computed(() => {
  if (ms.value) {
    if (ms.value.timing === 'future') return t('dashboard.scheduledHint', monthArgs.value)
    if (ms.value.timing === 'past') return undefined
    const toCome = ms.value.expenses - ms.value.expensesToDate
    return toCome > 0 ? t('dashboard.stillToCome', { amount: money(toCome), until: until.value }) : t('dashboard.expensesHint')
  }
  if (isPastYear.value) return undefined
  const toCome = s.value.totalExpenses - s.value.expensesToDate
  return toCome > 0 ? t('dashboard.stillToCome', { amount: money(toCome), until: until.value }) : t('dashboard.expensesHint')
})

/** Il saldo fino a oggi (o finale, per un periodo passato; per un mese futuro: ciò che è già registrato). */
const displayBalance = computed(() => {
  if (!ms.value) return s.value.balanceToDate
  return monthToDate.value ? ms.value.balanceToDate : ms.value.balance
})
/** Il previsto a fine periodo; null per un periodo passato, dove coinciderebbe con il saldo. */
const projected = computed(() => {
  if (ms.value) return ms.value.timing === 'past' ? null : ms.value.projectedBalance
  return isPastYear.value ? null : s.value.projectedBalance
})

/**
 * La cifra grande. Per un mese futuro è sempre il previsto (non c'è un "oggi"). Per l'anno e il mese in corso è il
 * previsto, con il saldo di oggi nella frase sotto; se da qui alla fine non cambia più niente i due coincidono, e
 * resta solo il saldo. Per un periodo passato è il saldo finale.
 */
const mainFigure = computed(() => {
  if (isFutureMonth.value && projected.value !== null) {
    return {
      label: t('dashboard.projectedMonth', monthArgs.value),
      value: projected.value,
      note: t(incomeAhead.value.estimated > 0 ? 'dashboard.futureNoteEstimated' : 'dashboard.futureNoteRecorded'),
    }
  }
  if (projected.value !== null && projected.value !== displayBalance.value) {
    return {
      label: ms.value ? t('dashboard.projectedMonth', monthArgs.value) : t('dashboard.projected', { year: finance.selectedYear }),
      value: projected.value,
      // La portata detta sempre: nel mese è il risultato del mese, nell'anno quello dall'inizio dell'anno. Non è il saldo
      // del conto, che l'app non conosce.
      today: {
        label: ms.value ? t('dashboard.sinceMonthStart', monthArgs.value) : t('dashboard.sinceYearStart'),
        value: displayBalance.value,
      },
    }
  }
  if (ms.value) {
    return {
      label: t(monthToDate.value ? 'dashboard.balanceMonthToDate' : 'dashboard.balanceMonth', monthArgs.value),
      value: displayBalance.value,
      hint: monthToDate.value ? t('dashboard.balanceHint') : undefined,
    }
  }
  return {
    label: t(isPastYear.value ? 'dashboard.balanceYear' : 'dashboard.balanceToDate'),
    value: displayBalance.value,
    hint: isPastYear.value ? undefined : t('dashboard.balanceHint'),
  }
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

const incomeFigure = computed(() => ({ label: incomeLabel.value, value: displayIncome.value, hint: incomeHint.value }))
const expensesFigure = computed(() => ({ label: expensesLabel.value, value: displayExpenses.value, hint: expensesHint.value }))

/** In italiano il mese va in minuscolo ("a novembre"), in inglese resta maiuscolo ("in November"). */
const monthName = (m: number) => (locale.value === 'it' ? month(m).toLocaleLowerCase('it') : month(m))

/**
 * Le uscite mostrate nel riquadro, divise tra ricorrenti e variabili: le due parti sommano sempre il totale.
 * Se una parte è zero la divisione ripeterebbe il totale, quindi non si mostra.
 * Le note conservano i due confronti utili, per l'anno e per ogni mese già iniziato: il costo medio mensile delle
 * ricorrenti e le variabili rispetto alla media dei mesi precedenti (per il mese in corso "finora", perché non è finito).
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
  } else if (m.timing !== 'future') {
    // Nei mesi, passati o in corso, le stesse medie dell'anno: costo medio delle ricorrenti e variabili a confronto.
    recurringNote = t('dashboard.splitRecurringAverage', { amount: money(Math.round(s.value.monthlyRecurring)) })
    const vm = finance.variableOfSelectedMonth
    if (vm && vm.previousAverage !== null) {
      // Nel mese in corso le variabili sono "finora": la frase dice che la media è di mesi interi.
      const key = monthToDate.value ? 'dashboard.splitVariableAverageSoFar' : 'dashboard.splitVariableAverage'
      variableNote = t(key, { amount: money(vm.previousAverage) })
    }
  }

  return [
    { key: 'recurring', label: t('dashboard.splitRecurring'), value: recurring, dot: 'bg-indigo-500', note: recurringNote },
    { key: 'variable', label: t('dashboard.splitVariable'), value: variable, dot: 'bg-orange-500', note: variableNote },
  ]
})

/**
 * Cambiare mese senza cercare le frecce: swipe orizzontale sul riquadro del saldo. I tasti ← → li gestisce il
 * MonthSelector, così valgono su ogni pagina che ha il filtro del mese.
 */
const { previous, next, go } = useMonthStep()

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

/**
 * Ciò che deve ancora uscire. Sul mese in corso arriva a fine mese, così l'elenco e la sua somma coincidono con
 * "ancora in arrivo" sotto le uscite; sull'anno guarda i prossimi 30 giorni.
 */
const upcomingUntil = computed(() =>
  monthToDate.value ? lastDayOfMonth(finance.selectedYear, finance.selectedMonth as number) : addDays(finance.today, 30),
)
const upcoming = computed(() => upcomingCharges(finance.data, finance.today, upcomingUntil.value))
const upcomingTotal = computed(() => upcoming.value.reduce((acc, c) => acc + c.amount, 0))
const upcomingTitle = computed(() =>
  monthToDate.value ? t('dashboard.upcomingMonth', monthArgs.value) : t('dashboard.upcoming'),
)
const upcomingEmpty = computed(() =>
  monthToDate.value ? t('dashboard.noUpcomingMonth', monthArgs.value) : t('dashboard.noUpcoming'),
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
        :main="mainFigure"
        :income="incomeFigure"
        :expenses="expensesFigure"
        :split="expensesSplit"
        v-model:notes-open="ui.dashboardNotesOpen"
      />

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div v-if="showUpcoming" class="card space-y-3 md:col-span-2">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-700">
              <i class="fa-solid fa-clock mr-1 text-indigo-600" aria-hidden="true"></i> {{ upcomingTitle }}
            </h3>
            <span v-if="upcoming.length" class="shrink-0 text-sm font-semibold text-slate-700">{{ money(upcomingTotal) }}</span>
          </div>
          <!--
            Su schermi larghi due colonne, così l'importo resta vicino al suo nome. La griglia si riempie per colonne
            (metà delle righe ciascuna): l'ordine per data scende lungo la prima colonna e continua nella seconda,
            invece di andare a zig-zag.
          -->
          <ul
            v-if="upcoming.length"
            class="grid gap-x-8 md:grid-flow-col md:grid-cols-2 md:[grid-template-rows:repeat(var(--rows),auto)]"
            :style="{ '--rows': Math.ceil(upcoming.length / 2) }"
          >
            <li
              v-for="(c, i) in upcoming"
              :key="c.key"
              class="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-b-0"
              :class="{ 'md:border-b-0': i === Math.ceil(upcoming.length / 2) - 1 }"
            >
              <div class="min-w-0">
                <div class="truncate text-sm font-medium">{{ c.name }}</div>
                <!-- Una scadenza vicina si segnala sul "quando", in ambra, non sull'importo: il rosso resta per il sotto zero. -->
                <div class="text-xs text-slate-500">
                  {{ date(c.date) }} ·
                  <span :class="{ 'font-medium text-amber-700': c.daysLeft <= 3 }">{{ t('dashboard.dueIn', c.daysLeft) }}</span>
                  <template v-if="c.source === 'oneTime'"> · {{ t('dashboard.upcomingVariable') }}</template>
                </div>
              </div>
              <span class="shrink-0 text-sm font-semibold text-slate-700">{{ money(c.amount) }}</span>
            </li>
          </ul>
          <p v-else class="text-xs text-slate-500">{{ upcomingEmpty }}</p>
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
