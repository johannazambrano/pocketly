import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type {
  FinanceData,
  ForecastSettings,
  Id,
  Income,
  Loan,
  NotificationRule,
  OneTimeExpense,
  RecurringExpense,
  Repayment,
  Simulation,
  Tag,
} from '@/types/models'
import { availableYears, estimateCategoryIds, estimateMonthlyIncome, forecast, monthSummary, variableSpending, yearSummary } from '@/domain/calculations'
import { normalizeNotifications } from '@/domain/notifications'
import { isActiveInYear } from '@/domain/recurrence'
import { createDefaultData, createEmptyData } from '@/domain/defaults'
import { deviceDataStore, type DataStore } from '@/services/storage'
import { pickUniqueColor, randomUniqueColor } from '@/utils/colors'
import { parseIsoDate, todayIso, yearOf } from '@/utils/dates'
import { newId } from '@/utils/id'

export type TagKind = 'categories' | 'paymentMethods' | 'tags'
type WithOptionalId<T extends { id: Id }> = Omit<T, 'id'> & { id?: Id }

const REF_FIELD = { categories: 'categoryId', paymentMethods: 'paymentMethodId' } as const

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date)

function upsert<T extends { id: Id }>(list: T[], item: WithOptionalId<T>): T {
  const full = { ...item, id: item.id ?? newId() } as T
  const index = list.findIndex((x) => x.id === full.id)
  if (index >= 0) list[index] = full
  else list.push(full)
  return full
}

function remove<T extends { id: Id }>(list: T[], id: Id): void {
  const index = list.findIndex((x) => x.id === id)
  if (index >= 0) list.splice(index, 1)
}

export const useFinanceStore = defineStore('finance', () => {
  const data = ref<FinanceData>(createEmptyData())
  const ready = ref(false)
  const saveError = ref(false)
  const selectedYear = ref(new Date().getFullYear())
  /**
   * All'apertura si guarda il mese di oggi: la domanda più frequente è "come va questo mese". La scelta non viene
   * ricordata tra un'apertura e l'altra, così riaprendo il mese dopo non si trova il mese vecchio.
   */
  const selectedMonth = ref<number | 'all'>(new Date().getMonth())
  /** Oggi, per separare ciò che è già successo da ciò che è previsto. Si aggiorna quando l'app torna in primo piano. */
  const today = ref(todayIso())
  const dataStore: DataStore = deviceDataStore

  // --- persistenza -------------------------------------------------------

  let saveTimer: ReturnType<typeof setTimeout> | undefined

  async function flush() {
    clearTimeout(saveTimer)
    saveTimer = undefined
    try {
      await dataStore.save(data.value)
      saveError.value = false
    } catch (e) {
      console.error('Salvataggio non riuscito', e)
      saveError.value = true
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 300)
  }

  async function init(locale: string) {
    let loaded: FinanceData | null = null
    try {
      loaded = await dataStore.load()
    } catch (e) {
      console.error('Caricamento non riuscito', e)
    }
    data.value = loaded ?? createDefaultData(locale)
    if (!loaded) await flush()
    watch(data, scheduleSave, { deep: true })
    // Salva subito se l'app va in background (es. l'utente chiude la scheda).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') today.value = todayIso()
      if (document.visibilityState === 'hidden' && saveTimer) void flush()
    })
    ready.value = true
  }

  function replaceAll(next: FinanceData) {
    data.value = next
    selectedYear.value = new Date().getFullYear()
    selectedMonth.value = new Date().getMonth()
  }

  /** Dati arrivati dalla sincronizzazione: a differenza di un ripristino, la pagina resta sull'anno e sul mese scelti. */
  async function applySynced(next: FinanceData) {
    data.value = next
    await flush()
  }

  // --- viste derivate ----------------------------------------------------

  const years = computed(() => availableYears(data.value, new Date().getFullYear()))
  const summary = computed(() => yearSummary(data.value, selectedYear.value, today.value))
  const forecastRows = computed(() => forecast(data.value, selectedYear.value, today.value))
  const estimatedMonthlyIncome = computed(() => estimateMonthlyIncome(data.value, today.value))
  /** Categorie effettivamente usate per la stima: quelle scelte o, se nessuna, quelle che si ripetono. */
  const estimateCategories = computed(() => estimateCategoryIds(data.value, today.value))
  /** Solo per l'anno corrente: negli altri anni non c'è un "mese di oggi". */
  const variableThisMonth = computed(() =>
    selectedYear.value === yearOf(today.value) ? variableSpending(data.value, today.value) : null,
  )

  const oneTimeOfYear = computed(() =>
    data.value.oneTimeExpenses.filter((e) => yearOf(e.date) === selectedYear.value).sort(byDateDesc),
  )
  const isMonthFiltered = computed(() => selectedMonth.value !== 'all')
  const monthSummaryData = computed(() => {
    if (selectedMonth.value === 'all') return null
    return monthSummary(data.value, selectedYear.value, selectedMonth.value, today.value)
  })
  const oneTimeFiltered = computed(() => {
    if (selectedMonth.value === 'all') return oneTimeOfYear.value
    return oneTimeOfYear.value.filter((e) => parseIsoDate(e.date).month === selectedMonth.value)
  })
  const incomesOfYear = computed(() =>
    data.value.incomes.filter((e) => yearOf(e.date) === selectedYear.value).sort(byDateDesc),
  )
  const recurringOfYear = computed(() =>
    data.value.recurringExpenses
      .filter((r) => isActiveInYear(r, selectedYear.value))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
  const simulationsOfYear = computed(() =>
    data.value.simulations.filter((s) => s.year === selectedYear.value).sort((a, b) => a.month - b.month),
  )
  const loans = computed(() => [...data.value.loans].sort(byDateDesc))

  const tagMaps = computed(() => ({
    categories: new Map(data.value.categories.map((t) => [t.id, t])),
    paymentMethods: new Map(data.value.paymentMethods.map((t) => [t.id, t])),
    tags: new Map(data.value.tags.map((t) => [t.id, t])),
  }))

  function tag(kind: TagKind, id: Id): Tag | undefined {
    return tagMaps.value[kind].get(id)
  }

  // --- movimenti ---------------------------------------------------------

  function saveOneTime(item: WithOptionalId<OneTimeExpense>) {
    upsert(data.value.oneTimeExpenses, { ...item, tagIds: item.tagIds ?? [] })
    selectedYear.value = yearOf(item.date)
  }

  function saveIncome(item: WithOptionalId<Income>) {
    upsert(data.value.incomes, item)
    selectedYear.value = yearOf(item.date)
  }

  function saveRecurring(item: WithOptionalId<RecurringExpense>) {
    const notifications = normalizeNotifications(item.notifications)
    const { notifications: _raw, ...rest } = item
    upsert(data.value.recurringExpenses, {
      ...rest,
      ...(notifications.length ? { notifications } : {}),
    })
  }

  /**
   * Applica le regole indicate alle spese ricorrenti esistenti che non hanno ancora
   * promemoria configurati (`missing`) oppure a tutte (`all`). Restituisce quante voci sono cambiate.
   */
  function applyNotificationsToRecurring(rules: NotificationRule[], mode: 'missing' | 'all' = 'missing'): number {
    const normalized = normalizeNotifications(rules)
    let count = 0
    data.value.recurringExpenses = data.value.recurringExpenses.map((r) => {
      if (mode === 'missing' && r.notifications?.length) return r
      const { notifications: _old, ...rest } = r
      count++
      return {
        ...rest,
        ...(normalized.length ? { notifications: normalized.map((x) => ({ ...x })) } : {}),
      }
    })
    return count
  }

  const deleteOneTime = (id: Id) => remove(data.value.oneTimeExpenses, id)
  const deleteIncome = (id: Id) => remove(data.value.incomes, id)
  const deleteRecurring = (id: Id) => remove(data.value.recurringExpenses, id)

  // --- prestiti ----------------------------------------------------------

  function saveLoan(item: WithOptionalId<Omit<Loan, 'repayments'>>) {
    const existing = item.id ? data.value.loans.find((l) => l.id === item.id) : undefined
    upsert(data.value.loans, { ...item, repayments: existing?.repayments ?? [] })
  }

  const deleteLoan = (id: Id) => remove(data.value.loans, id)

  function addRepayment(loanId: Id, repayment: Omit<Repayment, 'id'>) {
    data.value.loans.find((l) => l.id === loanId)?.repayments.push({ ...repayment, id: newId() })
  }

  function deleteRepayment(loanId: Id, repaymentId: Id) {
    const loan = data.value.loans.find((l) => l.id === loanId)
    if (loan) remove(loan.repayments, repaymentId)
  }

  // --- simulazioni -------------------------------------------------------

  function addSimulation(sim: Omit<Simulation, 'id'>) {
    data.value.simulations.push({ ...sim, id: newId() })
  }

  const deleteSimulation = (id: Id) => remove(data.value.simulations, id)

  // --- previsioni --------------------------------------------------------

  function setForecastSettings(patch: Partial<ForecastSettings>) {
    Object.assign(data.value.forecast, patch)
  }

  // --- budget ------------------------------------------------------------

  /** Importo nullo o non positivo = nessun limite per quella categoria. */
  function setBudgetLimit(categoryId: Id, amount: number | null) {
    if (amount !== null && amount > 0) data.value.budget.limits[categoryId] = amount
    else delete data.value.budget.limits[categoryId]
  }

  // --- categorie e metodi di pagamento -----------------------------------

  function allColors() {
    return [...data.value.categories, ...data.value.paymentMethods, ...data.value.tags].map((t) => t.color)
  }

  function nameTaken(kind: TagKind, name: string, exceptId?: Id) {
    const n = name.trim().toLocaleLowerCase()
    return data.value[kind].some((t) => t.id !== exceptId && t.name.toLocaleLowerCase() === n)
  }

  /** Restituisce false se il nome è vuoto o già usato. */
  function addTag(kind: TagKind, name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed || nameTaken(kind, trimmed)) return false
    data.value[kind].push({ id: newId(), name: trimmed, color: pickUniqueColor(allColors()) })
    return true
  }

  function renameTag(kind: TagKind, id: Id, name: string): boolean {
    const trimmed = name.trim()
    const t = tag(kind, id)
    if (!t || !trimmed || nameTaken(kind, trimmed, id)) return false
    t.name = trimmed
    return true
  }

  function setTagColor(kind: TagKind, id: Id, color: string) {
    const t = tag(kind, id)
    if (t) t.color = color
  }

  function randomizeTagColor(kind: TagKind, id: Id) {
    setTagColor(kind, id, randomUniqueColor(allColors()))
  }

  function tagUsage(kind: TagKind, id: Id): number {
    if (kind === 'tags') {
      return data.value.oneTimeExpenses.filter((x) => x.tagIds?.includes(id)).length
    }
    const field = REF_FIELD[kind]
    const d = data.value
    return [...d.oneTimeExpenses, ...d.recurringExpenses, ...d.incomes].filter((x) => x[field] === id).length
  }

  /** Elimina una categoria/metodo/tag spostando le voci che lo usano su `reassignTo`. */
  function deleteTag(kind: TagKind, id: Id, reassignTo?: Id) {
    const d = data.value
    if (kind === 'tags') {
      for (const x of d.oneTimeExpenses) {
        if (x.tagIds?.includes(id)) {
          x.tagIds = x.tagIds.filter((t) => t !== id)
          if (reassignTo && !x.tagIds.includes(reassignTo)) {
            x.tagIds.push(reassignTo)
          }
        }
      }
      remove(d.tags, id)
      return
    }
    const field = REF_FIELD[kind]
    if (reassignTo) {
      for (const x of [...d.oneTimeExpenses, ...d.recurringExpenses, ...d.incomes]) {
        if (x[field] === id) x[field] = reassignTo
      }
    }
    remove(d[kind], id)
    if (kind === 'categories') {
      d.forecast.incomeCategoryIds = d.forecast.incomeCategoryIds.filter((c) => c !== id)
      // Con la categoria spostata altrove il suo limite non ha più senso: i soldi ora contano in quella di destinazione.
      delete d.budget.limits[id]
    }
  }

  return {
    data,
    ready,
    saveError,
    selectedYear,
    selectedMonth,
    isMonthFiltered,
    monthSummaryData,
    oneTimeFiltered,
    init,
    flush,
    replaceAll,
    applySynced,
    years,
    summary,
    forecastRows,
    estimatedMonthlyIncome,
    estimateCategories,
    variableThisMonth,
    setForecastSettings,
    setBudgetLimit,
    today,
    oneTimeOfYear,
    incomesOfYear,
    recurringOfYear,
    simulationsOfYear,
    loans,
    tag,
    saveOneTime,
    saveIncome,
    saveRecurring,
    applyNotificationsToRecurring,
    deleteOneTime,
    deleteIncome,
    deleteRecurring,
    saveLoan,
    deleteLoan,
    addRepayment,
    deleteRepayment,
    addSimulation,
    deleteSimulation,
    addTag,
    renameTag,
    setTagColor,
    randomizeTagColor,
    tagUsage,
    deleteTag,
  }
})
