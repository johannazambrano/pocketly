#!/usr/bin/env node
/**
 * Avvia Python in modo portabile, passando gli argomenti così come sono: prova `python3` (Linux, macOS), poi `python`,
 * poi il lanciatore di Windows `py -3`. Serve a `npm run test:server`, che con `python3` scritto a mano su Windows
 * fallisce ("Python non è stato trovato").
 *
 * Uso: node scripts/python.mjs -m unittest server.test_main
 */
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const candidates = [
  ['python3', []],
  ['python', []],
  ['py', ['-3']],
]

/** Un candidato vale se esiste e risponde come Python 3 (su Windows `python3` può essere un alias dello Store che non fa niente). */
function works(cmd, prefix) {
  const probe = spawnSync(cmd, [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)'], {
    stdio: 'ignore',
  })
  return probe.status === 0
}

const found = candidates.find(([cmd, prefix]) => works(cmd, prefix))
if (!found) {
  console.error('Python 3 non trovato: installalo (python3, python oppure, su Windows, il lanciatore py).')
  process.exit(1)
}

const [cmd, prefix] = found
const run = spawnSync(cmd, [...prefix, ...args], { stdio: 'inherit' })
process.exit(run.status ?? 1)
