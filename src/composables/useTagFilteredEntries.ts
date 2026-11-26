import { computed, ref } from 'vue'
import type { Cents, Id, Tag } from '@/types/models'
import { tagBreakdown } from '@/domain/calculations'

/** Una voce filtrabile per tag: spesa una tantum o entrata. */
export interface TagFilterable {
  id: Id
  amount: Cents
  tagIds?: Id[]
}

export interface ActiveTag {
  id: Id
  /** `undefined` se il tag non esiste più (la voce lo cita ancora). */
  tag: Tag | undefined
  /** Voci con il tag nel periodo scelto. */
  countInMonth: number
  totalInYear: Cents
}

export interface TagBreakdownRow {
  id: Id
  tag: Tag | undefined
  total: Cents
  count: number
}

export interface TagFilterSource<T extends TagFilterable> {
  /** Voci del periodo scelto (mese o anno intero). */
  filtered: () => T[]
  /** Voci dell'anno scelto. */
  ofYear: () => T[]
  lookupTag: (id: Id) => Tag | undefined
}

const hasTag = (tagId: Id) => (e: TagFilterable) => e.tagIds?.includes(tagId) ?? false

/**
 * Filtro per tag condiviso da Spese (`OneTimeView`) ed Entrate (`IncomeView`): tag attivo, voci mostrate e totale,
 * ripartizione per tag del periodo, tag dell'anno per la barra dei filtri, totale annuo del tag scelto.
 * La parte visiva è `TagFilterPanel.vue`.
 */
export function useTagFilteredEntries<T extends TagFilterable>(source: TagFilterSource<T>) {
  const selectedTagId = ref<Id | null>(null)

  const selectedTag = computed(() => (selectedTagId.value ? (source.lookupTag(selectedTagId.value) ?? null) : null))

  const displayedItems = computed(() => {
    const id = selectedTagId.value
    return id ? source.filtered().filter(hasTag(id)) : source.filtered()
  })

  const total = computed(() => displayedItems.value.reduce((acc, e) => acc + e.amount, 0))

  /** Il tag scelto sull'anno intero (es. una vacanza a cavallo di due mesi). */
  const yearOfSelectedTag = computed(() => {
    const id = selectedTagId.value
    return id ? source.ofYear().filter(hasTag(id)) : []
  })
  const yearTotalForSelectedTag = computed(() => yearOfSelectedTag.value.reduce((acc, e) => acc + e.amount, 0))
  const yearCountForSelectedTag = computed(() => yearOfSelectedTag.value.length)

  const breakdown = computed<TagBreakdownRow[]>(() =>
    tagBreakdown(source.filtered()).map((row) => ({ ...row, tag: source.lookupTag(row.id) })),
  )
  /** Mai zero: è il divisore delle percentuali. */
  const grandTotalForBreakdown = computed(() => source.filtered().reduce((acc, e) => acc + e.amount, 0) || 1)

  /** Tag con voci nell'anno, dal più pesante; il conteggio del periodo si fa in un solo passaggio. */
  const activeYearTags = computed<ActiveTag[]>(() => {
    const countInPeriod = new Map<Id, number>()
    for (const e of source.filtered()) for (const id of e.tagIds ?? []) countInPeriod.set(id, (countInPeriod.get(id) ?? 0) + 1)
    return tagBreakdown(source.ofYear()).map((item) => ({
      id: item.id,
      tag: source.lookupTag(item.id),
      countInMonth: countInPeriod.get(item.id) ?? 0,
      totalInYear: item.total,
    }))
  })

  /** Toccare il tag già scelto (o «Tutti») toglie il filtro. */
  function toggleTagFilter(tagId: Id | null) {
    selectedTagId.value = selectedTagId.value === tagId ? null : tagId
  }

  /** Per `useHighlight`: se il filtro attivo nasconderebbe la voce cercata, lo toglie. */
  function revealEntry(id: Id): Id {
    const tagId = selectedTagId.value
    if (tagId) {
      const entry = source.filtered().find((e) => e.id === id)
      if (!entry || !hasTag(tagId)(entry)) selectedTagId.value = null
    }
    return id
  }

  return {
    selectedTagId,
    selectedTag,
    displayedItems,
    total,
    yearTotalForSelectedTag,
    yearCountForSelectedTag,
    breakdown,
    grandTotalForBreakdown,
    activeYearTags,
    toggleTagFilter,
    revealEntry,
  }
}

export type TagFilterState = ReturnType<typeof useTagFilteredEntries>
