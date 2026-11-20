import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESKTOP_SECTION,
  getSettingsSection,
  isSettingsSection,
  SETTINGS_GROUPS,
  SETTINGS_SECTION_IDS,
  SETTINGS_SECTIONS,
} from './settingsSections'

describe('settingsSections', () => {
  it('raggruppa tutte le sezioni esattamente una volta senza duplicati né omissioni', () => {
    const groupedIds = SETTINGS_GROUPS.flatMap((g) => g.sections.map((s) => s.id))
    expect(groupedIds).toHaveLength(SETTINGS_SECTION_IDS.length)
    expect(new Set(groupedIds)).toEqual(new Set(SETTINGS_SECTION_IDS))
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual([...SETTINGS_SECTION_IDS])
  })

  it('riconosce gli slug validi e rifiuta valori estranei', () => {
    for (const id of SETTINGS_SECTION_IDS) {
      expect(isSettingsSection(id)).toBe(true)
    }
    expect(isSettingsSection('sconosciuta')).toBe(false)
    expect(isSettingsSection('')).toBe(false)
    expect(isSettingsSection(undefined)).toBe(false)
    expect(isSettingsSection(null)).toBe(false)
  })

  it('restituisce i metadati della sezione richiesta e la sezione desktop predefinita è valida', () => {
    expect(isSettingsSection(DEFAULT_DESKTOP_SECTION)).toBe(true)
    expect(getSettingsSection('dati').group).toBe('dataSync')
    expect(getSettingsSection('categorie').group).toBe('organization')
    expect(getSettingsSection('aspetto').group).toBe('preferences')
    expect(getSettingsSection('informazioni').group).toBe('app')
  })
})
