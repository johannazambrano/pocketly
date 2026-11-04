/**
 * Lettore minimo di archivi ZIP, quanto basta per i file .xlsx.
 * Usa il DecompressionStream del browser, così non serve una libreria esterna.
 */

export class XlsxFormatError extends Error {
  constructor(reason: string) {
    super(`File Excel non valido: ${reason}`)
    this.name = 'XlsxFormatError'
  }
}

/** Il browser non sa decomprimere i file (versioni molto vecchie). */
export class XlsxUnsupportedError extends Error {
  constructor() {
    super('Il browser non supporta la lettura dei file Excel')
    this.name = 'XlsxUnsupportedError'
  }
}

/** Limite per singolo file interno: un foglio di spese non arriva mai a tanto, uno zip malevolo sì. */
const MAX_ENTRY_SIZE = 64 * 1024 * 1024

interface Entry {
  method: number
  compressedSize: number
  size: number
  localOffset: number
}

export interface ZipArchive {
  has(name: string): boolean
  read(name: string): Promise<Uint8Array>
}

async function inflateRaw(data: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new XlsxUnsupportedError()
  let stream: DecompressionStream
  try {
    stream = new DecompressionStream('deflate-raw')
  } catch {
    throw new XlsxUnsupportedError()
  }
  const reader = new Blob([data as BlobPart]).stream().pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > Math.max(expectedSize, 0) + 1024 || total > MAX_ENTRY_SIZE) {
      await reader.cancel()
      throw new XlsxFormatError('dimensione dei dati non coerente')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) {
    out.set(c, pos)
    pos += c.length
  }
  return out
}

export function openZip(bytes: Uint8Array): ZipArchive {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (o: number) => view.getUint16(o, true)
  const u32 = (o: number) => view.getUint32(o, true)

  // Il "record di fine directory" sta negli ultimi 22 byte più un eventuale commento (max 64 KB).
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (u32(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new XlsxFormatError('non è un archivio zip')

  const count = u16(eocd + 10)
  let p = u32(eocd + 16)
  const decoder = new TextDecoder()
  const entries = new Map<string, Entry>()
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || u32(p) !== 0x02014b50) throw new XlsxFormatError('indice dello zip danneggiato')
    const nameLength = u16(p + 28)
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength))
    entries.set(name, {
      method: u16(p + 10),
      compressedSize: u32(p + 20),
      size: u32(p + 24),
      localOffset: u32(p + 42),
    })
    p += 46 + nameLength + u16(p + 30) + u16(p + 32)
  }

  return {
    has: (name) => entries.has(name),
    async read(name) {
      const e = entries.get(name)
      if (!e) throw new XlsxFormatError(`manca ${name}`)
      if (e.size > MAX_ENTRY_SIZE) throw new XlsxFormatError(`${name} troppo grande`)
      const o = e.localOffset
      if (o + 30 > bytes.length || u32(o) !== 0x04034b50) throw new XlsxFormatError(`${name} danneggiato`)
      const start = o + 30 + u16(o + 26) + u16(o + 28)
      const data = bytes.subarray(start, start + e.compressedSize)
      if (data.length !== e.compressedSize) throw new XlsxFormatError(`${name} troncato`)
      if (e.method === 0) return data
      if (e.method === 8) return inflateRaw(data, e.size)
      throw new XlsxFormatError(`compressione ${e.method} non supportata`)
    },
  }
}
