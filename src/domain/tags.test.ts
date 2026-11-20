import { describe, expect, it } from 'vitest'
import { createEmptyData } from './defaults'
import { countTagUsage, filterAndSortTags, groupTagsByLetter, sortTagsByName } from './tags'

const names = (list: { name: string }[]) => list.map((x) => x.name)

describe('sortTagsByName', () => {
  it('mette le voci in ordine alfabetico invece che di creazione', () => {
    const tags = [{ name: 'Spesa' }, { name: 'Affitto' }, { name: 'Ristorante' }]
    expect(names(sortTagsByName(tags, 'it-IT'))).toEqual(['Affitto', 'Ristorante', 'Spesa'])
  })

  it('non bada a maiuscole e accenti', () => {
    const tags = [{ name: 'zaino' }, { name: 'Élite' }, { name: 'auto' }, { name: 'Banca' }]
    expect(names(sortTagsByName(tags, 'it-IT'))).toEqual(['auto', 'Banca', 'Élite', 'zaino'])
  })

  it('mette i numeri nel loro ordine', () => {
    const tags = [{ name: 'Carta 10' }, { name: 'Carta 2' }]
    expect(names(sortTagsByName(tags, 'it-IT'))).toEqual(['Carta 2', 'Carta 10'])
  })

  it('a parità di nome tiene l’ordine di creazione e non cambia l’elenco di partenza', () => {
    const tags = [
      { id: 'b', name: 'Casa' },
      { id: 'a', name: 'casa' },
      { id: 'c', name: 'Auto' },
    ]
    expect(sortTagsByName(tags, 'it-IT').map((x) => x.id)).toEqual(['c', 'b', 'a'])
    expect(tags.map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('countTagUsage', () => {
  it('conta in un passaggio categorie, metodi e tag su tutte le raccolte pertinenti', () => {
    const data = createEmptyData()
    data.oneTimeExpenses.push(
      { id: 'e1', name: 'Pane', amount: 300, date: '2026-11-01', categoryId: 'c1', paymentMethodId: 'p1', notes: '', tagIds: ['t1', 't2'] },
      { id: 'e2', name: 'Cena', amount: 2500, date: '2026-11-02', categoryId: 'c1', paymentMethodId: 'p2', notes: '', tagIds: ['t1', 't1'] },
    )
    data.recurringExpenses.push({
      id: 'r1',
      name: 'Affitto',
      amount: 70000,
      frequency: 'monthly',
      startDate: '2026-01-01',
      endDate: null,
      categoryId: 'c2',
      paymentMethodId: 'p1',
    })
    data.incomes.push({
      id: 'i1',
      name: 'Stipendio',
      amount: 200000,
      date: '2026-11-01',
      categoryId: 'c1',
      paymentMethodId: 'p1',
      notes: '',
      tagIds: ['t2'],
    })
    data.quickExpenses.push({
      id: 'q1',
      name: 'Caffè',
      amount: 150,
      categoryId: 'c1',
      paymentMethodId: 'p2',
      notes: '',
      tagIds: ['t1'],
    })

    const catUsage = countTagUsage(data, 'categories')
    expect(catUsage.get('c1')).toBe(4)
    expect(catUsage.get('c2')).toBe(1)
    expect(catUsage.get('c-none')).toBeUndefined()

    const payUsage = countTagUsage(data, 'paymentMethods')
    expect(payUsage.get('p1')).toBe(3)
    expect(payUsage.get('p2')).toBe(2)

    const tagUsage = countTagUsage(data, 'tags')
    expect(tagUsage.get('t1')).toBe(3) // e1, e2 (contata 1 volta anche se duplicata), q1
    expect(tagUsage.get('t2')).toBe(2) // e1, i1
  })
})

describe('filterAndSortTags', () => {
  const tags = [
    { id: '1', name: 'Élite' },
    { id: '2', name: 'Casa' },
    { id: '3', name: 'Auto' },
    { id: '4', name: 'Vacanze' },
  ]
  const usage = new Map<string, number>([
    ['1', 0],
    ['2', 5],
    ['3', 12],
    ['4', 5],
  ])

  it('filtra per testo ignorando accenti e maiuscole', () => {
    expect(names(filterAndSortTags(tags, usage, { query: 'elite', locale: 'it-IT' }))).toEqual(['Élite'])
    expect(names(filterAndSortTags(tags, usage, { query: '  CA ', locale: 'it-IT' }))).toEqual(['Casa', 'Vacanze'])
  })

  it('filtra per stato di utilizzo (in uso / non usate)', () => {
    expect(names(filterAndSortTags(tags, usage, { filter: 'used', locale: 'it-IT' }))).toEqual(['Auto', 'Casa', 'Vacanze'])
    expect(names(filterAndSortTags(tags, usage, { filter: 'unused', locale: 'it-IT' }))).toEqual(['Élite'])
  })

  it('ordina per numero di utilizzi decrescente con spareggio alfabetico', () => {
    expect(names(filterAndSortTags(tags, usage, { sort: 'usage', locale: 'it-IT' }))).toEqual(['Auto', 'Casa', 'Vacanze', 'Élite'])
  })
})

describe('groupTagsByLetter', () => {
  it('raggruppa per lettera iniziale normalizzata e usa # per cifre o simboli', () => {
    const list = [
      { name: '24 ore' },
      { name: 'Affitto' },
      { name: 'auto' },
      { name: 'Élite' },
      { name: 'Energia' },
    ]
    const grouped = groupTagsByLetter(list)
    expect(grouped.map((g) => [g.letter, names(g.items)])).toEqual([
      ['#', ['24 ore']],
      ['A', ['Affitto', 'auto']],
      ['E', ['Élite', 'Energia']],
    ])
  })
})
