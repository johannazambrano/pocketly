---
source-files:
  - package.json
  - vitest.config.ts
  - tsconfig.json
  - server/test_main.py
  - scripts/docs-check.mjs
verified: 2026-11-10
---

# Guida: Test, Build e Release

Questa guida descrive le procedure di collaudo automatizzato, controllo dei tipi e rilascio di Pocketly.

---

## 1. Suite di Test Automatizzati

Pocketly dispone di una suite di test rigorosa che copre calcoli finanziari, crittografia, migrazioni, merge a 3 vie e l'intero server Python.

### Esecuzione Test Frontend (Vitest)
```bash
npm run test
```
Esegue i 170 test unitari in `src/` (calcoli, budget, ricorrenze, notifiche, crypto, sync engine, migrazioni, utils). Tutti i test devono passare senza warning.

### Controllo Statico dei Tipi (TypeScript)
```bash
npm run typecheck
```
Esegue `vue-tsc -b` su tutti i file `.vue` e `.ts`. Non devono esserci errori di tipo.

### Esecuzione Test Server Backend (Python unittest)
```bash
npm run test:server
# oppure: python3 -m unittest server.test_main
```
Esegue la suite di 21 test sul server `server/main.py` e `server/webpush.py`, verificando:
- Autenticazione Bearer e protezione da timing attack.
- Rate limiting antibruteforce (blocco 429 dopo 10 tentativi falliti).
- Concorrenza e lock ottimistico basato su ETag / `If-Match`.
- Persistenza atomica dei file (`write_atomic`).
- Validazione pacchetti Web Push `aes128gcm` e gestione risposte 410 dei gateway.

### Validazione della Documentazione e i18n
```bash
npm run docs:check
```
Esegue lo script di controllo `scripts/docs-check.mjs` che verifica:
- Assenza di link relativi markdown rotti in tutti i file di documentazione.
- Presenza di ogni file sorgente di `src/`, `server/` e `scripts/` nella [Mappa del Codice](../riferimento/mappa-codice.md).
- Perfetta simmetria delle chiavi di traduzione tra `src/i18n/it.ts` e `src/i18n/en.ts`.

---

## 2. Processo di Compilazione (Build)

Per creare il bundle di produzione pronto per la distribuzione:
```bash
npm run build
```
Questo comando:
1. Esegue il typecheck completo (`vue-tsc -b`).
2. Esegue il bundling con Vite ottimizzando chunk JS e fogli CSS.
3. Inserisce gli asset compressi e genera il service worker PWA (`dist/sw.js`) con il precache manifest.
4. Genera il manifest web dell'applicazione (`dist/manifest.webmanifest`).

### Test Locale del Pacchetto di Produzione
```bash
npm run preview
```
Avvia un web server locale che serve la directory `dist/` simulando esattamente l'esperienza utente online (incluso il Service Worker e le strategie di cache offline).

---

## 3. Checklist di Release

Prima di effettuare un commit, aprire una Pull Request o distribuire in produzione:

- [ ] `npm run test` passa con 100% di successo.
- [ ] `npm run typecheck` non segnala errori.
- [ ] `npm run test:server` passa con 100% di successo.
- [ ] `npm run docs:check` non rileva link interrotti né file orfani.
- [ ] `npm run build` genera la directory `dist/` senza avvisi critici.
- [ ] Eventuali modifiche alle transazioni o al modello dati contengono il test di migrazione in `src/services/migration.test.ts`.
- [ ] La [Mappa del Codice](../riferimento/mappa-codice.md) e la documentazione collegata sono aggiornate.
