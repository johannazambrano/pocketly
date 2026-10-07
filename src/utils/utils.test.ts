import { describe, expect, it } from 'vitest'
import { toCents, formatCents } from './money'
import { isValidIsoDate, parseIsoDate } from './dates'
import { PALETTE, pickUniqueColor, readableTextColor } from './colors'

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

describe('pickUniqueColor', () => {
  it('usa prima la palette, poi colori nuovi', () => {
    expect(pickUniqueColor([PALETTE[0]!])).toBe(PALETTE[1])
    const next = pickUniqueColor(PALETTE)
    expect(next).toMatch(/^#[0-9a-f]{6}$/)
    expect(PALETTE).not.toContain(next)
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
