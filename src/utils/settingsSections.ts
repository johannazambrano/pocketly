/**
 * Registro delle sezioni e dei gruppi delle Impostazioni (`/impostazioni/:section`).
 * Fonte unica per il router, l'indice e le pagine figlie.
 */
export const SETTINGS_SECTION_IDS = [
  'dati',
  'sincronizzazione',
  'notifiche',
  'categorie',
  'metodi',
  'tag',
  'inserimenti-rapidi',
  'aspetto',
  'informazioni',
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number]

export type SettingsGroupId = 'dataSync' | 'organization' | 'preferences' | 'app'

export type SettingsIconTone = 'accent' | 'sync' | 'caution' | 'recurring' | 'neutral'

export interface SettingsSectionMeta {
  id: SettingsSectionId
  group: SettingsGroupId
  titleKey: string
  icon: string
  iconTone: SettingsIconTone
}

export interface SettingsGroupMeta {
  id: SettingsGroupId
  titleKey: string
  sections: SettingsSectionMeta[]
}

export const DEFAULT_DESKTOP_SECTION: SettingsSectionId = 'dati'

export const SETTINGS_SECTIONS: readonly SettingsSectionMeta[] = [
  { id: 'dati', group: 'dataSync', titleKey: 'settings.sections.dati', icon: 'fa-cloud-arrow-down', iconTone: 'accent' },
  { id: 'sincronizzazione', group: 'dataSync', titleKey: 'settings.sections.sincronizzazione', icon: 'fa-cloud', iconTone: 'sync' },
  { id: 'notifiche', group: 'dataSync', titleKey: 'settings.sections.notifiche', icon: 'fa-bell', iconTone: 'caution' },
  { id: 'categorie', group: 'organization', titleKey: 'settings.sections.categorie', icon: 'fa-folder-open', iconTone: 'recurring' },
  { id: 'metodi', group: 'organization', titleKey: 'settings.sections.metodi', icon: 'fa-credit-card', iconTone: 'recurring' },
  { id: 'tag', group: 'organization', titleKey: 'settings.sections.tag', icon: 'fa-hashtag', iconTone: 'recurring' },
  { id: 'inserimenti-rapidi', group: 'organization', titleKey: 'settings.sections.inserimentiRapidi', icon: 'fa-bolt', iconTone: 'accent' },
  { id: 'aspetto', group: 'preferences', titleKey: 'settings.sections.aspetto', icon: 'fa-palette', iconTone: 'recurring' },
  { id: 'informazioni', group: 'app', titleKey: 'settings.sections.informazioni', icon: 'fa-circle-info', iconTone: 'neutral' },
] as const

const GROUP_ORDER: readonly { id: SettingsGroupId; titleKey: string }[] = [
  { id: 'dataSync', titleKey: 'settings.groups.dataSync' },
  { id: 'organization', titleKey: 'settings.groups.organization' },
  { id: 'preferences', titleKey: 'settings.groups.preferences' },
  { id: 'app', titleKey: 'settings.groups.app' },
]

export const SETTINGS_GROUPS: readonly SettingsGroupMeta[] = GROUP_ORDER.map((group) => ({
  ...group,
  sections: SETTINGS_SECTIONS.filter((s) => s.group === group.id),
}))

const SECTION_SET = new Set<string>(SETTINGS_SECTION_IDS)

export function isSettingsSection(value: unknown): value is SettingsSectionId {
  return typeof value === 'string' && SECTION_SET.has(value)
}

export function getSettingsSection(id: SettingsSectionId): SettingsSectionMeta {
  return SETTINGS_SECTIONS.find((s) => s.id === id) ?? SETTINGS_SECTIONS[0]!
}
