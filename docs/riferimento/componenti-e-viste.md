---
source-files:
  - src/views/DashboardView.vue
  - src/views/BreakdownDetailView.vue
  - src/views/OneTimeView.vue
  - src/views/RecurringView.vue
  - src/views/IncomeView.vue
  - src/views/BudgetView.vue
  - src/views/LoansView.vue
  - src/views/ForecastView.vue
  - src/views/SettingsView.vue
  - src/composables/useMonthStep.ts
  - src/components/AppHeader.vue
  - src/components/BottomNav.vue
  - src/components/PageHeader.vue
  - src/components/EntryList.vue
  - src/components/EntryRow.vue
  - src/components/TransactionForm.vue
  - src/components/RecurringForm.vue
  - src/components/LoanForm.vue
  - src/components/RepaymentForm.vue
  - src/components/BudgetBar.vue
  - src/components/MonthSelector.vue
  - src/components/TagManager.vue
  - src/components/TagBadge.vue
  - src/components/TagInput.vue
  - src/components/TagSelect.vue
  - src/components/BreakdownList.vue
  - src/components/BalancePanel.vue
  - src/components/BackupReminder.vue
  - src/components/NotificationSettings.vue
  - src/components/NotificationRulesEditor.vue
  - src/components/SyncSettings.vue
  - src/components/BaseModal.vue
  - src/components/ConfirmHost.vue
  - src/components/ToastHost.vue
  - src/components/SubmitButton.vue
  - src/components/UpdatePrompt.vue
  - src/components/WelcomePanel.vue
verified: 2026-11-11
---

# Riferimento: Componenti e Viste

Questo documento descrive le 9 viste (8 principali e 1 di dettaglio) e l'inventario dei 27 componenti UI di Pocketly.

---

## 1. Le 9 Viste dell'Applicazione (`src/views/`)

### `DashboardView.vue` (`/`)
- **Ruolo:** Hub visivo principale dell'applicazione. All'avvio si posiziona automaticamente sul mese corrente (`finance.selectedMonth`).
- **Dati:** Visualizza il riepilogo annuale o mensile (`finance.summary` o `finance.monthSummaryData`). Mostra il saldo iniziale, le entrate, le spese una tantum e le spese ricorrenti.
- **Interattività e Accessibilità:**
  - Navigazione mese da tastiera: delegata centralmente ai listener globali di [`MonthSelector`](../../src/components/MonthSelector.vue) (tasti ← e →), mentre lo swipe orizzontale touch sul riquadro del saldo in [`BalancePanel`](../../src/components/BalancePanel.vue) è gestito con `useMonthStep`.
  - Annuncio per screen reader (`aria-live="polite"`) sul cambio di periodo.
  - Frase ponte esplicativa (`bridge`) quando il saldo attuale è sotto zero ma la proiezione a fine mese/anno è positiva.
  - Sezione prossimi addebiti: mostra tutte le uscite programmate (ricorrenti e variabili con data futura) fino a fine mese (sul mese corrente) o nei successivi 30 giorni (sull'intero anno), con totale aggregato e disposizione a colonne su schermi larghi.
  - Colori semantici e avvisi: per le scadenze imminenti (`daysLeft <= 3`), l'importo resta in grigio neutro (`text-slate-700`) e l'attenzione visiva viene focalizzata sul conteggio dei giorni, evidenziato con accento ambra (`text-amber-700 font-medium`), riservando rigorosamente il rosso solo a saldi negativi sotto zero.
- **Componenti inclusi:** [`AppHeader`](../../src/components/AppHeader.vue), [`BalancePanel`](../../src/components/BalancePanel.vue), [`BackupReminder`](../../src/components/BackupReminder.vue), [`BreakdownList`](../../src/components/BreakdownList.vue), [`WelcomePanel`](../../src/components/WelcomePanel.vue).

### `BreakdownDetailView.vue` (`/dettaglio/:kind(categoria|metodo)/:id`)
- **Ruolo:** Vista di dettaglio analitico di una riga delle ripartizioni della Dashboard.
- **Funzionalità:** Raggiungibile cliccando su una categoria o metodo di pagamento dalla Dashboard (tramite la prop `linked` di `BreakdownList`). Mostra l'elenco completo delle voci che compongono quella riga (sia spese una tantum che singole scadenze di spese ricorrenti nel periodo) tramite `breakdownItems`, ordinate dalla più recente. Include la specifica del periodo (es. "Fino a oggi", "Solo programmato", "Anno intero") e il selettore mese [`MonthSelector`](../../src/components/MonthSelector.vue) per cambiare periodo senza tornare indietro. Il totale coincide sempre con l'importo mostrato nella riga della Dashboard ed è formattato in grigio neutro (`text-slate-800`), coerentemente con la semantica cromatica che evita il rosso per spese ordinarie.
- **Accessibilità e Navigazione:**
  - Autofocus programmatico: al montaggio della pagina e al variare dell'entità, `document.title` si aggiorna dinamicamente (`"{name} · Pocketly"`) e l'intestazione principale `h2` riceve immediatamente il focus (`ref="heading"`, `tabindex="-1"`, `focus:outline-none`), informando subito gli screen reader e gli utenti da tastiera del nuovo contesto.
  - Navigazione di ritorno intelligente (`back`): il pulsante di ritorno verifica la cronologia precedente (`router.options.history.state.back === '/'`); se si proviene dalla dashboard viene eseguito `router.back()`, permettendo a `scrollBehavior` di riposizionare la dashboard nell'esatta posizione di scorrimento precedente. Aprendo direttamente l'URL, la navigazione reindirizza normalmente alla radice `/`.
  - Compatibilità scorciatoie: `MonthSelector` non intercetta tasti modificatori, preservando le scorciatoie del browser come `Alt+ArrowLeft` per tornare indietro nella cronologia.

### `OneTimeView.vue` (`/una-tantum`)
- **Ruolo:** Gestione transazioni puntuali.
- **Funzionalità:** Filtro per mese tramite [`MonthSelector`](../../src/components/MonthSelector.vue). Filtro per singolo tag e pulsante per visualizzare il riquadro a comparsa dello spaccato per tag ([`BreakdownList`](../../src/components/BreakdownList.vue)). Creazione e modifica con [`TransactionForm`](../../src/components/TransactionForm.vue).

### `RecurringView.vue` (`/ricorrenti`)
- **Ruolo:** Gestione delle spese periodiche.
- **Funzionalità:** Raggruppamento per frequenza (mensile, trimestrale, semestrale, annuale). Mostra il costo equivalente mensile complessivo. Permette di configurare regole di notifica per ciascuna spesa tramite [`RecurringForm`](../../src/components/RecurringForm.vue) e [`NotificationRulesEditor`](../../src/components/NotificationRulesEditor.vue).

### `IncomeView.vue` (`/entrate`)
- **Ruolo:** Gestione delle entrate dell'anno.
- **Funzionalità:** Elenco entrate registrate (`finance.incomesOfYear`), somma complessiva in testata, form modale per aggiunta/modifica tramite [`TransactionForm`](../../src/components/TransactionForm.vue) con opzione `isIncome`.
- *Nota architettonica:* visualizza l'intero anno corrente senza selettore mese individuale (vedi [known-issues.md](../known-issues.md)).

### `BudgetView.vue` (`/budget`)
- **Ruolo:** Monitoraggio dei limiti di spesa per categoria.
- **Funzionalità:** Barra di navigazione mese dedicata (`monthIndex` locale con pulsanti precedente/successivo/mese corrente). Configurazione in linea dei limiti per ciascuna categoria con calcolo immediato di speso, programmato, residuo e ritmo (`MIN_PACE_DAYS`). Visualizzazione con barre colorate [`BudgetBar`](../../src/components/BudgetBar.vue). Pulsante per suggerimento automatico limiti basato sulla cronologia.

### `LoansView.vue` (`/prestiti`)
- **Ruolo:** Registro prestiti dati e ricevuti.
- **Funzionalità:** Schede separate per prestiti attivi e completati. Calcolo del saldo residuo netto. Sotto-form per aggiungere rimborsi progressivi tramite [`RepaymentForm`](../../src/components/RepaymentForm.vue).

### `ForecastView.vue` (`/previsioni`)
- **Ruolo:** Proiezione flussi finanziari e pianificazione futuro prossimo.
- **Funzionalità:** 
  - Sezione simulazioni What-If (es. "Acquisto elettrodomestico a novembre").
  - Configurazione della stima entrate ricorrenti (selettore categorie considerate o stima automatica, media storica `ESTIMATE_MONTHS = 3`).
  - Tabella previsionale completa mese per mese con saldo mensile e progressivo cumulato fino a dicembre.

### `SettingsView.vue` (`/impostazioni`)
- **Ruolo:** Amministrazione dati, preferenze e collegamenti.
- **Funzionalità:** Selettore lingua (IT/EN), anagrafica categorie/metodi/tag tramite [`TagManager`](../../src/components/TagManager.vue), esportazione ed importazione backup (con o senza password AES-GCM), sincronizzazione cloud privata ([`SyncSettings`](../../src/components/SyncSettings.vue)), configurazione notifiche e Web Push ([`NotificationSettings`](../../src/components/NotificationSettings.vue)).

---

## 2. Inventario dei Componenti UI (`src/components/`)

### Layout e Navigazione
- **`AppHeader.vue`**: Intestazione superiore con titolo e selettore anno globale che controlla `finance.selectedYear`.
- **`BottomNav.vue`**: Barra inferiore con accesso rapido: su mobile presenta 4 tab principali e il menu a comparsa "Altro" per le restanti schede; su schermi larghi si estende a menu laterale fisso. Tramite l'helper `isParent` controlla `route.meta.navParent`, mantenendo evidenziata la voce padre (es. dashboard) quando l'utente consulta schermate di approfondimento come `BreakdownDetailView`.
- **`PageHeader.vue`**: Testata standard per ciascuna schermata con titolo, subtitolo facoltativo e pulsante per l'azione primaria.

### Liste e Righe Dati
- **`EntryList.vue`**: Wrapper per elenchi dati con gestione stato vuoto personalizzato e riga del totale.
- **`EntryRow.vue`**: Singola voce interattiva con slot per badge/metadati e pulsanti contestuali di modifica ed eliminazione.
- **`BreakdownList.vue`**: Lista ripartizioni percentuali con barre di progresso colorate per categoria o tag; con prop `linked` trasforma ogni riga in link di navigazione verso `BreakdownDetailView`.
- **`BudgetBar.vue`**: Visualizzazione a doppia barra per mostrare l'importo già speso e la quota già programmata rispetto al tetto limite.
- **`BalancePanel.vue`**: Riquadro bilancio con entrate, uscite e saldo a data odierna. Applica la convenzione cromatica semantica: il rosso è riservato esclusivamente a saldi o previsti negativi (`signColor`, con transizione a colore neutro se il rientro a fine periodo è positivo via `bridge`), le entrate sono verdi (`incomeColor`) solo se strettamente positive (`> 0`), e le uscite contabili sono in grigio neutro (`text-slate-800`). Include note espandibili per il confronto ricorrenti/variabili (`notesOpen`), frase ponte saldo/previsto (`bridge`) e gesture swipe touch orizzontali per il cambio mese delegate a `useMonthStep`.
- **`MonthSelector.vue`**: Controllo unificato per il filtro mese con pulsante rapido «Questo mese», menu a tendina `<select>` (opzione «Tutti i mesi» e 12 mesi) e pulsanti freccia passo a passo (‹ e ›). Centralizza i listener globali da tastiera per le frecce ← e → (`ArrowLeft`/`ArrowRight`), applica la preservazione del focus (reindirizzato al menu a tendina quando un pulsante si nasconde o si disabilita), fornisce etichette ARIA contestuali parlanti per l'ingresso da «Tutti i mesi» (`dashboard.goToMonth`) e gestisce il cambio mese/anno tramite `useMonthStep`.

### Moduli e Form
- **`TransactionForm.vue`**: Modulo riutilizzabile per inserimento e modifica di spese una tantum o entrate (importo, data, nome, categoria, metodo, tag, note).
- **`RecurringForm.vue`**: Modulo per spese ricorrenti con scelta di frequenza, date inizio/fine e configurazione regole promemoria.
- **`LoanForm.vue`**: Modulo per prestiti (nome contatto, tipo dato/ricevuto, importo, data, note).
- **`RepaymentForm.vue`**: Modulo per registrare una tranche di rimborso a un prestito esistente.
- **`SubmitButton.vue`**: Pulsante standard di conferma form con stati attivi/disabilitati omogenei.

### Tag, Categorie e Metodi
- **`TagBadge.vue`**: Pillola colorata che visualizza il nome di una categoria, metodo o tag recuperando dinamicamente il colore associato.
- **`TagSelect.vue`**: Menu a tendina uniforme per la selezione rapida di categorie o metodi di pagamento.
- **`TagInput.vue`**: Componente combinato per associare tag multipli a una transazione o crearne di nuovi all'istante.
- **`TagManager.vue`**: Interfaccia di amministrazione delle liste anagrafiche (aggiunta, cambio colore palette, cancellazione sicura con controllo riferimenti orfani).

### Impostazioni, Notifiche e Sync
- **`SyncSettings.vue`**: Gestione del collegamento al server di sincronizzazione, visualizzazione stato ETag, disconnessione pulita con revoca di iscrizione e promemoria dal server (`leaveServer`).
- **`NotificationSettings.vue`**: Pannello di gestione notifiche browser, registrazione Web Push per il dispositivo corrente, avviso orizzonte temporale a 60 giorni, diagnostica limite/errori di invio calendario e invio notifica test.
- **`NotificationRulesEditor.vue`**: Editor dinamico per definire promemoria multipli con giorni di anticipo e orario target.
- **`BackupReminder.vue`**: Banner di avviso nella dashboard per ricordare di esportare una copia dei dati dopo 30 giorni.

### Feedback, Modali e Sistema
- **`BaseModal.vue`**: Dialogo modale accessibile con gestione focus, pressione tasto Escape e overlay sfumato.
- **`ConfirmHost.vue`**: Host globale per mostrare dialoghi di conferma distruttiva (richieste tramite `useConfirmDelete`).
- **`ToastHost.vue`**: Host per notifiche a comparsa temporanee gestite tramite `useUiStore().toast(...)`.
- **`UpdatePrompt.vue`**: Banner per notificare la disponibilità di una nuova versione PWA scaricata dal service worker.
- **`WelcomePanel.vue`**: Schermata introduttiva visualizzata al primo avvio su database completamente vuoto.
