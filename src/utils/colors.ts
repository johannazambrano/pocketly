/** Palette iniziale: colori distinti e leggibili con testo bianco. */
export const PALETTE = [
  '#f59e0b', '#3b82f6', '#64748b', '#ec4899', '#10b981', '#8b5cf6', '#f97316', '#06b6d4',
  '#6366f1', '#0284c7', '#ef4444', '#84cc16', '#14b8a6', '#a855f7', '#e11d48', '#0d9488',
]

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Restituisce un colore non ancora usato: prima dalla palette, poi casuale.
 * I colori casuali hanno saturazione e luminosità medie, così le etichette
 * con testo bianco restano leggibili.
 */
export function pickUniqueColor(existing: string[], random: () => number = Math.random): string {
  const used = new Set(existing.map((c) => c.toLowerCase()))
  return PALETTE.find((c) => !used.has(c)) ?? randomUniqueColor(existing, random)
}

/** Colore casuale leggibile, diverso da quelli esistenti (anche se la palette è libera). */
export function randomUniqueColor(existing: string[], random: () => number = Math.random): string {
  const used = new Set(existing.map((c) => c.toLowerCase()))
  let color = ''
  for (let attempt = 0; attempt < 100; attempt++) {
    color = hslToHex(Math.floor(random() * 360), 0.55 + random() * 0.2, 0.4 + random() * 0.1)
    if (!used.has(color)) break
  }
  return color
}

/** Colore del testo (bianco o scuro) leggibile sopra lo sfondo indicato. */
export function readableTextColor(background: string): string {
  const hex = background.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff'
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  // Soglia in cui il contrasto con il bianco e con slate-900 si equivale.
  return luminance > 0.18 ? '#0f172a' : '#ffffff'
}
