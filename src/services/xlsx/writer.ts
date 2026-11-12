/**
 * Generatore minimale di cartelle di lavoro Excel (.xlsx / OpenXML) in puro TypeScript.
 * Produce file conformi allo standard ECMA-376 con più fogli di lavoro (tabs),
 * formattazione di intestazione in grassetto, larghezza colonne automatica e numeri/valute.
 */
import { createZipArchive } from './zipWriter'

export type CellScalar = string | number | boolean | null | undefined

export interface SheetDefinition {
  name: string
  headers: string[]
  rows: CellScalar[][]
}

function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, '').trim()
  return cleaned.slice(0, 31) || 'Sheet'
}

function columnLetter(colIndex: number): string {
  let s = ''
  let num = colIndex
  while (num >= 0) {
    s = String.fromCharCode(65 + (num % 26)) + s
    num = Math.floor(num / 26) - 1
  }
  return s
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
const REL_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

/**
 * Genera il buffer binario di un file .xlsx contenente i fogli specificati.
 */
export async function buildXlsxWorkbook(sheets: SheetDefinition[]): Promise<Uint8Array> {
  const safeSheets = sheets.map((s, idx) => ({
    ...s,
    name: sanitizeSheetName(s.name) || `Foglio${idx + 1}`,
  }))

  const files: Record<string, string> = {}

  // 1. [Content_Types].xml
  files['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}
</Types>`

  // 2. _rels/.rels
  files['_rels/.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  // 3. xl/_rels/workbook.xml.rels
  files['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${safeSheets
    .map(
      (_, i) =>
        `<Relationship Id="rIdSheet${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')}
</Relationships>`

  // 4. xl/workbook.xml
  files['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${NS} ${REL_NS}>
  <sheets>
    ${safeSheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rIdSheet${i + 1}"/>`)
      .join('')}
  </sheets>
</workbook>`

  // 5. xl/styles.xml
  // Stili:
  // 0: Normale (font Calibri 11)
  // 1: Intestazione (grassetto, font Calibri 11)
  // 2: Valuta decimale (#,##0.00 €)
  // 3: Data (yyyy-mm-dd)
  files['xl/styles.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet ${NS}>
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/>
    <numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>
  </numFmts>
  <fonts count="2">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><b/><name val="Calibri"/><sz val="11"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`

  // 6. xl/worksheets/sheetN.xml
  safeSheets.forEach((sheet, sheetIdx) => {
    // Calcolo larghezza indicativa delle colonne
    const colWidths = sheet.headers.map((h, colIdx) => {
      let maxLen = h.length
      for (const row of sheet.rows) {
        const val = row[colIdx]
        if (val !== null && val !== undefined) {
          const str = String(val)
          if (str.length > maxLen) maxLen = str.length
        }
      }
      return Math.min(Math.max(maxLen + 3, 10), 45)
    })

    const colsXml = colWidths
      .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
      .join('')

    // Riga intestazione (row 1, style 1: grassetto)
    const headerCells = sheet.headers
      .map((h, colIdx) => {
        const ref = `${columnLetter(colIdx)}1`
        return `<c r="${ref}" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`
      })
      .join('')
    const headerRow = `<row r="1" spans="1:${sheet.headers.length}">${headerCells}</row>`

    // Righe dati (a partire da row 2)
    const dataRows = sheet.rows.map((row, rIdx) => {
      const rowNum = rIdx + 2
      const cells = row.map((cell, cIdx) => {
        const ref = `${columnLetter(cIdx)}${rowNum}`
        if (cell === null || cell === undefined || cell === '') {
          return `<c r="${ref}"/>`
        }
        if (typeof cell === 'number') {
          // I numeri monetari o decimali usano lo stile valuta (s="2")
          return `<c r="${ref}" s="2"><v>${cell}</v></c>`
        }
        if (typeof cell === 'boolean') {
          return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`
        }
        const strVal = String(cell)
        // Se è una data ISO (YYYY-MM-DD), usiamo inlineStr o stile data
        return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(strVal)}</t></is></c>`
      })
      return `<row r="${rowNum}" spans="1:${sheet.headers.length}">${cells.join('')}</row>`
    })

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${NS}>
  <cols>${colsXml}</cols>
  <sheetData>
    ${headerRow}
    ${dataRows.join('')}
  </sheetData>
</worksheet>`

    files[`xl/worksheets/sheet${sheetIdx + 1}.xml`] = sheetXml
  })

  return createZipArchive(files, true)
}
