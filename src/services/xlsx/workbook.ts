/**
 * Legge i valori delle celle di un file .xlsx (Office Open XML), come fa openpyxl con `data_only=True`:
 * per le formule si usa l'ultimo risultato salvato da Excel, e le celle con formato data diventano date.
 * Non serve un parser XML completo: i file prodotti da Excel, LibreOffice e Google Sheets hanno una
 * struttura regolare, quindi bastano poche espressioni regolari.
 */
import { openZip, XlsxFormatError, type ZipArchive } from './zip'

/** Una cella con formato data: `date` è la data di calendario (YYYY-MM-DD), l'eventuale ora viene scartata. */
export interface CellDate {
  date: string
}
export type CellValue = string | number | boolean | CellDate | null

export interface Sheet {
  name: string
  /** Righe numerate da 1 come in Excel; ogni riga è un array indicizzato per colonna (A = 0). */
  rows: Map<number, CellValue[]>
  maxRow: number
}

export interface Workbook {
  sheets: Sheet[]
}

export function isCellDate(v: CellValue): v is CellDate {
  return typeof v === 'object' && v !== null
}

// --- XML ------------------------------------------------------------------

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function decodeXml(s: string): string {
  return s
    .replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      return ENTITIES[e] ?? m
    })
    // Excel codifica alcuni caratteri di controllo come _x000D_
    .replace(/_x([0-9a-fA-F]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const key = m[1]!.includes(':') && !m[1]!.startsWith('r:') ? m[1]!.split(':')[1]! : m[1]!
    out[key] = decodeXml(m[2] ?? m[3] ?? '')
  }
  return out
}

/** Elementi `<name …>…</name>` o `<name …/>`, con o senza prefisso di namespace (es. `x:row`). */
function* elements(xml: string, name: string): Generator<{ attrs: Record<string, string>; inner: string }> {
  const re = new RegExp(`<(?:\\w+:)?${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${name}>)`, 'g')
  for (const m of xml.matchAll(re)) yield { attrs: attrs(m[1]!), inner: m[2] ?? '' }
}

/** Testo di un elemento con testo formattato: concatena tutti i `<t>`, escluse le letture fonetiche. */
function richText(inner: string): string {
  const clean = inner.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')
  let text = ''
  for (const t of elements(clean, 't')) text += decodeXml(t.inner)
  return text
}

// --- date -----------------------------------------------------------------

/** Formati data predefiniti di Excel (gli stessi che riconosce openpyxl). */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

function isDateFormatCode(code: string): boolean {
  const stripped = code
    .replace(/"[^"]*"/g, '') // testo tra virgolette
    .replace(/\[[^\]]*\]/g, '') // colori, valute, condizioni
    .replace(/\\./g, '') // caratteri con escape
    .replace(/_.|\*./g, '') // spaziature
  return /[dmyhs]/i.test(stripped)
}

function serialToIso(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial)) return null
  let days = Math.floor(serial)
  // Excel considera il 1900 bisestile: il giorno 60 (29/02/1900) non esiste.
  if (!date1904 && days < 60) days += 1
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const d = new Date(base + days * 86_400_000)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// --- lettura ---------------------------------------------------------------

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? ''
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function resolveTarget(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

async function text(zip: ZipArchive, name: string): Promise<string> {
  return new TextDecoder().decode(await zip.read(name))
}

async function relationships(zip: ZipArchive, part: string): Promise<Map<string, string>> {
  const dir = part.split('/').slice(0, -1).join('/')
  const file = part.split('/').pop()!
  const relsPath = `${dir ? dir + '/' : ''}_rels/${file}.rels`
  const out = new Map<string, string>()
  if (!zip.has(relsPath)) return out
  for (const r of elements(await text(zip, relsPath), 'Relationship')) {
    if (r.attrs.Id && r.attrs.Target && r.attrs.TargetMode !== 'External') {
      out.set(r.attrs.Id, resolveTarget(part, r.attrs.Target))
    }
  }
  return out
}

function parseSheet(
  name: string,
  xml: string,
  sharedStrings: string[],
  dateStyles: Set<number>,
  date1904: boolean,
): Sheet {
  const rows = new Map<number, CellValue[]>()
  let maxRow = 0
  let nextRow = 1
  const data = /<(?:\w+:)?sheetData\b[^>]*>([\s\S]*)<\/(?:\w+:)?sheetData>/.exec(xml)?.[1] ?? ''
  for (const row of elements(data, 'row')) {
    const rowNumber = row.attrs.r ? parseInt(row.attrs.r, 10) : nextRow
    nextRow = rowNumber + 1
    const cells: CellValue[] = []
    let nextCol = 0
    for (const c of elements(row.inner, 'c')) {
      const col = c.attrs.r ? columnIndex(c.attrs.r) : nextCol
      nextCol = col + 1
      const type = c.attrs.t ?? 'n'
      const raw = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(c.inner)?.[1]
      let value: CellValue = null
      if (type === 'inlineStr') {
        const is = /<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/.exec(c.inner)?.[1]
        value = is === undefined ? null : richText(is)
      } else if (raw !== undefined) {
        const v = decodeXml(raw)
        if (type === 's') value = sharedStrings[parseInt(v, 10)] ?? null
        else if (type === 'str' || type === 'e') value = v
        else if (type === 'b') value = v === '1' || v.toLowerCase() === 'true'
        else if (type === 'd') value = /^\d{4}-\d{2}-\d{2}/.test(v) ? { date: v.slice(0, 10) } : v
        else {
          const n = Number(v)
          if (Number.isNaN(n)) value = v
          else if (dateStyles.has(parseInt(c.attrs.s ?? '0', 10))) {
            const iso = serialToIso(n, date1904)
            value = iso ? { date: iso } : n
          } else value = n
        }
      }
      if (value !== null) cells[col] = value
    }
    if (cells.length) {
      rows.set(rowNumber, cells)
      maxRow = Math.max(maxRow, rowNumber)
    }
  }
  return { name, rows, maxRow }
}

export async function readWorkbook(bytes: Uint8Array): Promise<Workbook> {
  const zip = openZip(bytes)

  let workbookPath = 'xl/workbook.xml'
  if (zip.has('_rels/.rels')) {
    for (const r of elements(await text(zip, '_rels/.rels'), 'Relationship')) {
      if (r.attrs.Type?.endsWith('/officeDocument') && r.attrs.Target) workbookPath = resolveTarget('', r.attrs.Target)
    }
  }
  if (!zip.has(workbookPath)) throw new XlsxFormatError('manca il foglio di lavoro')

  const workbookXml = await text(zip, workbookPath)
  const wbRels = await relationships(zip, workbookPath)
  const pr = elements(workbookXml, 'workbookPr').next().value
  const date1904 = pr ? ['1', 'true'].includes((pr.attrs.date1904 ?? '').toLowerCase()) : false

  // Stringhe condivise e stili sono facoltativi.
  const relTargets = [...wbRels.values()]
  const sharedPath = relTargets.find((p) => /sharedStrings\.xml$/i.test(p))
  const sharedStrings: string[] = []
  if (sharedPath && zip.has(sharedPath)) {
    for (const si of elements(await text(zip, sharedPath), 'si')) sharedStrings.push(richText(si.inner))
  }

  const dateStyles = new Set<number>()
  const stylesPath = relTargets.find((p) => /styles\.xml$/i.test(p))
  if (stylesPath && zip.has(stylesPath)) {
    const xml = await text(zip, stylesPath)
    const customDate = new Set<number>()
    for (const f of elements(xml, 'numFmt')) {
      if (f.attrs.formatCode && isDateFormatCode(f.attrs.formatCode)) customDate.add(parseInt(f.attrs.numFmtId ?? '', 10))
    }
    const cellXfs = /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(xml)?.[1] ?? ''
    let i = 0
    for (const xf of elements(cellXfs, 'xf')) {
      const id = parseInt(xf.attrs.numFmtId ?? '0', 10)
      if (BUILTIN_DATE_FORMATS.has(id) || customDate.has(id)) dateStyles.add(i)
      i++
    }
  }

  const sheets: Sheet[] = []
  for (const s of elements(workbookXml, 'sheet')) {
    const path = wbRels.get(s.attrs['r:id'] ?? s.attrs.id ?? '')
    // I fogli grafico non hanno celle: si saltano, come fa openpyxl con `worksheets`.
    if (!path || !zip.has(path) || !/worksheets\//.test(path)) continue
    sheets.push(parseSheet(s.attrs.name ?? '', await text(zip, path), sharedStrings, dateStyles, date1904))
  }
  return { sheets }
}
