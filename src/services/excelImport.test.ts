import { describe, expect, it } from 'vitest'
import { uuidv5 } from '@/utils/uuidv5'
import { convertWorkbook, NotExpenseTrackerError, readExcelFile } from './excelImport'
import { parseBackup } from './migration'
import { readWorkbook } from './xlsx/workbook'
import { openZip, XlsxFormatError } from './xlsx/zip'

// --- costruzione di file .xlsx minimi -------------------------------------

function crc32(data: Uint8Array): number {
  let c = ~0
  for (const b of data) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Zip con i file indicati; `stored` = senza compressione, per provare tutti e due i metodi. */
async function zip(files: Record<string, string>, stored = false): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name)
    const raw = enc.encode(content)
    const data = stored ? raw : await deflateRaw(raw)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, stored ? 0 : 8, true)
    lv.setUint32(14, crc32(raw), true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, stored ? 0 : 8, true)
    cv.setUint32(16, crc32(raw), true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, centrals.length, true)
  ev.setUint16(10, centrals.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const parts = [...locals, ...centrals, eocd]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
const REL_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

/** Cartella di lavoro con i fogli indicati (XML del contenuto di `<sheetData>`). */
function xlsx(
  sheets: Record<string, string>,
  opts: { sharedStrings?: string[]; date1904?: boolean; stored?: boolean; prefix?: string } = {},
): Promise<Uint8Array> {
  const p = opts.prefix ? `${opts.prefix}:` : ''
  const ns = opts.prefix ? NS.replace('xmlns=', `xmlns:${opts.prefix}=`) : NS
  const names = Object.keys(sheets)
  const files: Record<string, string> = {
    '_rels/.rels': `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<${p}workbook ${ns} ${REL_NS}>${opts.date1904 ? `<${p}workbookPr date1904="1"/>` : ''}<${p}sheets>${names
      .map((n, i) => `<${p}sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</${p}sheets></${p}workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships>${names
      .map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rS" Target="styles.xml"/><Relationship Id="rSS" Target="/xl/sharedStrings.xml"/></Relationships>`,
    // Stile 0 = generico, 1 = data predefinita (14), 2 = data personalizzata, 3 = numero con valuta
    'xl/styles.xml': `<styleSheet ${NS}><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/><numFmt numFmtId="165" formatCode="[$€-410]\\ #,##0.00"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>`,
    'xl/sharedStrings.xml': `<sst ${NS}>${(opts.sharedStrings ?? []).map((s) => `<si>${s}</si>`).join('')}</sst>`,
  }
  names.forEach((n, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<${p}worksheet ${ns}><${p}sheetData>${sheets[n]}</${p}sheetData></${p}worksheet>`
  })
  return zip(files, opts.stored)
}

const str = (ref: string, text: string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`
const num = (ref: string, n: number, style = 0) => `<c r="${ref}" s="${style}"><v>${n}</v></c>`
const row = (n: number, cells: string) => `<row r="${n}">${cells}</row>`

const ONE_TIME_HEADER = row(
  2,
  ['Nome', 'Importo (€)', 'Data', 'Mese', 'Categoria', 'Metodo Pagamento', 'Note', 'Tag']
    .map((h, i) => str(`${String.fromCharCode(65 + i)}2`, h))
    .join(''),
)

// --- test -----------------------------------------------------------------

describe('uuidv5', () => {
  it('coincide con il vettore di riferimento RFC / Python', () => {
    expect(uuidv5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d')
  })

  it('dà gli stessi ID dello script Python, anche con caratteri accentati', () => {
    expect(uuidv5('cat:caffè', '7b38d648-52e6-4277-bf30-4e4b52df33ce')).toBe('0f77cfd9-cb03-5bd6-9378-b07c53cda0ef')
  })
})

describe('readWorkbook', () => {
  it('legge stringhe condivise, testo formattato, entità, formule e numeri', async () => {
    const wb = await readWorkbook(await xlsx(
        {
          Foglio: row(
            1,
            '<c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>' +
              '<c r="C1"><f>1+1</f><v>2</v></c><c r="D1" t="str"><f>A1&amp;""</f><v>Caffè &amp; co</v></c>' +
              '<c r="E1" t="b"><v>1</v></c><c r="G1" s="3"><v>12.5</v></c>',
          ),
        },
        {
          sharedStrings: [
            '<t xml:space="preserve"> Ciao &lt;mondo&gt; </t>',
            '<r><rPr><b/></rPr><t>Ric</t></r><r><t>co</t></r><rPh><t>ふりがな</t></rPh><t>_x000D_</t>',
          ],
        },
      ),
    )
    const cells = wb.sheets[0]!.rows.get(1)!
    expect(cells[0]).toBe(' Ciao <mondo> ')
    expect(cells[1]).toBe('Ricco\r')
    expect(cells[2]).toBe(2)
    expect(cells[3]).toBe('Caffè & co')
    expect(cells[4]).toBe(true)
    expect(cells[5]).toBeUndefined()
    expect(cells[6]).toBe(12.5) // formato valuta: resta un numero
  })

  it('converte le celle con formato data, anche nel sistema 1904', async () => {
    const sheet = row(1, num('A1', 46087, 1) + num('B1', 46087.75, 2) + num('C1', 59, 1) + num('D1', 61, 1))
    const wb = await readWorkbook(await xlsx({ S: sheet }))
    expect(wb.sheets[0]!.rows.get(1)).toEqual([
      { date: '2026-03-06' },
      { date: '2026-03-06' },
      { date: '1900-02-28' },
      { date: '1900-03-01' },
    ])
    const wb1904 = await readWorkbook(await xlsx({ S: row(1, num('A1', 0, 1)) }, { date1904: true }))
    expect(wb1904.sheets[0]!.rows.get(1)).toEqual([{ date: '1904-01-01' }])
  })

  it('accetta file senza compressione, con prefissi di namespace e senza riferimenti di cella', async () => {
    const sheet = '<x:row><x:c t="inlineStr"><x:is><x:t>A</x:t></x:is></x:c><x:c><x:v>3</x:v></x:c></x:row>'
    const wb = await readWorkbook(await xlsx({ Uno: sheet }, { stored: true, prefix: 'x' }))
    expect(wb.sheets[0]!.name).toBe('Uno')
    expect(wb.sheets[0]!.rows.get(1)).toEqual(['A', 3])
  })

  it('rifiuta un file che non è uno zip', async () => {
    await expect(readWorkbook(new TextEncoder().encode('{"schemaVersion":2}'))).rejects.toBeInstanceOf(XlsxFormatError)
    expect(() => openZip(new Uint8Array(10))).toThrow(XlsxFormatError)
  })
})

describe('convertWorkbook', () => {
  it('converte le spese una tantum e tiene distinte due voci identiche', async () => {
    const sheet =
      ONE_TIME_HEADER +
      row(3, str('A3', 'Caffè') + num('B3', 1.2) + num('C3', 46086, 1) + str('E3', 'Cibo') + str('F3', 'Carta')) +
      row(4, str('A4', 'Caffè') + num('B4', 1.2) + num('C4', 46086, 1) + str('E4', 'cibo') + str('F4', 'Carta')) +
      row(5, str('A5', 'Spesa') + `<c r="B5"><f>B3*10</f><v>12</v></c>` + str('D5', 'October 2026') + str('H5', 'casa')) +
      row(6, str('A6', 'TOTALE') + num('B6', 14.4)) +
      row(7, str('A7', 'Dopo') + num('B7', 1) + str('C7', '2026-01-01'))
    const res = convertWorkbook(await readWorkbook(await xlsx({ 'One-time': sheet })))

    expect(res.data.oneTimeExpenses.map((e) => [e.name, e.amount, e.date])).toEqual([
      ['Caffè', 120, '2026-03-05'],
      ['Caffè', 120, '2026-03-05'],
      ['Spesa', 1200, '2026-10-01'],
    ])
    const [a, b] = res.data.oneTimeExpenses
    expect(a!.id).not.toBe(b!.id)
    // Categorie senza distinzione di maiuscole; "Other" per quelle mancanti
    expect(res.data.categories.map((c) => c.name)).toEqual(['Cibo', 'Other'])
    expect(res.warnings.map((w) => w.code)).toEqual(['dateFromMonth', 'tagIgnored'])
    expect(parseBackup(JSON.parse(JSON.stringify(res.data)))).toEqual(res.data)
  })

  it('a ogni importazione dello stesso file dà gli stessi ID', async () => {
    const file = await xlsx({ 'One-time': ONE_TIME_HEADER + row(3, str('A3', 'Pane') + num('B3', 2) + str('C3', '2026-02-02')) })
    const first = convertWorkbook(await readWorkbook(file))
    const second = convertWorkbook(await readWorkbook(file))
    expect(second.data).toEqual(first.data)
  })

  it('usa il giorno scelto quando c\'è solo il mese, senza superare la fine del mese', async () => {
    const file = await xlsx({ 'One-time': ONE_TIME_HEADER + row(3, str('A3', 'X') + num('B3', 1) + str('D3', 'February 2026')) })
    const res = convertWorkbook(await readWorkbook(file), 31)
    expect(res.data.oneTimeExpenses[0]!.date).toBe('2026-02-28')
  })

  it('converte le ricorrenze con data di fine dedotta dai mesi', async () => {
    const header = row(
      2,
      ['Nome', 'Importo (€)', 'Frequenza', 'Data Inizio', 'Mese'].map((h, i) => str(`${String.fromCharCode(65 + i)}2`, h)).join(''),
    )
    const sheet =
      header +
      row(3, str('A3', 'Palestra') + num('B3', 40) + str('C3', 'Monthly') + str('E3', 'March 2026, January 2026')) +
      row(4, str('A4', 'Netflix') + num('B4', 12.99) + str('C4', 'monthly') + str('E4', 'January 2026, December 2026')) +
      row(5, str('A5', 'Pulizie') + num('B5', 20) + str('C5', 'Weekly') + num('D5', 46023, 1))
    const res = convertWorkbook(await readWorkbook(await xlsx({ Recurring: sheet })))
    expect(res.data.recurringExpenses.map((r) => [r.name, r.amount, r.startDate, r.endDate])).toEqual([
      ['Palestra', 4000, '2026-01-01', '2026-03-31'],
      ['Netflix', 1299, '2026-01-01', null],
    ])
    expect(res.warnings).toEqual([{ code: 'frequencyUnsupported', params: { row: 5, name: 'Pulizie', frequency: 'Weekly' } }])
  })

  it('rifiuta un file Excel che non è l\'Expense Tracker', async () => {
    const file = await xlsx({ Foglio1: row(1, str('A1', 'ciao')) })
    expect(() => convertWorkbook({ sheets: [] })).toThrow(NotExpenseTrackerError)
    await expect(readExcelFile(new Blob([file as BlobPart]))).rejects.toBeInstanceOf(NotExpenseTrackerError)
  })
})
