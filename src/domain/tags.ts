import type { FinanceData, Id, Tag } from '@/types/models'

export type TagKind = 'categories' | 'paymentMethods' | 'tags'
export type TagUsageFilter = 'all' | 'used' | 'unused'
export type TagSortMode = 'name' | 'usage'

const REF_FIELD = { categories: 'categoryId', paymentMethods: 'paymentMethodId' } as const

/**
 * Normalizza un testo per il confronto di ricerca (senza maiuscole né accenti).
 */
export function normalizeTagSearch(text: string): string {
  return text
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
}

/**
 * Categorie, metodi di pagamento o tag in ordine alfabetico, come si leggono nei menu: segue la lingua dell'app
 * (`locale`, es. `it-IT`), non bada a maiuscole e accenti («ristorante» accanto a «Ristorante», «è» con «e») e
 * mette i numeri nel loro ordine («Carta 2» prima di «Carta 10»). A parità di nome resta l'ordine di creazione.
 * Restituisce un elenco nuovo: i dati salvati restano com'erano.
 */
export function sortTagsByName<T extends Pick<Tag, 'name'>>(tags: readonly T[], locale: string): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  return [...tags].sort((a, b) => collator.compare(a.name.trim(), b.name.trim()))
}

/**
 * Conta in un solo passaggio quante voci usano ciascuna categoria, metodo di pagamento o tag.
 * Per categorie e metodi conta spese variabili, ricorrenti, entrate e inserimenti rapidi;
 * per i tag conta spese variabili, entrate e inserimenti rapidi.
 */
export function countTagUsage(data: FinanceData, kind: TagKind): Map<Id, number> {
  const counts = new Map<Id, number>()
  const bump = (id: Id | undefined) => {
    if (!id) return
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  if (kind === 'tags') {
    for (const list of [data.oneTimeExpenses, data.incomes, data.quickExpenses]) {
      for (const item of list) {
        if (!item.tagIds?.length) continue
        // Un tag contato una volta per voce (come `tagIds.includes(id)`).
        const seen = new Set<Id>()
        for (const id of item.tagIds) {
          if (seen.has(id)) continue
          seen.add(id)
          bump(id)
        }
      }
    }
    return counts
  }

  const field = REF_FIELD[kind]
  for (const list of [data.oneTimeExpenses, data.recurringExpenses, data.incomes, data.quickExpenses]) {
    for (const item of list) {
      bump(item[field])
    }
  }
  return counts
}

export interface TagFilterOptions {
  query?: string
  filter?: TagUsageFilter
  sort?: TagSortMode
  locale: string
}

/**
 * Filtra (per testo di ricerca e stato di utilizzo) e ordina (alfabetico o per utilizzi decrescenti) un elenco di tag.
 */
export function filterAndSortTags<T extends Pick<Tag, 'id' | 'name'>>(
  tags: readonly T[],
  usage: ReadonlyMap<Id, number>,
  options: TagFilterOptions,
): T[] {
  const q = normalizeTagSearch(options.query ?? '')
  const filter = options.filter ?? 'all'
  const sort = options.sort ?? 'name'

  const filtered = tags.filter((item) => {
    const count = usage.get(item.id) ?? 0
    if (filter === 'used' && count === 0) return false
    if (filter === 'unused' && count > 0) return false
    if (q && !normalizeTagSearch(item.name).includes(q)) return false
    return true
  })

  const collator = new Intl.Collator(options.locale, { sensitivity: 'base', numeric: true })
  if (sort === 'usage') {
    return [...filtered].sort((a, b) => {
      const diff = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)
      if (diff !== 0) return diff
      return collator.compare(a.name.trim(), b.name.trim())
    })
  }
  return [...filtered].sort((a, b) => collator.compare(a.name.trim(), b.name.trim()))
}

export interface TagLetterGroup<T> {
  letter: string
  items: T[]
}

/**
 * Raggruppa un elenco già ordinato alfabeticamente per lettera iniziale normalizzata (A–Z, oppure `#` per numeri/simboli).
 */
export function groupTagsByLetter<T extends Pick<Tag, 'name'>>(tags: readonly T[]): TagLetterGroup<T>[] {
  const groups = new Map<string, T[]>()
  for (const item of tags) {
    const first = normalizeTagSearch(item.name).charAt(0).toUpperCase()
    const letter = /^[A-Z]$/.test(first) ? first : '#'
    const bucket = groups.get(letter)
    if (bucket) bucket.push(item)
    else groups.set(letter, [item])
  }
  return [...groups.entries()].map(([letter, items]) => ({ letter, items }))
}
