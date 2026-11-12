---
source-files:
  - src/App.vue
  - src/router/index.ts
  - src/types/models.ts
  - src/views/DashboardView.vue
  - src/views/BreakdownDetailView.vue
  - src/components/RecurringForm.vue
  - src/domain/budget.ts
verified: 2026-11-12
---

# Panoramica Generale dell'Applicazione

Pocketly è una Progressive Web App (PWA) moderna, veloce e orientata alla privacy per il controllo delle finanze personali e familiari.

---

## 1. Principi Fondamentali

1. **Privacy-First & Zero-Knowledge:**
   Nessun dato finanziario viene inviato in chiaro su server cloud o esposto ad API bancarie di terzi. L'utente ha la piena proprietà dei propri dati.
2. **Offline-First:**
   L'applicazione è pienamente operativa anche in assenza totale di connettività internet. Tutte le letture e le scritture avvengono istantaneamente sul database IndexedDB locale.
3. **Sincronizzazione Opzionale Multi-Dispositivo:**
   Se l'utente desidera condividere o sincronizzare i dati tra più dispositivi (ad esempio smartphone e PC desktop), può collegare un'istanza personale del server Pocketly. Il server riceve unicamente blob cifrati via AES-GCM; la chiave di cifratura non lascia mai i dispositivi autorizzati.
4. **Precisione Contabile Assoluta:**
   Tutti gli importi memorizzati sono rappresentati come interi in centesimi di euro (`Cents = number`). Non si verificano dispersioni o errori di arrotondamento tipici del calcolo decimale floating point.

---

## 2. Le 8 Schermate Principali e la Vista di Dettaglio

La navigazione principale avviene tramite la barra di navigazione inferiore ([`BottomNav.vue`](../src/components/BottomNav.vue)), con accesso immediato a tutte le aree funzionali:

### 1. Dashboard (`/`)
La vista di riepilogo globale. Si apre sul mese corrente e permette di scorrere i mesi con i tasti freccia (← e →) o tramite swipe touch sul riquadro principale. La cifra grande è il "Risultato previsto" a fine mese o anno (per i periodi passati il risultato finale); sotto compaiono il risultato da inizio periodo a oggi e, se il previsto conta su entrate stimate, quanto ne pesa la stima (in quel caso, se la cifra è positiva solo grazie alla stima, resta in colore neutro). "Come si arriva a questa cifra" apre il conto dietro il previsto. Seguono entrate e uscite del periodo e la divisione delle uscite tra ricorrenti e variabili, con il confronto rispetto alla media sempre visibile. La sezione "Prossimi addebiti", mostrata solo sull'anno o sul mese in corso, elenca le uscite programmate (ricorrenti e variabili con data futura) fino a fine mese, o nei prossimi 30 giorni sulla vista annuale (lì con il totale); ogni addebito si apre per la modifica. Le righe delle ripartizioni per categoria e metodo conducono al rispettivo dettaglio analitico.

### 2. Spese Una Tantum (`/una-tantum`)
Permette di registrare uscite singole (data, nome, importo, categoria, metodo di pagamento, note facoltative). Offre:
- Filtro per anno e per singolo mese.
- Supporto a tag multipli colorati per ogni spesa (es. "vacanze", "regali").
- Riquadro a comparsa con spaccato di spesa dettagliato per tag sull'intero anno o sul mese corrente.

### 3. Spese Ricorrenti (`/ricorrenti`)
Dedicata a tutte le spese cicliche (bollette, mutui, canoni di abbonamento, assicurazioni).
- Frequenze disponibili: mensile, trimestrale, semestrale, annuale.
- Calcolo automatico della data del primo addebito e dell'eventuale scadenza finale.
- Calcolo del **costo equivalente mensile**, fondamentale per il budget e per capire il peso costante delle uscite periodiche.
- Sistema di promemoria avanzato stile Google Calendar: ogni spesa ricorrente può definire più regole di notifica (es. 3 giorni prima alle 09:00, 1 giorno prima alle 18:00).
- Modifica senza riscrivere il passato: se la serie ha già avuto addebiti, si sceglie se la modifica vale "Da questo addebito in poi" (di serie: la serie viene divisa e gli addebiti precedenti restano com'erano; si può anche spostare il giorno dell'addebito, per esempio dal 14 al 15, con un solo addebito nel mese del cambio) o per "Tutta la serie". Le parti nate dai cambi restano una spesa sola: in Ricorrenti è una riga, con l'etichetta «Storico» che elenca i periodi e i loro importi.

### 4. Entrate (`/entrate`)
Gestione dei flussi positivi di denaro (stipendi, rimborsi, vendite, regali). Ogni entrata è associata a data, nome, importo, categoria e metodo di accredito.

### 5. Budget Mensile (`/budget`)
Permette di impostare tetti di spesa mensili per ciascuna categoria. Caratteristiche:
- Monitoraggio della spesa effettiva già registrata e di quella già programmata (spese ricorrenti o una tantum con data futura).
- Nel mese in corso: quanto si può spendere al giorno fino a fine mese restando nel budget e, dal 5° giorno (`MIN_PACE_DAYS`), la spesa prevista a fine mese al ritmo attuale.
- Evidenziazione cromatica: verde (in linea), ambra ("Quasi al limite": speso più programmato ha raggiunto l'80% del limite, `BUDGET_WARNING_RATIO`), rosso (budget superato).
- Suggeritore automatico dei limiti basato sulla media storica delle spese.

### 6. Prestiti (`/prestiti`)
Tracciamento di somme di denaro prestate a terzi ("denaro dato") o ricevute in prestito ("denaro ricevuto"):
- Registrazione di pagamenti di rimborso parziali nel tempo con data e importo.
- Calcolo del saldo netto residuo (quanto ancora deve essere rimborsato o restituito).
- Stato del prestito: "Aperto" vs "Completato" al raggiungimento del saldo zero.

### 7. Previsioni & Simulazioni (`/previsioni`)
Strumento di pianificazione finanziaria per anticipare la liquidità futura:
- Tabella mese per mese da oggi fino a fine anno con entrate previste, spese programmate, saldo mensile e saldo cumulato progressivo.
- Stima intelligente delle entrate: identifica automaticamente o manualmente le entrate fisse (es. stipendio) che si ripetono e le include nei mesi futuri.
- Simulazioni di acquisto "What-If": possibilità di inserire acquisti ipotetici in un dato mese futuro per visualizzare all'istante l'impatto sul saldo di fine anno.

### 8. Impostazioni (`/impostazioni`)
Centro di controllo e configurazione dell'applicazione:
- Gestione anagrafica di categorie, metodi di pagamento e tag (creazione, modifica nome, colore, eliminazione sicura).
- Esportazione ed importazione di backup completi (in formato JSON protetto da password crittografato via AES-GCM o non cifrato).
- Collegamento e diagnostica della sincronizzazione con il server personale.
- Configurazione e test delle notifiche Web Push su dispositivi mobili e desktop.
- Selezione della lingua (Italiano / English).

### 9. Dettaglio Ripartizione Categoria / Metodo (`/dettaglio/:kind/:id`)
Vista di approfondimento accessibile direttamente dalla Dashboard toccando una categoria o un metodo di pagamento. Elenca singolarmente tutte le voci (spese variabili e addebiti ricorrenti del periodo selezionato) che concorrono alla spesa, consentendo di verificare esattamente la composizione del totale mostrato nella Dashboard. Ogni voce si apre per la modifica con lo stesso modulo delle pagine Variabili e Ricorrenti.

---

## 3. Flusso Dati e Interazione

```mermaid
flowchart TD
    User([Utente]) <--> UI[Interfaccia Vue 3 / Componenti]
    UI <--> Stores[Pinia Stores: finance, sync, notifications, backup, ui]
    Stores <--> Domain[Domain puro: calcoli contabili, budget, ricorrenze, merge]
    Stores <--> Storage[services/storage.ts & idb-keyval]
    Storage <--> IDB[(IndexedDB Browser)]
    
    subgraph Sync & Push
        Stores <--> SyncEngine[services/sync & notifications/api]
        SyncEngine <--> WebPushCrypto[services/backupCrypto & webpushCrypto]
        WebPushCrypto <--> Server[Python Backend: /api/sync & /api/push]
    end
```

Tutti i dati risiedono primariamente in IndexedDB. Ogni volta che l'utente effettua un'operazione, la modifica viene validata, registrata nello store e salvata atomicamente in locale, notificando in background il motore di sincronizzazione se attivo.
