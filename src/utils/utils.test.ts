import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id'
import { centsToInput, toCents, formatCents } from './money'
import { isValidIsoDate, parseIsoDate } from './dates'
import { OTHER_COLOR, PALETTE, badgeColors, contrast, harmonizedColors, hexToOklch, pickUniqueColor, randomUniqueColor, readableTextColor } from './colors'

describe('toCents', () => {
  it('accetta virgola e punto ed evita errori di arrotondamento', () => {
    expect(toCents('12,50')).toBe(1250)
    expect(toCents('0.1')).toBe(10)
    expect(toCents(19.99)).toBe(1999)
    expect(toCents('abc')).toBeNull()
  })
})

describe('formatCents', () => {
  it('formatta in euro', () => {
    expect(formatCents(12345678, 'it-IT').replace(/\s/g, ' ')).toBe('123.456,78 €')
  })
  it('separa le migliaia anche sotto 10.000', () => {
    expect(formatCents(272430, 'it-IT').replace(/\s/g, ' ')).toBe('2.724,30 €')
    expect(formatCents(-128019, 'it-IT').replace(/\s/g, ' ')).toBe('-1.280,19 €')
    expect(formatCents(99999, 'it-IT').replace(/\s/g, ' ')).toBe('999,99 €')
  })
})

describe('date', () => {
  it('legge le date senza fuso orario', () => {
    expect(parseIsoDate('2026-03-01')).toEqual({ year: 2026, month: 2, day: 1 })
  })
  it('valida le date', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('01/02/2026')).toBe(false)
  })
})

const hueGap = (a: string, b: string) => {
  const d = Math.abs(hexToOklch(a)![2] - hexToOklch(b)![2]) % 360
  return Math.min(d, 360 - d)
}
const isReddish = (c: string) => {
  const [, chroma, h] = hexToOklch(c)!
  return chroma > 0.04 && (h < 40 || h > 350)
}

describe('tavolozza', () => {
  it('ha la stessa luminosità per tutte le tinte, niente rossi e testo scuro leggibile sopra', () => {
    for (const c of PALETTE) {
      expect(hexToOklch(c)![0]).toBeCloseTo(0.66, 2)
      expect(isReddish(c)).toBe(false)
      expect(contrast(c, readableTextColor(c))).toBeGreaterThanOrEqual(4.5)
    }
    expect(new Set(PALETTE).size).toBe(PALETTE.length)
  })
})

describe('pickUniqueColor', () => {
  it('sceglie la tinta della tavolozza più lontana da quelle usate', () => {
    expect(pickUniqueColor([])).toBe(PALETTE[0])
    expect(pickUniqueColor([PALETTE[0]!])).toBe(PALETTE[1])
    const next = pickUniqueColor(PALETTE.slice(0, 3))
    expect(PALETTE).toContain(next)
    for (const used of PALETTE.slice(0, 3)) expect(hueGap(next, used)).toBeGreaterThan(30)
  })

  it('a tavolozza finita crea colori nuovi con la stessa luminosità, mai rossi', () => {
    const next = pickUniqueColor(PALETTE)
    expect(next).toMatch(/^#[0-9a-f]{6}$/)
    expect(PALETTE).not.toContain(next)
    expect(hexToOklch(next)![0]).toBeCloseTo(0.66, 2)
    expect(isReddish(next)).toBe(false)
  })

  it('ignora i grigi: non occupano nessuna tinta', () => {
    expect(pickUniqueColor([OTHER_COLOR])).toBe(PALETTE[0])
  })
})

describe('randomUniqueColor', () => {
  it('resta nelle tinte ammesse con la stessa luminosità', () => {
    let seed = 0.1
    const random = () => (seed = (seed * 9301 + 0.49297) % 1)
    for (let i = 0; i < 20; i++) {
      const c = randomUniqueColor([], random)
      expect(hexToOklch(c)![0]).toBeCloseTo(0.66, 2)
      expect(isReddish(c)).toBe(false)
    }
  })
})

describe('harmonizedColors', () => {
  it('dà il grigio ad «Altro» e tinte diverse agli altri, lontane anche da quelle già date', () => {
    const colors = harmonizedColors(['Cibo', 'Altro', 'Casa', 'Other'], [PALETTE[0]!])
    expect(colors[1]).toBe(OTHER_COLOR)
    expect(colors[3]).toBe(OTHER_COLOR)
    expect(colors[0]).not.toBe(PALETTE[0])
    expect(colors[2]).not.toBe(colors[0])
  })
})

describe('readableTextColor', () => {
  it('usa testo scuro sui colori chiari e bianco su quelli scuri', () => {
    expect(readableTextColor('#E3EBBF')).toBe('#0f172a')
    expect(readableTextColor('#87FAB1')).toBe('#0f172a')
    expect(readableTextColor('#221675')).toBe('#ffffff')
    expect(readableTextColor('#356F6B')).toBe('#ffffff')
  })
})

describe('badgeColors', () => {
  it('tiene i colori che reggono già un testo leggibile', () => {
    expect(badgeColors(PALETTE[0]!).background).toBe(PALETTE[0])
    expect(badgeColors('#221675')).toEqual({ background: '#221675', color: '#ffffff' })
  })

  it('schiarisce le tinte medie scelte a mano finché il testo scuro arriva a 4,5:1', () => {
    for (const c of ['#ef4444', '#3b82f6', '#8b5cf6', '#e11d48']) {
      const b = badgeColors(c)
      expect(contrast(b.background, b.color)).toBeGreaterThanOrEqual(4.5)
      expect(hueGap(b.background, c)).toBeLessThan(8)
    }
  })
})

describe('newId', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  afterEach(() => vi.unstubAllGlobals())

  it('genera UUID v4 univoci', () => {
    const ids = new Set(Array.from({ length: 100 }, newId))
    expect(ids.size).toBe(100)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('funziona anche senza crypto.randomUUID (contesto non sicuro, es. HTTP in rete locale)', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    const a = newId()
    expect(a).toMatch(UUID_V4)
    expect(newId()).not.toBe(a)
  })
})

describe('centsToInput', () => {
  it('usa il separatore decimale della lingua, e toCents lo rilegge', () => {
    expect(centsToInput(1300)).toBe('13.00')
    expect(centsToInput(1300, 'it-IT')).toBe('13,00')
    expect(centsToInput(1300, 'en-GB')).toBe('13.00')
    expect(toCents(centsToInput(123456, 'it-IT'))).toBe(123456)
  })
})
