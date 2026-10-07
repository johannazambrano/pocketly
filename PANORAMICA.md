# Pocketly – panoramica del progetto

PWA per tenere traccia di spese una tantum, spese ricorrenti, entrate, prestiti e previsioni.
Nessun backend e nessun account: i dati restano sul dispositivo (IndexedDB).

## Stack

- Vue 3 + TypeScript, compilati con Vite
- Pinia (stato), Vue Router (pagine), vue-i18n (italiano e inglese)
- Tailwind CSS 4, Font Awesome
- vite-plugin-pwa (installazione e offline)
- idb-keyval (IndexedDB)
- Vitest (test)

## Schermate

| Percorso | Schermata |
|---|---|
| `/` | Dashboard: riepilogo dell'anno e addebiti in arrivo |
| `/una-tantum` | Spese singole |
| `/ricorrenti` | Spese mensili, trimestrali, semestrali, annuali |
| `/entrate` | Entrate |
| `/prestiti` | Prestiti dati o ricevuti, con rimborsi parziali |
| `/previsioni` | Proiezione mese per mese |
| `/impostazioni` | Categorie, metodi di pagamento, backup |

## Architettura

1. **`src/types/models.ts`**: modello dati (schema v2).
   - Importi in centesimi interi.
   - Categorie e metodi di pagamento referenziati per id.
   - Voci non raggruppate per anno: l'anno si ricava dalla data.
2. **`src/domain/`**: funzioni pure, con test.
   - `recurrence.ts`: in quali mesi cade un addebito, prossima scadenza (il giorno 31 diventa 30 nei mesi corti), attività in un anno.
   - `calculations.ts`: riepilogo annuale, previsione, addebiti imminenti, stato dei prestiti, anni disponibili.
3. **`src/stores/finance.ts`**: store Pinia con l'intero `FinanceData`.
   - Viste derivate dall'anno selezionato e operazioni di inserimento, modifica ed eliminazione.
   - Salvataggio automatico 300 ms dopo l'ultima modifica, e subito se l'app va in background.
   - Eliminando una categoria in uso, le voci collegate vengono spostate su un'altra.
4. **`src/services/storage.ts`**: interfaccia `DataStore` (`load`, `save`), unico punto di accesso alla persistenza. Un eventuale cloud sarebbe un'altra implementazione. Richiede lo storage persistente al browser.
5. **`src/services/migration.ts` e `backup.ts`**: import ed export dei backup, compresi quelli del prototipo HTML (schema v1). Lo storage recupera anche i dati dalle chiavi `localStorage` del prototipo.

## Regole di calcolo

- **Periodo attivo**: parte dal mese del primo movimento registrato nell'anno (o da gennaio se non ce ne sono) e arriva a dicembre. Le ricorrenze sono contate solo in questo periodo.
- **Previsione**: per i mesi senza entrate registrate usa la media dei mesi che ne hanno. Include le simulazioni (spese ipotetiche a un mese e anno precisi).
- **Ricorrenze**: valide anche negli anni successivi alla data di inizio, finché non hanno una data di fine.

## Comandi

| Comando | A cosa serve |
|---|---|
| `npm install` | Installa le dipendenze |
| `npm run dev` | Sviluppo su http://localhost:5173 |
| `npm test` | Test su calcoli e migrazione |
| `npm run build` | Controllo dei tipi e build in `dist/` |
| `npm run preview` | Prova locale della build, con service worker |
| `npm run icons` | Rigenera le icone PNG da `public/favicon.svg` |

## Pubblicazione

`dist/` è un sito statico. Su Netlify o Vercel basta collegare il repository
(build `npm run build`, cartella `dist`). `public/_redirects` e `vercel.json` sono già configurati.

## File modificati

| File | Modifica |
|---|---|
| `PANORAMICA.md` | Creato (questo file) |

Nessun altro file del progetto è stato creato, modificato o cancellato.
Durante la sessione è stato creato e subito cancellato un file temporaneo di prova in
`C:\ProgettiTDNet\Progetti - Johanna`, per verificare che la cartella fosse scrivibile.

## Cosa è stato fatto in questa sessione

- Esplorata la struttura del progetto e letti README, `package.json`, `vite.config.ts`, modello dati, logica di dominio, store, storage e router. I componenti `.vue` non sono stati aperti.
- Verificata la scrittura sulla cartella `C:\ProgettiTDNet\Progetti - Johanna`.
- Scritto questo documento.
