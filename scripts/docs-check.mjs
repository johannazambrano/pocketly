#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

let errors = 0

function logError(msg) {
  console.error(`❌ [docs:check] ${msg}`)
  errors++
}

function logSuccess(msg) {
  console.log(`✅ [docs:check] ${msg}`)
}

// --------------------------------------------------------------------------
// 1. Verifica che ogni file in src/, server/ e scripts/ sia presente nella mappa del codice
// --------------------------------------------------------------------------
function checkCodeMap() {
  const mapPath = path.join(ROOT, 'docs', 'riferimento', 'mappa-codice.md')
  if (!fs.existsSync(mapPath)) {
    logError(`Mappa del codice non trovata in: ${mapPath}`)
    return
  }
  const mapContent = fs.readFileSync(mapPath, 'utf-8')

  function getFiles(dir, exts = ['.ts', '.vue', '.css', '.py']) {
    let results = []
    const list = fs.readdirSync(dir)
    for (const file of list) {
      if (file === '__pycache__' || file === 'node_modules' || file.startsWith('.')) continue
      const full = path.join(dir, file)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        results = results.concat(getFiles(full, exts))
      } else {
        const ext = path.extname(file)
        if (exts.includes(ext)) {
          results.push(path.relative(ROOT, full).replace(/\\/g, '/'))
        }
      }
    }
    return results
  }

  const srcFiles = getFiles(path.join(ROOT, 'src'))
  const serverFiles = getFiles(path.join(ROOT, 'server'))
  const scriptsFiles = getFiles(path.join(ROOT, 'scripts'), ['.py', '.mjs', '.js'])
  const rootAndPublicFiles = [
    'public/push-worker.js',
    'index.html',
    'vite.config.ts',
    'pwa-assets.config.ts',
  ]
  const allExpected = [...srcFiles, ...serverFiles, ...scriptsFiles, ...rootAndPublicFiles]

  let missing = []
  for (const f of allExpected) {
    if (!mapContent.includes(f)) {
      missing.push(f)
    }
  }

  if (missing.length > 0) {
    logError(`I seguenti file non compaiono in docs/riferimento/mappa-codice.md:\n   - ${missing.join('\n   - ')}`)
  } else {
    logSuccess(`Tutti i ${allExpected.length} file di codice sorgente, worker e configurazione sono censiti nella mappa del codice.`)
  }
}

// --------------------------------------------------------------------------
// 2. Verifica link relativi nei file Markdown
// --------------------------------------------------------------------------
function checkMarkdownLinks() {
  function findMdFiles(dir) {
    let results = []
    const list = fs.readdirSync(dir)
    for (const file of list) {
      if (file === 'node_modules' || file === 'dist' || file === 'archivio' || file.startsWith('.')) continue
      const full = path.join(dir, file)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        results = results.concat(findMdFiles(full))
      } else if (file.endsWith('.md')) {
        results.push(full)
      }
    }
    return results
  }

  const mdFiles = [
    ...findMdFiles(path.join(ROOT, 'docs')),
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'AGENTS.md'),
    path.join(ROOT, 'CLAUDE.md'),
    path.join(ROOT, 'GEMINI.md'),
    path.join(ROOT, 'deploy', 'proxmox', 'README.md'),
  ].filter(f => fs.existsSync(f))

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let checkedCount = 0

  for (const mdPath of mdFiles) {
    const content = fs.readFileSync(mdPath, 'utf-8')
    let match
    while ((match = linkRegex.exec(content)) !== null) {
      const rawTarget = match[2].trim()
      // Ignora ancore pure (#anchor), protocolli web (http://, https://, mailto:)
      if (rawTarget.startsWith('#') || rawTarget.startsWith('http://') || rawTarget.startsWith('https://') || rawTarget.startsWith('mailto:')) {
        continue
      }

      // Rifiuta link non portabili con schema file://
      if (rawTarget.startsWith('file://')) {
        logError(`Link non portabile con schema 'file://' in ${path.relative(ROOT, mdPath)}: "${rawTarget}". Tutti i link devono essere relativi per funzionare su qualsiasi clone e su GitHub.`)
        continue
      }

      checkedCount++
      const cleanTarget = rawTarget.split('#')[0]
      const resolved = path.resolve(path.dirname(mdPath), cleanTarget)
      if (!fs.existsSync(resolved)) {
        logError(`Link relativo rotto in ${path.relative(ROOT, mdPath)}: ${rawTarget} -> ${resolved}`)
      }
    }
  }

  logSuccess(`Verificati ${checkedCount} link interni nei documenti Markdown.`)
}

// --------------------------------------------------------------------------
// 3. Verifica allineamento chiavi i18n tra it.ts ed en.ts
// --------------------------------------------------------------------------
async function checkI18n() {
  try {
    const itModule = await import(pathToFileURL(path.join(ROOT, 'src', 'i18n', 'it.ts')).href)
    const enModule = await import(pathToFileURL(path.join(ROOT, 'src', 'i18n', 'en.ts')).href)

    function getKeys(obj, prefix = '') {
      let keys = []
      for (const k of Object.keys(obj)) {
        const p = prefix ? `${prefix}.${k}` : k
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          keys = keys.concat(getKeys(obj[k], p))
        } else {
          keys.push(p)
        }
      }
      return keys
    }

    const itKeys = new Set(getKeys(itModule.default))
    const enKeys = new Set(getKeys(enModule.default))

    const missingInEn = [...itKeys].filter(k => !enKeys.has(k))
    const missingInIt = [...enKeys].filter(k => !itKeys.has(k))

    if (missingInEn.length > 0) {
      logError(`Chiavi presenti in it.ts ma mancanti in en.ts: ${missingInEn.join(', ')}`)
    }
    if (missingInIt.length > 0) {
      logError(`Chiavi presenti in en.ts ma mancanti in it.ts: ${missingInIt.join(', ')}`)
    }

    if (missingInEn.length === 0 && missingInIt.length === 0) {
      logSuccess(`Tutte le ${itKeys.size} chiavi di localizzazione tra it.ts ed en.ts sono perfettamente allineate.`)
    }
  } catch (err) {
    logError(`Errore durante il controllo i18n: ${err.message}`)
  }
}

// --------------------------------------------------------------------------
// 4. Verifica che i file elencati in `source-files:` nei front-matter di docs/ esistano
// --------------------------------------------------------------------------
function findDocsMarkdown(dir) {
  let results = []
  for (const file of fs.readdirSync(dir)) {
    if (file === 'archivio' || file.startsWith('.')) continue
    const full = path.join(dir, file)
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(findDocsMarkdown(full))
    } else if (file.endsWith('.md')) {
      results.push(full)
    }
  }
  return results
}

/** Percorsi elencati in `source-files:` nel front-matter iniziale (`---` … `---`); [] se non c'è. */
function parseSourceFiles(content) {
  const lines = content.split(/\r?\n/)
  if (lines[0] !== '---') return []
  const paths = []
  let inList = false
  for (let i = 1; i < lines.length && lines[i] !== '---'; i++) {
    const line = lines[i]
    if (/^source-files:/.test(line)) {
      inList = true
      continue
    }
    if (!inList) continue
    const item = line.match(/^\s+-\s+(.+?)\s*$/)
    if (item) paths.push(item[1].replace(/^['"]|['"]$/g, ''))
    else inList = false
  }
  return paths
}

function checkFrontMatterSourceFiles() {
  const mdFiles = findDocsMarkdown(path.join(ROOT, 'docs'))
  let checkedCount = 0
  for (const mdPath of mdFiles) {
    for (const p of parseSourceFiles(fs.readFileSync(mdPath, 'utf-8'))) {
      checkedCount++
      if (!fs.existsSync(path.join(ROOT, p))) {
        logError(`In ${path.relative(ROOT, mdPath).replace(/\\/g, '/')} il front-matter cita un file che non esiste: source-files → ${p}`)
      }
    }
  }
  logSuccess(`Verificati ${checkedCount} percorsi source-files in ${mdFiles.length} documenti di docs/.`)
}

// --------------------------------------------------------------------------
// 5. Invariante #8: niente colori fissi della palette Tailwind in src/ (solo gettoni semantici)
// --------------------------------------------------------------------------
const TAILWIND_PALETTE = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const COLOR_UTILITIES = [
  'text', 'bg', 'border', 'border-[trblxyse]', 'ring', 'ring-offset', 'outline', 'divide', 'fill', 'stroke',
  'from', 'via', 'to', 'shadow', 'accent', 'caret', 'decoration', 'placeholder',
]
/**
 * Una classe come `text-slate-700`, `hover:bg-emerald-50/80` o `border-t-rose-600`. `bg-black/60` e `bg-white`
 * restano ammessi: sono i veli dietro modali e menu, uguali in ogni tema.
 */
const FIXED_COLOR_CLASS = new RegExp(
  `(?<![\\w-])(?:${COLOR_UTILITIES.join('|')})-(?:${TAILWIND_PALETTE.join('|')})-(?:50|[1-9]00|950)(?![\\w-])`,
  'g',
)

function checkSemanticColorTokens() {
  function getFiles(dir) {
    let results = []
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file)
      if (fs.statSync(full).isDirectory()) results = results.concat(getFiles(full))
      else if (/\.(vue|ts)$/.test(file) && !/\.test\.ts$/.test(file)) results.push(full)
    }
    return results
  }

  const files = getFiles(path.join(ROOT, 'src'))
  let found = 0
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/)
    lines.forEach((line, i) => {
      for (const m of line.matchAll(FIXED_COLOR_CLASS)) {
        found++
        logError(`Colore fisso "${m[0]}" in ${path.relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}: usa un gettone semantico di src/style.css (Invariante #8).`)
      }
    })
  }
  if (found === 0) {
    logSuccess(`Nessun colore fisso della palette Tailwind nei ${files.length} file .vue e .ts di src/ (Invariante #8).`)
  }
}

async function run() {
  console.log('🔍 Avvio verifica documentazione e coerenza Pocketly...\n')
  checkCodeMap()
  checkMarkdownLinks()
  await checkI18n()
  checkFrontMatterSourceFiles()
  checkSemanticColorTokens()

  if (errors > 0) {
    console.error(`\n❌ Verifica fallita con ${errors} errore/i.`)
    process.exit(1)
  } else {
    console.log('\n🎉 Tutti i controlli sono stati superati con successo!')
  }
}

run()
