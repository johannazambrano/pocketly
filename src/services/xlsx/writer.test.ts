import { describe, expect, it } from 'vitest'
import { buildXlsxWorkbook, type SheetDefinition } from './writer'
import { createZipArchive } from './zipWriter'
import { openZip } from './zip'
import { readWorkbook } from './workbook'

describe('zipWriter', () => {
  it('crea un archivio zip valido leggibile da openZip', async () => {
    const files = {
      'documento.txt': 'Contenuto di prova UTF-8 con accenti: àèéìòù',
      'cartella/file.json': '{"chiave": 123}',
    }
    const archive = await createZipArchive(files, true)
    expect(archive.length).toBeGreaterThan(0)

    const zip = openZip(archive)
    expect(zip.has('documento.txt')).toBe(true)
    expect(zip.has('cartella/file.json')).toBe(true)
    expect(zip.has('inesistente.txt')).toBe(false)

    const textDec = new TextDecoder()
    const content = textDec.decode(await zip.read('documento.txt'))
    expect(content).toBe('Contenuto di prova UTF-8 con accenti: àèéìòù')
  })
})

describe('writer (.xlsx)', () => {
  it('genera un file .xlsx conforme a più fogli leggibile da readWorkbook', async () => {
    const sheets: SheetDefinition[] = [
      {
        name: 'Spese variabili',
        headers: ['Data', 'Nome', 'Importo (€)', 'Categoria', 'Metodo', 'Tag', 'Note'],
        rows: [
          ['2026-05-10', 'Spesa Esselunga', 45.5, 'Alimentari', 'Carta', '#casa', 'Sconto fragole'],
          ['2026-05-12', 'Caffè e cornetto', 2.8, 'Bar', 'Contanti', '', ''],
        ],
      },
      {
        name: 'Spese ricorrenti',
        headers: ['Nome', 'Importo (€)', 'Frequenza', 'Data inizio', 'Data fine', 'Categoria', 'Metodo'],
        rows: [['Affitto', 650.0, 'Mensile', '2024-01-01', '', 'Casa', 'Bonifico']],
      },
      {
        name: 'Entrate',
        headers: ['Data', 'Nome', 'Importo (€)', 'Categoria', 'Metodo', 'Tag', 'Note'],
        rows: [['2026-05-01', 'Stipendio', 1850.0, 'Lavoro', 'Bonifico', '', 'Mese precedente']],
      },
      {
        name: 'Prestiti',
        headers: ['Nome', 'Importo (€)', 'Tipo', 'Data', 'Rimborsato (€)', 'Residuo (€)', 'Stato', 'Note'],
        rows: [['Prestito Marco', 300.0, 'Dato', '2026-02-10', 100.0, 200.0, 'In corso', 'Rate']],
      },
    ]

    const bytes = await buildXlsxWorkbook(sheets)
    expect(bytes.length).toBeGreaterThan(0)

    // Verifica di lettura con il lettore interno dell'app
    const wb = await readWorkbook(bytes)
    expect(wb.sheets.length).toBe(4)

    const s1 = wb.sheets[0]!
    expect(s1.name).toBe('Spese variabili')
    expect(s1.maxRow).toBe(3) // 1 riga header + 2 righe dati
    expect(s1.rows.get(1)).toEqual(['Data', 'Nome', 'Importo (€)', 'Categoria', 'Metodo', 'Tag', 'Note'])
    expect(s1.rows.get(2)).toEqual(['2026-05-10', 'Spesa Esselunga', 45.5, 'Alimentari', 'Carta', '#casa', 'Sconto fragole'])

    const s2 = wb.sheets[1]!
    expect(s2.name).toBe('Spese ricorrenti')
    const r2 = s2.rows.get(2)!
    expect(r2[0]).toBe('Affitto')
    expect(r2[1]).toBe(650.0)
    expect(r2[2]).toBe('Mensile')
    expect(r2[3]).toBe('2024-01-01')
    expect(r2[5]).toBe('Casa')
    expect(r2[6]).toBe('Bonifico')

    const s3 = wb.sheets[2]!
    expect(s3.name).toBe('Entrate')
    const r3 = s3.rows.get(2)!
    expect(r3[0]).toBe('2026-05-01')
    expect(r3[1]).toBe('Stipendio')
    expect(r3[2]).toBe(1850.0)
    expect(r3[3]).toBe('Lavoro')
    expect(r3[4]).toBe('Bonifico')
    expect(r3[6]).toBe('Mese precedente')

    const s4 = wb.sheets[3]!
    expect(s4.name).toBe('Prestiti')
    expect(s4.rows.get(2)).toEqual(['Prestito Marco', 300.0, 'Dato', '2026-02-10', 100.0, 200.0, 'In corso', 'Rate'])
  })
})
