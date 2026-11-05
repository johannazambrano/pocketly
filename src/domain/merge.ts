/**
 * Unione a tre vie dei dati tra questo dispositivo e il server.
 *
 * `base` è l'ultima versione che questo dispositivo ha sincronizzato: confrontandola con i dati locali e con
 * quelli del server si capisce con certezza chi ha cambiato cosa.
 * - Una voce cambiata da una parte sola prende quella modifica (anche la cancellazione).
 * - Una voce cambiata da tutte e due le parti in modo diverso: vince questo dispositivo, cioè l'ultimo che sincronizza.
 * - Una voce cancellata da una parte e modificata dall'altra resta, con la modifica: niente si perde in silenzio.
 * - Le voci si riconoscono solo per ID: due voci identiche con ID diversi (due caffè nello stesso giorno) restano due.
 *
 * L'unione è generica: funziona su qualsiasi elenco di voci con `id` e su qualsiasi campo, anche su quelli
 * che questa versione dell'app non conosce ancora.
 */
import type { FinanceData, Id } from '@/types/models'

/** Chiave assente in un oggetto (diverso da `undefined` o `null`, che sono valori). */
const ABSENT = Symbol('absent')
type Value = unknown

type Obj = Record<string, unknown>
const isObj = (v: Value): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const hasId = (v: Value): v is { id: Id } => isObj(v) && typeof v.id === 'string'

export function deepEqual(a: Value, b: Value): boolean {
  if (a === b) return true
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
  }
  return false
}

/** Elenco di voci con ID (spese, entrate, categorie, prestiti…), da unire voce per voce. */
function isIdList(v: Value): v is { id: Id }[] {
  return Array.isArray(v) && v.every(hasId)
}

/** Entrambe le parti hanno cambiato lo stesso valore: vince chi c'è, e tra due presenti vince questo dispositivo. */
function conflict(local: Value, remote: Value): Value {
  return local === ABSENT ? remote : local
}

function mergeIdList(base: { id: Id }[], local: { id: Id }[], remote: { id: Id }[]): { id: Id }[] {
  const b = new Map(base.map((x) => [x.id, x]))
  const l = new Map(local.map((x) => [x.id, x]))
  const r = new Map(remote.map((x) => [x.id, x]))
  // Ordine: quello del server, poi le voci nuove di questo dispositivo.
  const ids = [...r.keys(), ...[...l.keys()].filter((id) => !r.has(id))]
  const out: { id: Id }[] = []
  for (const id of ids) {
    // Ogni voce è un'unità: se cambiata da tutte e due le parti non si mescolano i campi.
    const merged = mergeAtom(b.get(id) ?? ABSENT, l.get(id) ?? ABSENT, r.get(id) ?? ABSENT)
    if (merged !== ABSENT) out.push(merged as { id: Id })
  }
  return out
}

const isStringList = (v: Value): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Elenchi di ID (es. categorie usate per stimare le entrate): aggiunte e rimozioni di tutte e due le parti. */
function mergeStringSet(base: string[], local: string[], remote: string[]): string[] {
  const removed = new Set(base.filter((x) => !local.includes(x) || !remote.includes(x)))
  return [...new Set([...remote, ...local])].filter((x) => !removed.has(x))
}

function mergeAtom(base: Value, local: Value, remote: Value): Value {
  if (deepEqual(local, remote)) return local
  if (deepEqual(base, local)) return remote
  if (deepEqual(base, remote)) return local
  return conflict(local, remote)
}

function mergeValue(base: Value, local: Value, remote: Value): Value {
  if (deepEqual(local, remote)) return local
  if (deepEqual(base, local)) return remote
  if (deepEqual(base, remote)) return local

  // Cambiato da tutte e due le parti: si scende nei dettagli dove ha senso.
  const listBase = base === ABSENT ? [] : base
  if (isIdList(listBase) && isIdList(local) && isIdList(remote)) {
    return mergeIdList(listBase, local, remote)
  }
  if (isStringList(listBase) && isStringList(local) && isStringList(remote)) {
    return mergeStringSet(listBase, local, remote)
  }
  if (isObj(local) && isObj(remote)) {
    const objBase = isObj(base) ? base : {}
    const out: Obj = {}
    const keys = new Set([...Object.keys(remote), ...Object.keys(local)])
    for (const k of keys) {
      const v = mergeValue(
        k in objBase ? objBase[k] : ABSENT,
        k in local ? local[k] : ABSENT,
        k in remote ? remote[k] : ABSENT,
      )
      if (v !== ABSENT) out[k] = v
    }
    return out
  }
  return conflict(local, remote)
}

/** Campi delle voci che puntano a una categoria o a un metodo di pagamento. */
const TAG_REFS = { categoryId: 'categories', paymentMethodId: 'paymentMethods' } as const

/**
 * Dopo l'unione una voce può puntare a una categoria cancellata sull'altro dispositivo:
 * la categoria si ripristina, perché è ancora in uso. Le impostazioni che puntano a categorie
 * davvero sparite (budget, stima delle entrate) vengono ripulite.
 */
function repairReferences(data: FinanceData, ...sources: FinanceData[]): FinanceData {
  const lists = { categories: [...data.categories], paymentMethods: [...data.paymentMethods] }
  const known = { categories: new Set(lists.categories.map((t) => t.id)), paymentMethods: new Set(lists.paymentMethods.map((t) => t.id)) }

  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (!isObj(item)) continue
      for (const [field, kind] of Object.entries(TAG_REFS)) {
        const id = item[field]
        if (typeof id !== 'string' || known[kind].has(id)) continue
        const tag = sources.map((s) => s[kind].find((t) => t.id === id)).find(Boolean)
        if (tag) {
          lists[kind].push(tag)
          known[kind].add(id)
        }
      }
    }
  }

  const limits = Object.fromEntries(Object.entries(data.budget.limits).filter(([id]) => known.categories.has(id)))
  return {
    ...data,
    categories: lists.categories,
    paymentMethods: lists.paymentMethods,
    forecast: { ...data.forecast, incomeCategoryIds: data.forecast.incomeCategoryIds.filter((id) => known.categories.has(id)) },
    budget: { ...data.budget, limits },
  }
}

export function mergeFinanceData(base: FinanceData, local: FinanceData, remote: FinanceData): FinanceData {
  const merged = mergeValue(base, local, remote) as FinanceData
  return repairReferences(merged, local, remote, base)
}
