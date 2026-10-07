import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type {
  FinanceData,
  Id,
  Income,
  Loan,
  OneTimeExpense,
  RecurringExpense,
  Repayment,
  Simulation,
  Tag,
} from '@/types/models'
import { availableYears, forecast, yearSummary } from '@/domain/calculations'
import { isActiveInYear } from '@/domain/recurrence'
import { createDefaultData, createEmptyData } from '@/domain/defaults'
import { deviceDataStore, type DataStore } from '@/services/storage'
import { pickUniqueColor, randomUniqueColor } from '@/utils/colors'
import { yearOf } from '@/utils/dates'
import { newId } from '@/utils/id'

export type TagKind = 'categories' | 'paymentMethods'
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
      if (document.visibilityState === 'hidden' && saveTimer) void flush()
    })
    ready.value = true
  }

  function replaceAll(next: FinanceData) {
    data.value = next
    selectedYear.value = new Date().getFullYear()
  }

  // --- viste derivate ----------------------------------------------------

  const years = computed(() => availableYears(data.value, new Date().getFullYear()))
  const summary = computed(() => yearSummary(data.value, selectedYear.value))
  const forecastRows = computed(() => forecast(data.value, selectedYear.value))

  const oneTimeOfYear = computed(() =>
    data.value.oneTimeExpenses.filter((e) => yearOf(e.date) === selectedYear.value).sort(byDateDesc),
  )
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
  }))

  function tag(kind: TagKind, id: Id): Tag | undefined {
    return tagMaps.value[kind].get(id)
  }

  // --- movimenti ---------------------------------------------------------

  function saveOneTime(item: WithOptionalId<OneTimeExpense>) {
    upsert(data.value.oneTimeExpenses, item)
    selectedYear.value = yearOf(item.date)
  }

  function saveIncome(item: WithOptionalId<Income>) {
    upsert(data.value.incomes, item)
    selectedYear.value = yearOf(item.date)
  }

  function saveRecurring(item: WithOptionalId<RecurringExpense>) {
    upsert(data.value.recurringExpenses, item)
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

  // --- categorie e metodi di pagamento -----------------------------------

  function allColors() {
    return [...data.value.categories, ...data.value.paymentMethods].map((t) => t.color)
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
    const field = REF_FIELD[kind]
    const d = data.value
    return [...d.oneTimeExpenses, ...d.recurringExpenses, ...d.incomes].filter((x) => x[field] === id).length
  }

  /** Elimina una categoria/metodo spostando le voci che lo usano su `reassignTo`. */
  function deleteTag(kind: TagKind, id: Id, reassignTo?: Id) {
    const field = REF_FIELD[kind]
    const d = data.value
    if (reassignTo) {
      for (const x of [...d.oneTimeExpenses, ...d.recurringExpenses, ...d.incomes]) {
        if (x[field] === id) x[field] = reassignTo
      }
    }
    remove(d[kind], id)
  }

  return {
    data,
    ready,
    saveError,
    selectedYear,
    init,
    flush,
    replaceAll,
    years,
    summary,
    forecastRows,
    oneTimeOfYear,
    incomesOfYear,
    recurringOfYear,
    simulationsOfYear,
    loans,
    tag,
    saveOneTime,
    saveIncome,
    saveRecurring,
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
