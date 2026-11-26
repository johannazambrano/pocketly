import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { Tag } from '@/types/models'
import { useTagFilteredEntries, type TagFilterable } from './useTagFilteredEntries'

const tags: Record<string, Tag> = {
  vacanza: { id: 'vacanza', name: 'Vacanza', color: '#111111' },
  regali: { id: 'regali', name: 'Regali', color: '#222222' },
}

/** Anno con una vacanza a cavallo di luglio e agosto; il periodo scelto è luglio. */
function setup() {
  const year = ref<TagFilterable[]>([
    { id: 'volo', amount: 30000, tagIds: ['vacanza'] },
    { id: 'hotel', amount: 60000, tagIds: ['vacanza'] },
    { id: 'regalo', amount: 5000, tagIds: ['regali'] },
    { id: 'pane', amount: 300 },
    { id: 'rientro', amount: 20000, tagIds: ['vacanza', 'perso'] },
  ])
  const period = ref(year.value.slice(0, 4))
  const filter = useTagFilteredEntries({
    filtered: () => period.value,
    ofYear: () => year.value,
    lookupTag: (id) => tags[id],
  })
  return { filter, period, year }
}

describe('useTagFilteredEntries', () => {
  it('senza filtro mostra tutte le voci del periodo con il loro totale', () => {
    const { filter } = setup()
    expect(filter.displayedItems.value.map((e) => e.id)).toEqual(['volo', 'hotel', 'regalo', 'pane'])
    expect(filter.total.value).toBe(95300)
    expect(filter.selectedTag.value).toBeNull()
  })

  it('il filtro di un tag mostra solo le sue voci; ritoccarlo o «Tutti» lo toglie', () => {
    const { filter } = setup()
    filter.toggleTagFilter('vacanza')
    expect(filter.selectedTag.value?.name).toBe('Vacanza')
    expect(filter.displayedItems.value.map((e) => e.id)).toEqual(['volo', 'hotel'])
    expect(filter.total.value).toBe(90000)
    filter.toggleTagFilter('vacanza')
    expect(filter.selectedTagId.value).toBeNull()
    filter.toggleTagFilter('regali')
    filter.toggleTagFilter(null)
    expect(filter.selectedTagId.value).toBeNull()
  })

  it('dà il totale e il numero di voci del tag sull’anno intero', () => {
    const { filter } = setup()
    filter.toggleTagFilter('vacanza')
    expect(filter.yearCountForSelectedTag.value).toBe(3)
    expect(filter.yearTotalForSelectedTag.value).toBe(110000)
  })

  it('la barra ha i tag dell’anno, dal più pesante, con le voci del periodo contate una volta', () => {
    const { filter } = setup()
    expect(filter.activeYearTags.value.map(({ id, countInMonth, totalInYear }) => ({ id, countInMonth, totalInYear }))).toEqual([
      { id: 'vacanza', countInMonth: 2, totalInYear: 110000 },
      { id: 'perso', countInMonth: 0, totalInYear: 20000 },
      { id: 'regali', countInMonth: 1, totalInYear: 5000 },
    ])
    // Un tag cancellato ma ancora citato dalle voci resta, senza dati.
    expect(filter.activeYearTags.value[1]!.tag).toBeUndefined()
  })

  it('il riepilogo è sul periodo e il divisore delle percentuali non è mai zero', () => {
    const { filter, period } = setup()
    expect(filter.breakdown.value.map((r) => [r.id, r.total, r.count, r.tag?.name])).toEqual([
      ['vacanza', 90000, 2, 'Vacanza'],
      ['regali', 5000, 1, 'Regali'],
    ])
    expect(filter.grandTotalForBreakdown.value).toBe(95300)
    period.value = []
    expect(filter.grandTotalForBreakdown.value).toBe(1)
  })

  it('una voce cercata che il filtro nasconderebbe toglie il filtro', () => {
    const { filter } = setup()
    filter.toggleTagFilter('vacanza')
    expect(filter.revealEntry('hotel')).toBe('hotel')
    expect(filter.selectedTagId.value).toBe('vacanza')
    expect(filter.revealEntry('pane')).toBe('pane')
    expect(filter.selectedTagId.value).toBeNull()
  })
})
