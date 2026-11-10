# Pocketly

Pocketly è un'applicazione web progressiva (**PWA**) per la gestione e il controllo completo delle finanze personali. È progettata per garantire totale sovranità sui dati: funziona **offline-first**, memorizza i dati sul dispositivo (IndexedDB) e supporta la **sincronizzazione cifrata end-to-end (Zero-Knowledge)** su un server personale leggero, oltre a promemoria e notifiche Web Push.

---

## Funzionalità Principali

- **8 Schermate Complete + Dettaglio Analitico:**
  1. **Dashboard:** panoramica immediata del saldo attuale, entrate, uscite, navigazione rapida mensile (frecce tastiera e swipe touch), uscite in arrivo fino a fine mese e ripartizioni collegate per categoria e metodo.
  2. **Spese Una Tantum:** registrazione spese puntuali con filtro mensile, tag multipli, note, categorie e metodi di pagamento.
  3. **Spese Ricorrenti:** gestione uscite periodiche (mensili, trimestrali, semestrali, annuali), costo equivalente mensile e promemoria multi-regola personalizzati.
  4. **Entrate:** registrazione flussi di reddito per data, categoria e metodo di accredito.
  5. **Budget Mensile:** definizione di tetti di spesa per categoria con monitoraggio in tempo reale del passo di spesa (ritmo giornaliero, sforamenti previsti).
  6. **Prestiti:** tracciamento di denaro dato o ricevuto con registro dei rimborsi parziali e calcolo del debito/credito residuo.
  7. **Previsioni & Simulazioni:** proiezione del flusso di cassa mese per mese fino a fine anno, stima automatica/manuale delle entrate ricorrenti e simulazioni di acquisto.
  8. **Impostazioni:** gestione categorie, metodi di pagamento, tag personalizzati, backup protetti da password (AES-GCM), sincronizzazione multi-dispositivo e notifiche.
  - *Vista di Dettaglio Ripartizioni:* consultazione analitica di tutte le voci (variabili e ricorrenti) di una categoria o metodo di pagamento toccando la riga corrispondente nella Dashboard.

- **Privacy & Crittografia:**
  - Nessuna dipendenza da servizi cloud di terze parti o API bancarie esterne.
  - Backup cifrati con PBKDF2 e AES-GCM 256-bit.
  - Sincronizzazione multi-dispositivo end-to-end con risoluzione conflitti a 3 vie (`merge.ts`).
  - Web Push conformi a RFC 8291 (`aes128gcm`) e RFC 8292 (VAPID): il server inoltra solo messaggi già cifrati dal client.

---

## Quick Start (Sviluppo Locale)

Requisiti: [Node.js](https://nodejs.org) (v20+ raccomandata) e facoltativamente Python 3 per il server di sincronizzazione.

```bash
# 1. Installazione dipendenze frontend
npm install

# 2. Avvio dev server frontend (http://localhost:5173)
npm run dev

# 3. Esecuzione test unitari frontend (Vitest)
npm run test

# 4. Controllo tipi TypeScript
npm run typecheck

# 5. Build di produzione
npm run build
```

Per testare il server Python di sync e push:
```bash
# Esecuzione test unitari server
npm run test:server

# Avvio server in locale (porta 8787, allineata al proxy Vite)
python3 -m server.main --port 8787 --data-dir ./data
```

---

## Documentazione

La documentazione del progetto è organizzata in percorsi dedicati sia a sviluppatori umani che ad agenti IA:

- 📖 **[Indice Generale della Documentazione](docs/README.md):** mappa completa per navigare l'architettura, le guide operative e i moduli di riferimento.
- 🤖 **[Istruzioni per Agenti IA (AGENTS.md)](AGENTS.md):** regole auree, invarianti architetturali verificati, convenzioni e checklist di manutenzione.
- 🗺️ **[Mappa del Codice](docs/riferimento/mappa-codice.md):** elenco di ogni file del repository, con responsabilità, test e riferimenti.
- 🔔 **[Guida Notifiche](docs/NOTIFICHE.md):** architettura e funzionamento dettagliato dei promemoria locali e Web Push.
- 📊 **[Importazione da Excel](docs/IMPORTA_DA_EXCEL.md):** guida alla migrazione dati da fogli Excel.
- 🚀 **[Deploy su Proxmox LXC](deploy/proxmox/README.md):** guida per hosting self-hosted su Debian con Nginx e systemd.
