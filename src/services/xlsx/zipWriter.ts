/**
 * Scrittore minimo di archivi ZIP in puro TypeScript, senza dipendenze esterne.
 * Supporta sia la memorizzazione senza compressione (STORE) che la compressione DEFLATE
 * tramite il DecompressionStream/CompressionStream standard del browser/runtime.
 */

function crc32(data: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    return data
  }
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return data
  }
}

export interface ZipFileInput {
  name: string
  data: Uint8Array | string
}

/**
 * Crea un archivio ZIP binario valido contenente i file indicati.
 * Usa il flag UTF-8 (bit 11) per compatibilità universale su tutti i sistemi operativi.
 */
export async function createZipArchive(
  files: ZipFileInput[] | Record<string, Uint8Array | string>,
  stored = true,
): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const entries: ZipFileInput[] = Array.isArray(files)
    ? files
    : Object.entries(files).map(([name, data]) => ({ name, data }))

  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const raw = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data
    const isStored = stored || typeof CompressionStream === 'undefined'
    const compressed = isStored ? raw : await deflateRaw(raw)
    const method = isStored ? 0 : 8

    // Local file header (30 byte + nome + dati)
    const local = new Uint8Array(30 + nameBytes.length + compressed.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // Firma local file header
    lv.setUint16(4, 20, true) // Versione necessaria (2.0)
    lv.setUint16(6, 0x0800, true) // Bit 11: nome file codificato in UTF-8
    lv.setUint16(8, method, true) // Metodo compressione (0=STORE, 8=DEFLATE)
    lv.setUint16(10, 0, true) // Orario modifica
    lv.setUint16(12, 0x5221, true) // Data modifica fissa (2021)
    lv.setUint32(14, crc32(raw), true) // CRC32 dei dati non compressi
    lv.setUint32(18, compressed.length, true) // Dimensione compressa
    lv.setUint32(22, raw.length, true) // Dimensione decompressa
    lv.setUint16(26, nameBytes.length, true) // Lunghezza nome
    lv.setUint16(28, 0, true) // Lunghezza campo extra
    local.set(nameBytes, 30)
    local.set(compressed, 30 + nameBytes.length)

    // Central directory header (46 byte + nome)
    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true) // Firma central directory
    cv.setUint16(4, 20, true) // Versione creata da
    cv.setUint16(6, 20, true) // Versione necessaria
    cv.setUint16(8, 0x0800, true) // Bit 11: UTF-8
    cv.setUint16(10, method, true) // Metodo compressione
    cv.setUint16(12, 0, true) // Orario
    cv.setUint16(14, 0x5221, true) // Data
    cv.setUint32(16, crc32(raw), true) // CRC32
    cv.setUint32(20, compressed.length, true) // Dimensione compressa
    cv.setUint32(24, raw.length, true) // Dimensione non compressa
    cv.setUint16(28, nameBytes.length, true) // Lunghezza nome
    cv.setUint16(30, 0, true) // Campo extra
    cv.setUint16(32, 0, true) // Commento
    cv.setUint16(34, 0, true) // Numero disco
    cv.setUint16(36, 0, true) // Attributi interni
    cv.setUint32(38, 0, true) // Attributi esterni
    cv.setUint32(42, offset, true) // Offset relativo del local header
    central.set(nameBytes, 46)

    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const cdSize = centrals.reduce((n, c) => n + c.length, 0)
  // End of Central Directory Record (22 byte)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true) // Firma EOCD
  ev.setUint16(4, 0, true) // Numero disco corrente
  ev.setUint16(6, 0, true) // Disco inizio directory centrale
  ev.setUint16(8, centrals.length, true) // Numero di record in questo disco
  ev.setUint16(10, centrals.length, true) // Totale record directory centrale
  ev.setUint32(12, cdSize, true) // Dimensione directory centrale
  ev.setUint32(16, offset, true) // Offset inizio directory centrale
  ev.setUint16(20, 0, true) // Lunghezza commento

  const parts = [...locals, ...centrals, eocd]
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(totalLength)
  let pos = 0
  for (const part of parts) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}
