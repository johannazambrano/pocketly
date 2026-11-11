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
  - src/composables/useDirty.ts
  - src/stores/ui.ts
  - src/domain/backupReminder.ts
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
- **Testata:** il titolo è il periodo (`periodTitle`: "Novembre" grande su iPhone, "Novembre 2026" sul PC accanto al selettore, "Anno 2026" per tutto l'anno; su Android solo per i lettori di schermo, perché il nome della pagina è nella barra in alto). Le righe dei prossimi addebiti hanno l'iniziale in un cerchio su Android e la freccia › su iPhone (la matita altrove). Riquadri e card prendono la forma della piattaforma dagli stili (`card`, `panel`).
- **Dati:** Visualizza il riepilogo annuale o mensile (`finance.summary` o `finance.monthSummaryData`). Le cifre e le ripartizioni contano ciò che è già avvenuto (fino a oggi nel periodo in corso, tutto per un periodo passato, il programmato per un mese futuro); la cifra grande dice dove si arriverà. Con l'app vuota mostra solo [`WelcomePanel`](../../src/components/WelcomePanel.vue).
- **Riquadro principale (`mainFigure`, passato a [`BalancePanel`](../../src/components/BalancePanel.vue)):**
  - Cifra grande: "Risultato previsto per {mese}" / "Risultato previsto per il {anno}" per il periodo in corso e i mesi futuri; "Risultato di {mese}" / "Risultato dell'anno" per i periodi passati (o "… a oggi" quando previsto e risultato coincidono).
  - Quando il previsto conta su entrate stimate, sotto la cifra compare sempre "Contando X di entrate stimate, non ancora registrate" (`dashboard.countingEstimate`).
  - Nel periodo in corso, sotto la cifra, il risultato fino a oggi: "Risultato da inizio {mese} a oggi:" / "Risultato da inizio anno a oggi:".
  - Se la cifra è positiva solo grazie alla stima (`estimateDecisive`), resta in colore neutro (`main.neutral`) invece del blu.
  - "Come si arriva a questa cifra" (`explain`): il conto dietro il previsto (risultato a oggi, entrate registrate e stimate in arrivo, uscite in arrivo), mostrato solo quando la cifra grande è un previsto.
  - Per un mese passato, il risultato è confrontato con la media dei mesi precedenti dell'anno (`averageBalanceBefore`, `compareToAverage`).
  - Ripartizione ricorrenti/variabili (`expensesSplit`) con verdetti sempre visibili rispetto alla media: le ricorrenti rispetto al costo mensile medio, le variabili rispetto alla media dei mesi precedenti (`finance.variableOfSelectedMonth`, sull'anno `finance.variableThisMonth`); nel mese in corso il confronto usa la media riportata al giorno di oggi (`paceSoFar`).
- **Prossimi addebiti:** uscite programmate (ricorrenti e variabili con data futura) da `upcomingCharges`. Si mostrano solo sull'anno in corso o sul mese in corso (`showUpcoming`). Titolo "Prossimi addebiti di {mese}" (fino a fine mese) sul mese in corso, "Prossimi addebiti, nei prossimi 30 giorni" sull'anno; il totale compare solo nella vista annuale (`showUpcomingTotal`). Su schermi larghi l'elenco va su due colonne riempite per colonna. Ogni riga è un pulsante (`editCharge`) che apre [`TransactionForm`](../../src/components/TransactionForm.vue) o [`RecurringForm`](../../src/components/RecurringForm.vue) (con la data dell'addebito come `occurrence`, da `editingOccurrence`); alla chiusura (`closeChargeForm`) il focus torna sulla riga, o sul titolo dell'elenco se la riga non c'è più. Le scadenze vicine (`daysLeft <= 3`) evidenziano in ambra (`text-amber-700 font-medium`) il "quando", non l'importo, che resta neutro (`text-slate-700`).
- **Interattività e Accessibilità:**
  - Navigazione mese: tasti ← e → gestiti da [`MonthSelector`](../../src/components/MonthSelector.vue); swipe orizzontale (almeno 60px, prevalentemente orizzontale) sul riquadro principale gestito qui (`onTouchStart`/`onTouchEnd` con `useMonthStep`).
  - Annuncio per screen reader (`aria-live="polite"`) sul cambio di periodo.
  - Ritorno dal dettaglio: in `onMounted`, se `router.options.history.state.forward` è un indirizzo `/dettaglio/…`, il focus torna sulla riga della ripartizione da cui si era entrati (`preventScroll`, la posizione la ripristina il router).
- **Componenti inclusi:** [`BalancePanel`](../../src/components/BalancePanel.vue), [`BreakdownList`](../../src/components/BreakdownList.vue), [`MonthSelector`](../../src/components/MonthSelector.vue), [`WelcomePanel`](../../src/components/WelcomePanel.vue), [`TransactionForm`](../../src/components/TransactionForm.vue), [`RecurringForm`](../../src/components/RecurringForm.vue). `AppHeader` e `BackupReminder` stanno in `App.vue`, fuori dalla vista.

### `BreakdownDetailView.vue` (`/dettaglio/:kind(categoria|metodo)/:id`)
- **Ruolo:** Vista di dettaglio analitico di una riga delle ripartizioni della Dashboard.
- **Funzionalità:** Raggiungibile cliccando su una categoria o metodo di pagamento dalla Dashboard (tramite la prop `linked` di `BreakdownList`). Mostra l'elenco completo delle voci che compongono quella riga (sia spese una tantum che singole scadenze di spese ricorrenti nel periodo) tramite `breakdownItems`. Include la specifica del periodo (`periodLabel`: anno fino a oggi, anno, mese fino a oggi, mese programmato, mese) e il selettore mese [`MonthSelector`](../../src/components/MonthSelector.vue) per cambiare periodo senza tornare indietro. Il totale coincide sempre con l'importo mostrato nella riga della Dashboard ed è in grigio neutro (`text-slate-800`).
- **Modifica delle voci:** ogni riga è un pulsante (`edit`, `aria-label` da `detail.editRow`) che apre [`TransactionForm`](../../src/components/TransactionForm.vue) per una spesa variabile o [`RecurringForm`](../../src/components/RecurringForm.vue) per un addebito ricorrente, passando la data dell'addebito come `occurrence`. Alla chiusura (`closeForm`) il focus torna sulla riga, o sul titolo se la voce non c'è più (per esempio perché le si è cambiata categoria).
- **Categoria o metodo inesistente:** al posto dell'elenco un riquadro con titolo specifico per tipo (`detail.notFoundTitle` / `detail.notFoundMethodTitle`) e due azioni: "Torna alla dashboard" e "Gestisci categorie e metodi" (verso `/impostazioni`).
- **Accessibilità e Navigazione:**
  - Autofocus programmatico: al montaggio della pagina e al variare dell'entità, `document.title` si aggiorna dinamicamente (`"{name} · Pocketly"`) e l'intestazione principale `h2` riceve il focus (`ref="heading"`, `tabindex="-1"`, `focus:outline-none`); in `onBeforeUnmount` il titolo precedente viene ripristinato.
  - Ritorno (`back`): il link "Torna alla dashboard" è un `<a href="/">` normale, non un `RouterLink`: il `RouterLink` navigherebbe da solo prima del gestore, e il `push('/')` in più farebbe montare la dashboard senza sapere da quale riga si torna. Ctrl/Cmd/Maiusc/Alt+clic e il tasto centrale restano al browser; altrimenti, se si arriva dalla dashboard (`router.options.history.state.back === '/'`) si usa `router.back()` (la dashboard riappare nella posizione di scorrimento e con il focus sulla riga di partenza), se no `router.push('/')`.
  - Compatibilità scorciatoie: `MonthSelector` non intercetta tasti modificatori, preservando le scorciatoie del browser come `Alt+ArrowLeft` per tornare indietro nella cronologia.

### `OneTimeView.vue` (`/una-tantum`)
- **Ruolo:** Gestione transazioni puntuali.
- **Funzionalità:** Filtro per mese tramite [`MonthSelector`](../../src/components/MonthSelector.vue). Filtro per singolo tag e pulsante per visualizzare il riquadro a comparsa dello spaccato per tag ([`BreakdownList`](../../src/components/BreakdownList.vue)). Creazione e modifica con [`TransactionForm`](../../src/components/TransactionForm.vue).

### `RecurringView.vue` (`/ricorrenti`)
- **Ruolo:** Gestione delle spese periodiche.
- **Funzionalità:** Un unico elenco delle spese ricorrenti attive nell'anno (`finance.recurringOfYear`), con la frequenza indicata su ogni riga insieme a periodo, categoria, metodo e riepilogo dei promemoria. Mostra il costo equivalente mensile complessivo. Creazione e modifica con [`RecurringForm`](../../src/components/RecurringForm.vue), che include le regole di notifica ([`NotificationRulesEditor`](../../src/components/NotificationRulesEditor.vue)).

### `IncomeView.vue` (`/entrate`)
- **Ruolo:** Gestione delle entrate dell'anno.
- **Funzionalità:** Elenco entrate registrate (`finance.incomesOfYear`), somma complessiva in testata, form modale per aggiunta/modifica tramite [`TransactionForm`](../../src/components/TransactionForm.vue) con `kind="income"`.
- *Nota architettonica:* visualizza l'intero anno corrente senza selettore mese individuale (vedi [known-issues.md](../known-issues.md)).

### `BudgetView.vue` (`/budget`)
- **Ruolo:** Monitoraggio dei limiti di spesa per categoria.
- **Funzionalità:** Barra di navigazione mese dedicata (`monthIndex` locale con pulsanti precedente/successivo/mese corrente). Configurazione in linea dei limiti per ciascuna categoria con calcolo immediato di speso, programmato, residuo e ritmo (`MIN_PACE_DAYS`). Visualizzazione con barre colorate [`BudgetBar`](../../src/components/BudgetBar.vue). Pulsante per suggerimento automatico limiti basato sulla cronologia.

### `LoansView.vue` (`/prestiti`)
- **Ruolo:** Registro prestiti dati e ricevuti.
- **Funzionalità:** Schede separate per prestiti attivi e completati. Calcolo del saldo residuo netto. Sotto-form per aggiungere rimborsi progressivi tramite [`RepaymentForm`](../../src/components/RepaymentForm.vue). Sul telefono la scheda ha solo la matita: si elimina dal modulo del prestito ("Elimina" in fondo, `deletable`); sul PC c'è anche il cestino.

### `ForecastView.vue` (`/previsioni`)
- **Ruolo:** Proiezione flussi finanziari e pianificazione futuro prossimo.
- **Funzionalità:** 
  - Sezione simulazioni What-If (es. "Acquisto elettrodomestico a novembre").
  - Configurazione della stima entrate ricorrenti (selettore categorie considerate o stima automatica, media storica `ESTIMATE_MONTHS = 3`).
  - Tabella previsionale completa mese per mese con saldo mensile e progressivo cumulato fino a dicembre.

### `SettingsView.vue` (`/impostazioni`)
- **Ruolo:** Amministrazione dati, preferenze e collegamenti.
- **Funzionalità:** Selettore lingua (IT/EN), aspetto ("Stile": automatico / iPhone / Android / PC, con la piattaforma riconosciuta; "Tema": sistema / chiaro / scuro, store `appearance`), anagrafica categorie/metodi/tag tramite [`TagManager`](../../src/components/TagManager.vue), esportazione ed importazione backup (con o senza password AES-GCM), sincronizzazione cloud privata ([`SyncSettings`](../../src/components/SyncSettings.vue)), configurazione notifiche e Web Push ([`NotificationSettings`](../../src/components/NotificationSettings.vue)).

---

## 2. Inventario dei Componenti UI (`src/components/`)

### Layout e Navigazione
- **`AppHeader.vue`**: Intestazione superiore, diversa per piattaforma (`appearance.platform`): su iPhone barra traslucida senza titolo, con l'anno a sinistra nella tinta e il "+" tondo a destra; su Android top app bar con il nome della pagina (`pageTitle`, anche per le viste figlie tramite `navParent`), l'anno e lo stato della sincronizzazione, mentre il "+" è il pulsante flottante di `BottomNav` (su schermi larghi torna qui); sul PC barra chiara con il marchio "Pocketly", l'anno e il pulsante "+ Nuova spesa". Il selettore dell'anno controlla `finance.selectedYear`. L'`h1` "Pocketly" resta per i lettori di schermo anche dove non si vede.
- **`BottomNav.vue`**: Barra inferiore con accesso rapido, con l'aspetto della piattaforma (iPhone: traslucida, voce attiva nella tinta; Android: "navigation bar" di Material con la pillola dietro l'icona attiva e, fino a `md`, il pulsante flottante "+" in basso a destra che apre la nuova spesa): su mobile presenta 4 tab principali e il menu a comparsa "Altro" per le restanti schede; su schermi larghi si estende a menu laterale fisso. Tramite l'helper `isParent` controlla `route.meta.navParent`, mantenendo evidenziata la voce padre (es. dashboard) quando l'utente consulta schermate di approfondimento come `BreakdownDetailView`.
- **`PageHeader.vue`**: Testata di ciascuna schermata con titolo e pulsante per l'azione primaria (o, nello slot, altri controlli: il mese del Budget, il selettore di Variabili). La usano tutte le pagine tranne la dashboard e il dettaglio. Il titolo segue la piattaforma: grande (34px) su iPhone, solo per i lettori di schermo su Android, medio sul PC. Il pulsante "Aggiungi" (classe `page-add`) è pieno sul PC e tenue a pillola sul telefono, dove l'azione principale sta già nella barra o nel pulsante flottante.

### Liste e Righe Dati
- **`EntryList.vue`**: Wrapper per elenchi dati con gestione stato vuoto personalizzato e riga del totale; è un `panel`, quindi prende la forma della piattaforma.
- **`EntryRow.vue`**: Singola voce con slot per badge/metadati. Sul PC ha matita e cestino. Sul telefono tutta la riga apre la modifica (un pulsante "Modifica: nome" sotto il contenuto, che lascia passare i tocchi tranne sui propri pulsanti, come i tag che filtrano), con la freccia › su iPhone e l'iniziale in un cerchio su Android; si elimina dal modulo. Le pagine passano al modulo `deletable` e gestiscono `delete` con `useConfirmDelete`, chiudendo il modulo dopo l'eliminazione.
- **`BreakdownList.vue`**: Lista ripartizioni percentuali con barre di progresso colorate per categoria o tag; con prop `linked` trasforma ogni riga in link di navigazione verso `BreakdownDetailView`, con un `aria-label` leggibile (`dashboard.breakdownRowLabel`: nome, importo, quota e destinazione).
- **`BudgetBar.vue`**: Visualizzazione a doppia barra per mostrare l'importo già speso e la quota già programmata rispetto al tetto limite.
- **`BalancePanel.vue`**: Riquadro principale della dashboard. Props: `main` (`{ label, value, today?: { label, value }, estimate?, neutral?, note?, hint? }`), `income`, `expenses`, `split` (parti ricorrenti/variabili con nota) ed `explain` (il conto dietro il previsto). Mostra la cifra grande con sotto la riga della stima, il risultato fino a oggi, nota e suggerimento; poi entrate e uscite; poi la barretta ricorrenti/variabili con la legenda (ricorrenti a sinistra, variabili allineate a destra) e i verdetti rispetto alla media. Il pulsante "Come si arriva a questa cifra" (`explainOpen`, chiuso di serie) apre il conto, con un link a `/previsioni` per cambiare la stima. Da `lg` la cifra grande e la coppia entrate/uscite stanno affiancate. Colori: `signColor` (blu se `>= 0`, rosso se `< 0`), neutro se `main.neutral`; entrate verdi (`incomeColor`) solo se `> 0`; uscite in grigio neutro (`text-slate-800`). Lo swipe per cambiare mese non è qui: lo gestisce `DashboardView`.
- **`MonthSelector.vue`**: Controllo unificato per il filtro mese, con la forma della piattaforma: su iPhone segmenti (‹ mese · menu del mese scelto · Anno · mese ›, il segmento scelto come pillola), su Android chip di Material (mese prima · mese scelto con la spunta e il menu · mese dopo · Tutto l'anno, in una riga che scorre di lato), sul PC frecce e menu. Ha il pulsante rapido «Questo mese», menu a tendina `<select>` (opzione «Tutti i mesi» e 12 mesi) e pulsanti freccia passo a passo (‹ e ›). Centralizza i listener globali da tastiera per le frecce ← e → (`ArrowLeft`/`ArrowRight`), applica la preservazione del focus (reindirizzato al menu a tendina quando un pulsante si nasconde o si disabilita), fornisce etichette ARIA contestuali parlanti per l'ingresso da «Tutti i mesi» (`dashboard.goToMonth`) e gestisce il cambio mese/anno tramite `useMonthStep`.

### Moduli e Form
Tutti e quattro i moduli usano `useDirty` (la finestra chiede conferma prima di scartare modifiche non salvate), mostrano "Annulla" accanto a "Salva" (su iPhone "Annulla" e "Fine" stanno nella barra del foglio: il modulo ha un id da `useId()` passato a `BaseModal` come `formId`) e precompilano l'importo con il separatore decimale della lingua (`useFormat().amountInput`).
- **`TransactionForm.vue`**: Modulo riutilizzabile per inserimento e modifica di spese una tantum o entrate (`kind`; importo, data, nome, categoria, metodo, tag, note).
- **`RecurringForm.vue`**: Modulo per spese ricorrenti con scelta di frequenza, date inizio/fine e configurazione regole promemoria. Prop `occurrence`: l'addebito da cui si è aperta la modifica (senza, il prossimo da oggi). Modificando una serie che ha un addebito successivo al primo, si sceglie "Da questo addebito in poi" (di serie: divide la serie con `splitRecurring`, e la data di inizio diventa di sola lettura) o "Tutta la serie"; altrimenti un avviso dice che la modifica vale per tutta la serie.
- **`LoanForm.vue`**: Modulo per prestiti (nome contatto, tipo dato/ricevuto, importo, data, note).
- **`RepaymentForm.vue`**: Modulo per registrare una tranche di rimborso a un prestito esistente.
- **`SubmitButton.vue`**: Pulsante di conferma dei moduli; con `cancelLabel` mostra accanto un pulsante "Annulla" che emette `cancel`; con `deleteLabel` un pulsante "Elimina" che emette `delete` (iPhone: riga rossa a tutta larghezza; Android: testo rosso a sinistra; PC: sotto i due pulsanti). Segue la piattaforma: sul PC i due pulsanti a tutta larghezza, su Android "Annulla" di testo e "Salva" pieno a pillola allineati a destra, su iPhone niente (Annulla e Fine sono nella barra del foglio).

### Tag, Categorie e Metodi
- **`TagBadge.vue`**: Pillola colorata che visualizza il nome di una categoria, metodo o tag recuperando dinamicamente il colore associato. Con `clickable` è un vero `<button>` (raggiungibile da tastiera e toccabile dentro le righe che si aprono al tocco).
- **`TagSelect.vue`**: Menu a tendina uniforme per la selezione rapida di categorie o metodi di pagamento.
- **`TagInput.vue`**: Componente combinato per associare tag multipli a una transazione o crearne di nuovi all'istante.
- **`TagManager.vue`**: Interfaccia di amministrazione delle liste anagrafiche (aggiunta, cambio colore palette, cancellazione sicura con controllo riferimenti orfani).

### Impostazioni, Notifiche e Sync
- **`SyncSettings.vue`**: Gestione del collegamento al server di sincronizzazione, visualizzazione stato ETag, disconnessione pulita con revoca di iscrizione e promemoria dal server (`leaveServer`).
- **`NotificationSettings.vue`**: Pannello di gestione notifiche browser, registrazione Web Push per il dispositivo corrente, avviso orizzonte temporale a 60 giorni, diagnostica limite/errori di invio calendario e invio notifica test. Se la prova fallisce mostra la causa detta dal servizio push (`notifications.lastTestFailure`, messaggi `notifications.testFailure.*`).
- **`NotificationRulesEditor.vue`**: Editor dinamico per definire promemoria multipli con giorni di anticipo e orario target.
- **`BackupReminder.vue`**: Banner (in `App.vue`, sopra ogni vista) che ricorda di esportare una copia dei dati quando sono passati almeno 7 giorni (`REMINDER_DAYS`) dall'ultimo backup e i dati sono cambiati da allora (hash diverso); "Più tardi" lo rimanda.

### Feedback, Modali e Sistema
- **`BaseModal.vue`**: Dialogo modale accessibile. All'apertura il focus va sul titolo e alla chiusura torna all'elemento che l'ha aperto; finché è aperto `#app` è `inert`. Una pila di finestre a livello di modulo dà a ogni finestra uno `z-index` crescente e solo quella in cima risponde a Esc e al Tab, che resta intrappolato dentro. Con la prop `dirty`, chiudere con Esc, ✕ o clic sullo sfondo chiede prima "Scartare le modifiche?" tramite `ui.confirm` (con `cancelLabel` "Continua a modificare"); "Annulla" nel modulo chiude subito. Ha la forma della piattaforma (classe `sheet`): sul telefono foglio dal basso con la maniglia; su iPhone fondo grigio e, con la prop `formId`, barra "Annulla · titolo · Fine" dove Fine invia il modulo con quell'id; su Android angoli di 28 px, titolo grande a sinistra e niente ✕ quando contiene un modulo; sul PC finestra con ✕.
- **`ConfirmHost.vue`**: Host globale dei dialoghi di conferma richiesti con `ui.confirm` (anche tramite `useConfirmDelete`); usa `cancelLabel` se indicato, altrimenti "Annulla".
- **`ToastHost.vue`**: Host per notifiche a comparsa temporanee gestite tramite `useUiStore().toast(...)`. Gli errori (`kind: 'error'`) restano 10 secondi invece di 3,5, hanno `role="alert"` e si chiudono con la ✕ (`dismissToast`).
- **`UpdatePrompt.vue`**: Banner per notificare la disponibilità di una nuova versione PWA scaricata dal service worker.
- **`WelcomePanel.vue`**: Schermata introduttiva visualizzata al primo avvio su database completamente vuoto.
