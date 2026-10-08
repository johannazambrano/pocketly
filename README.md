# Pocketly

App per tenere traccia di spese una tantum, spese ricorrenti, entrate, prestiti e previsioni.
È una **PWA** (Progressive Web App): si installa sul telefono come un'app normale, funziona offline
e i dati restano **solo sul dispositivo** (nessun server, nessun account).

## Comandi

Serve [Node.js](https://nodejs.org) (versione LTS).

| Comando | A cosa serve |
|---|---|
| `npm install` | Installa le dipendenze (solo la prima volta o dopo un aggiornamento). |
| `npm run dev` | Avvia l'app in sviluppo su http://localhost:5173 con ricaricamento automatico. |
| `npm test` | Esegue i test automatici sui calcoli e sulla migrazione dei dati. |
| `npm run build` | Controlla i tipi e crea la versione da pubblicare nella cartella `dist/`. |
| `npm run preview` | Prova in locale la versione di `dist/` (con service worker, come online). |
| `npm run icons` | Rigenera le icone PNG partendo da `public/favicon.svg`. |

Per provare l'app dal telefono durante lo sviluppo: `npm run dev -- --host` e apri dal telefono
l'indirizzo "Network" mostrato (telefono e PC sulla stessa rete Wi-Fi).

## Tecnologie

- **Vue 3 + TypeScript**, compilato con **Vite**
- **Pinia** per lo stato, **Vue Router** per le pagine, **vue-i18n** per italiano e inglese
- **Tailwind CSS 4** per lo stile, **Font Awesome** per le icone (inclusi nel pacchetto: l'app non carica nulla da internet)
- **vite-plugin-pwa** per installazione e funzionamento offline
- **IndexedDB** (tramite `idb-keyval`) per salvare i dati
- **Vitest** per i test

## Struttura

```
src/
  types/models.ts       modello dati (importi in centesimi, riferimenti per id)
  domain/               logica pura: ricorrenze, riepiloghi, proiezioni (con test)
  services/storage.ts   salvataggio dati: unico punto da cambiare per aggiungere un cloud
  services/migration.ts import dei backup, compresi quelli del prototipo HTML
  stores/               stato dell'app (Pinia)
  i18n/                 testi in italiano (it.ts) e inglese (en.ts)
  components/           componenti riutilizzabili (moduli, finestre, liste)
  views/                le 7 schermate
```

## Dati dal prototipo

Dal prototipo HTML: *Settings → Esporta Backup*, poi in Pocketly *Impostazioni → Importa backup*.
La conversione è automatica. Le spese ricorrenti del prototipo vengono importate come attive dal
1° gennaio dell'anno in cui erano inserite: se serve, correggi la data del primo addebito.

## Dati dall'Excel "Expense Tracker"

Lo script `scripts/xlsx_to_pocketly.py` converte il foglio Excel in un backup JSON da importare
nell'app. La procedura completa è in [`docs/IMPORTA_DA_EXCEL.md`](docs/IMPORTA_DA_EXCEL.md).

## Pubblicazione

La cartella `dist/` è un sito statico. Su **Netlify** o **Vercel** basta collegare il repository
GitHub (comando di build `npm run build`, cartella `dist`). I file `public/_redirects` e `vercel.json`
sono già configurati.
