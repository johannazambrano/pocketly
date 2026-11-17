import { describe, expect, it } from 'vitest'
import { sortTagsByName } from './tags'

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
