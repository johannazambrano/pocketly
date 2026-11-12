import type { Cents, Frequency, Id, IsoDate, RecurringExpense } from '@/types/models'
import { addDays, monthIndex, parseIsoDate, toIsoDate } from '@/utils/dates'

export const FREQUENCIES: Frequency[] = ['monthly', 'quarterly', 'semiannual', 'annual']

export const FREQUENCY_MONTHS: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

/** Costo medio mensile della ricorrenza. */
export function monthlyEquivalent(r: Pick<RecurringExpense, 'amount' | 'frequency'>): number {
  return r.amount / FREQUENCY_MONTHS[r.frequency]
}

/** True se la ricorrenza prevede un addebito nel mese indicato. */
export function occursIn(r: RecurringExpense, year: number, month: number): boolean {
  const start = parseIsoDate(r.startDate)
  const target = monthIndex(year, month)
  const offset = target - monthIndex(start.year, start.month)
  if (offset < 0 || offset % FREQUENCY_MONTHS[r.frequency] !== 0) return false
  if (r.endDate) {
    const end = parseIsoDate(r.endDate)
    const endIndex = monthIndex(end.year, end.month)
    if (target > endIndex) return false
    // Nel mese in cui finisce conta il giorno: una serie che finisce il 14 non ha l'addebito del 15. Senza questo, una
    // serie divisa (vedi `splitRecurring`) conterebbe due volte il mese della divisione.
    if (target === endIndex) {
      const day = Math.min(start.day, new Date(year, month + 1, 0).getDate())
      if (day > end.day) return false
    }
  }
  return true
}

/**
 * Data dell'addebito nel mese indicato, o null se quel mese non ne ha. Il giorno è quello della data
 * di inizio, limitato all'ultimo giorno del mese (es. 31 → 30 aprile).
 */
export function dueDateIn(r: RecurringExpense, year: number, month: number): IsoDate | null {
  if (!occursIn(r, year, month)) return null
  const day = Math.min(parseIsoDate(r.startDate).day, new Date(year, month + 1, 0).getDate())
  return toIsoDate(year, month, day)
}

export function amountInMonth(r: RecurringExpense, year: number, month: number): Cents {
  return occursIn(r, year, month) ? r.amount : 0
}

/**
 * Data del prossimo addebito a partire da `from` (incluso), o null se la
 * ricorrenza è terminata. Il giorno è quello della data di inizio, limitato
 * all'ultimo giorno del mese (es. 31 → 30 aprile).
 */
export function nextDueDate(r: RecurringExpense, from: IsoDate): IsoDate | null {
  const start = parseIsoDate(r.startDate)
  const step = FREQUENCY_MONTHS[r.frequency]
  const f = parseIsoDate(from)
  let offset = Math.max(0, monthIndex(f.year, f.month) - monthIndex(start.year, start.month))
  offset = Math.ceil(offset / step) * step
  for (let i = 0; i < 2; i++, offset += step) {
    const abs = monthIndex(start.year, start.month) + offset
    const year = Math.floor(abs / 12)
    const month = abs % 12
    const day = Math.min(start.day, new Date(year, month + 1, 0).getDate())
    const due = toIsoDate(year, month, day)
    if (due < from) continue
    return r.endDate && due > r.endDate ? null : due
  }
  return null
}

/**
 * Divide una ricorrenza da un addebito in poi: la serie esistente si ferma il giorno prima di `from` (gli addebiti già
 * passati restano com'erano), e ne parte una nuova da `from` con i valori nuovi. Serve per "Netflix costa di più da
 * questo mese" senza riscrivere i mesi precedenti.
 * `from` deve essere una data di addebito successiva al primo: altrimenti non c'è niente da tenere e si modifica la serie
 * intera. Il giorno degli addebiti della nuova serie è quello di `from` (dopo un 31 accorciato a 30 resta il 30).
 * Le due parti restano collegate dallo stesso `seriesId` (quello della serie, o l'id della prima parte).
 *
 * `start` sposta l'addebito `from` a un altro giorno (es. dal 14 al 15): la nuova serie parte da `start` e prende quel
 * giorno, la vecchia si ferma il giorno prima del primo dei due. Così nel mese del cambio c'è un addebito solo. `start`
 * deve stare in `moveWindow(r, from)`, altrimenti si salterebbe o si raddoppierebbe un addebito.
 */
export function splitRecurring(
  r: RecurringExpense,
  from: IsoDate,
  changes: Omit<RecurringExpense, 'id' | 'startDate' | 'seriesId'>,
  start: IsoDate = from,
): { before: RecurringExpense; after: Omit<RecurringExpense, 'id'> } {
  if (from <= r.startDate) throw new Error('splitRecurring: la data deve essere successiva al primo addebito')
  const window = moveWindow(r, from)
  if (start < window.min || start > window.max) throw new Error('splitRecurring: il nuovo primo addebito salta o raddoppia un addebito')
  const seriesId = seriesKey(r)
  return {
    before: { ...r, seriesId, endDate: addDays(start < from ? start : from, -1) },
    after: { ...changes, startDate: start, seriesId },
  }
}

/** Data dell'addebito `steps` periodi dopo (o prima, se negativo) il mese di `date`, con il giorno della serie. */
function shiftDue(r: RecurringExpense, date: IsoDate, steps: number): IsoDate {
  const d = parseIsoDate(date)
  const abs = monthIndex(d.year, d.month) + steps * FREQUENCY_MONTHS[r.frequency]
  const year = Math.floor(abs / 12)
  const month = abs % 12
  const day = Math.min(parseIsoDate(r.startDate).day, new Date(year, month + 1, 0).getDate())
  return toIsoDate(year, month, day)
}

/**
 * Dove si può spostare l'addebito `from` senza saltarne o raddoppiarne uno: dal giorno dopo l'addebito precedente al
 * giorno prima del successivo (o alla fine della serie). Per una spesa mensile del 14 spostata a novembre: dal 15/10
 * al 13/12.
 */
export function moveWindow(r: RecurringExpense, from: IsoDate): { min: IsoDate; max: IsoDate } {
  const min = addDays(shiftDue(r, from, -1), 1)
  const beforeNext = addDays(shiftDue(r, from, 1), -1)
  return { min, max: r.endDate && r.endDate < beforeNext ? r.endDate : beforeNext }
}

/** Chiave della spesa a cui appartiene una parte: il `seriesId`, o l'id stesso per una spesa mai divisa. */
export function seriesKey(r: Pick<RecurringExpense, 'id' | 'seriesId'>): Id {
  return r.seriesId ?? r.id
}

/** Una spesa ricorrente come la vede l'utente: una o più parti collegate (un cambio «da questo addebito in poi»). */
export interface RecurringSeries {
  key: Id
  /** Tutte le parti, in ordine di primo addebito. */
  parts: RecurringExpense[]
  /** La parte da mostrare alla data di riferimento: quella in corso, o l'ultima iniziata, o la prima se nessuna è iniziata. */
  current: RecurringExpense
  /** La parte prima di `current` (com'era), se c'è. */
  previous: RecurringExpense | null
  /** La parte dopo `current` (un cambio già programmato), se c'è. */
  next: RecurringExpense | null
  /** `current` è attiva alla data di riferimento: conta nel totale mensile. */
  active: boolean
}

function activeOn(r: RecurringExpense, day: IsoDate): boolean {
  return r.startDate <= day && (!r.endDate || r.endDate >= day)
}

/**
 * Raggruppa le parti per spesa (`seriesKey`) e sceglie quale mostrare alla data `ref`. Le parti di una serie non si
 * sovrappongono: `splitRecurring` chiude la precedente il giorno prima che parta la successiva.
 */
export function groupRecurringSeries(items: RecurringExpense[], ref: IsoDate): RecurringSeries[] {
  const byKey = new Map<Id, RecurringExpense[]>()
  for (const r of items) {
    const key = seriesKey(r)
    const list = byKey.get(key)
    if (list) list.push(r)
    else byKey.set(key, [r])
  }
  return [...byKey.entries()].map(([key, list]) => {
    const parts = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const started = parts.filter((p) => p.startDate <= ref)
    const current = parts.find((p) => activeOn(p, ref)) ?? started[started.length - 1] ?? parts[0]!
    const i = parts.indexOf(current)
    return {
      key,
      parts,
      current,
      previous: parts[i - 1] ?? null,
      next: parts[i + 1] ?? null,
      active: activeOn(current, ref),
    }
  })
}

/** True se la ricorrenza è attiva in almeno un giorno dell'anno. */
export function isActiveInYear(r: RecurringExpense, year: number): boolean {
  if (parseIsoDate(r.startDate).year > year) return false
  return !r.endDate || parseIsoDate(r.endDate).year >= year
}
