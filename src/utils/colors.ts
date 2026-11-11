/**
 * Colori di categorie, metodi di pagamento e tag.
 *
 * Tutti i colori nuovi hanno la stessa luminosità e la stessa intensità nello spazio OKLCH (L 0,66, C 0,13): cambia
 * solo la tinta, così nessuna etichetta "urla" più delle altre e il testo scuro sopra resta sempre leggibile (oltre
 * 5:1). Le tinte evitano i rossi (il rosso vuol dire "sotto zero"), il verde delle azioni e il blu del risultato.
 */

/** Luminosità e intensità comuni (OKLCH). */
const L = 0.66
const C = 0.13

/** Le fasce di tinta ammesse (gradi OKLCH): fuori i rossi, il verde delle azioni (~165) e il blu del risultato (~263). */
const HUE_RANGES: [number, number][] = [
  [45, 140],
  [190, 245],
  [280, 345],
]

/**
 * Le 12 tinte, già in ordine di massima distanza: le prime N sono sempre le più diverse tra loro.
 * Calcolate con L 0,66 e C 0,13 (un po' meno nei turchesi, dove il croma pieno esce dallo schermo).
 */
export const PALETTE = [
  '#cf7a3d', '#01a0d1', '#b377c5', '#7ea040', '#b18e15', '#8687df',
  '#06a7a6', '#c38323', '#9a9725', '#9f7ed6', '#c371b0', '#04a4ba',
]

/** Il grigio della categoria "Altro": la stessa luminosità, senza tinta. */
export const OTHER_COLOR = '#8c939b'

/** I nomi che ricevono il grigio quando si riarmonizza o si creano i valori iniziali. */
const OTHER_NAMES = new Set(['altro', 'altri', 'other', 'others'])

export function isOtherName(name: string): boolean {
  return OTHER_NAMES.has(name.trim().toLocaleLowerCase())
}

// --- conversioni ---------------------------------------------------------------------------------------------

function toLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function fromLinear(c: number) {
  const v = Math.min(1, Math.max(0, c))
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
}

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** Da esadecimale a OKLCH: [luminosità, croma, tinta in gradi]. */
export function hexToOklch(hex: string): [number, number, number] | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(toLinear) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const ll = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const hue = (Math.atan2(bb, a) * 180) / Math.PI
  return [ll, Math.hypot(a, bb), (hue + 360) % 360]
}

function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

/** Da OKLCH a esadecimale; se il colore esce dallo schermo si riduce il croma finché ci sta. */
export function oklchToHex(l: number, c: number, h: number): string {
  let chroma = c
  let rgb = oklchToLinear(l, chroma, h)
  while (chroma > 0 && rgb.some((v) => v < -1e-4 || v > 1 + 1e-4)) {
    chroma = Math.max(0, chroma - 0.002)
    rgb = oklchToLinear(l, chroma, h)
  }
  return `#${rgb.map((v) => Math.round(fromLinear(v) * 255).toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map(toLinear) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapporto di contrasto WCAG tra due colori esadecimali. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// --- scelta dei colori ---------------------------------------------------------------------------------------

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/** Le tinte dei colori già usati (i grigi non contano: non occupano nessuna tinta). */
function usedHues(existing: string[]): number[] {
  return existing.flatMap((c) => {
    const o = hexToOklch(c)
    return o && o[1] > 0.04 ? [o[2]] : []
  })
}

/** Quanto una tinta è lontana dalla più vicina tra quelle usate. */
function spread(hue: number, used: number[]) {
  return used.length ? Math.min(...used.map((u) => hueDistance(hue, u))) : 360
}

/** Tutte le tinte ammesse a passi di 5 gradi, per quando la tavolozza è finita. */
const HUE_STEPS = HUE_RANGES.flatMap(([from, to]) => Array.from({ length: Math.floor((to - from) / 5) + 1 }, (_, i) => from + i * 5))

/**
 * Il colore per una voce nuova: la tinta più lontana da quelle già usate. Prima tra le 12 della tavolozza; quando
 * sono tutte prese, tra tutte le tinte ammesse, sempre con la stessa luminosità e la stessa intensità.
 */
export function pickUniqueColor(existing: string[]): string {
  const taken = new Set(existing.map((c) => c.toLowerCase()))
  const used = usedHues(existing)
  const free = PALETTE.filter((c) => !taken.has(c))
  if (free.length) {
    // A pari distanza vince quella che viene prima nella tavolozza (già ordinata per distanza).
    return free.reduce((best, c) => (spread(hexToOklch(c)![2], used) > spread(hexToOklch(best)![2], used) + 0.5 ? c : best))
  }
  const hue = HUE_STEPS.reduce((best, h) => (spread(h, used) > spread(best, used) ? h : best))
  return oklchToHex(L, C, hue)
}

/** Colore casuale tra le tinte ammesse, con la stessa luminosità e intensità; diverso da quelli esistenti. */
export function randomUniqueColor(existing: string[], random: () => number = Math.random): string {
  const taken = new Set(existing.map((c) => c.toLowerCase()))
  let color = ''
  for (let attempt = 0; attempt < 100; attempt++) {
    color = oklchToHex(L, C, HUE_STEPS[Math.floor(random() * HUE_STEPS.length)]! + random() * 4)
    if (!taken.has(color)) break
  }
  return color
}

/**
 * Colori nuovi e in equilibrio per un elenco di nomi, nell'ordine: ognuno prende la tinta più lontana da quelle già
 * date (anche a quelle in `alreadyGiven`), "Altro" prende il grigio.
 */
export function harmonizedColors(names: string[], alreadyGiven: string[] = []): string[] {
  const given = [...alreadyGiven]
  return names.map((name) => {
    const color = isOtherName(name) ? OTHER_COLOR : pickUniqueColor(given)
    given.push(color)
    return color
  })
}

// --- testo sopra il colore -----------------------------------------------------------------------------------

const DARK_TEXT = '#0f172a'
const LIGHT_TEXT = '#ffffff'

/** Colore del testo (bianco o scuro) leggibile sopra lo sfondo indicato: quello con più contrasto. */
export function readableTextColor(background: string): string {
  if (!parseHex(background)) return LIGHT_TEXT
  return contrast(background, DARK_TEXT) >= contrast(background, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
}

/**
 * Fondo e testo di un'etichetta colorata, sempre leggibili (almeno 4,5:1). I colori della tavolozza passano così come
 * sono; un colore scelto a mano che non regge né il bianco né lo scuro (le tinte medie) si schiarisce quanto basta,
 * tenendo la sua tinta, e prende il testo scuro.
 */
export function badgeColors(color: string): { background: string; color: string } {
  if (!parseHex(color)) return { background: OTHER_COLOR, color: DARK_TEXT }
  const text = readableTextColor(color)
  if (contrast(color, text) >= 4.5) return { background: color, color: text }
  const [l, c, h] = hexToOklch(color)!
  for (let lighter = l; lighter <= 1; lighter += 0.01) {
    const bg = oklchToHex(lighter, c, h)
    if (contrast(bg, DARK_TEXT) >= 4.5) return { background: bg, color: DARK_TEXT }
  }
  return { background: '#ffffff', color: DARK_TEXT }
}
