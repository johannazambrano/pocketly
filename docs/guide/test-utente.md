---
source-files:
  - src/App.vue
  - src/router/index.ts
  - src/stores/finance.ts
  - src/stores/ui.ts
  - src/stores/appearance.ts
  - src/stores/backup.ts
  - src/stores/sync.ts
  - src/stores/notifications.ts
  - src/views/DashboardView.vue
  - src/views/OneTimeView.vue
  - src/views/RecurringView.vue
  - src/views/IncomeView.vue
  - src/views/BudgetView.vue
  - src/views/LoansView.vue
  - src/views/ForecastView.vue
  - src/views/SettingsView.vue
  - src/views/BreakdownDetailView.vue
  - src/components/TransactionForm.vue
  - src/components/RecurringForm.vue
  - src/components/QuickExpenseBar.vue
  - src/components/QuickExpenseForm.vue
  - src/components/QuickExpenseManager.vue
  - src/components/TagManager.vue
  - src/components/settings/SettingsIndex.vue
  - src/components/settings/SettingsDataSection.vue
  - src/components/settings/SettingsAppearanceSection.vue
  - src/components/settings/SettingsAboutSection.vue
  - src/utils/settingsSections.ts
  - src/components/SavingsGoalForm.vue
  - src/components/SavingsDepositModal.vue
  - src/components/SearchModal.vue
  - src/components/MonthSelector.vue
  - src/components/BalancePanel.vue
  - src/components/BreakdownList.vue
  - src/components/BackupReminder.vue
  - src/components/ToastHost.vue
  - src/components/BottomNav.vue
  - src/components/AppHeader.vue
  - src/components/UpdatePrompt.vue
  - src/composables/usePageAction.ts
  - src/utils/navStatus.ts
  - src/composables/useMonthStep.ts
  - src/domain/tags.ts
  - src/components/TagInput.vue
  - src/services/migration.ts
  - src/types/models.ts
  - src/services/exportData.ts
  - src/services/excelImport.ts
  - src/services/backup.ts
  - deploy/proxmox/update.sh
verified: 2026-11-20
---

# Guida: Piano di Test Utente (UAT)

Questo documento raccoglie la checklist completa dei test manuali da eseguire sull'applicazione prima di un rilascio in produzione (`merge` di `develop` su `main` e deploy con [`update.sh`](../../deploy/proxmox/update.sh)).

Per i test automatici e la build vedi [Guida: Test, Build e Release](test-e-release.md).

**Dove provare:** la versione di prova di `develop` è pubblicata da Vercel a ogni push, sull'indirizzo fisso del ramo
che Vercel crea da solo e gratis (quello con `-git-develop-`, da *Deployments* → ultima pubblicazione di `develop` →
*Domains*; non quello con il codice casuale, che vale per una sola pubblicazione). Perché si apra e si installi senza
login va spenta la protezione delle anteprime (*Settings → Deployment Protection → Vercel Authentication*): con la
protezione accesa Chrome non riesce a leggere il manifest e risponde «questa app non può essere installata».
Installata sul telefono si chiama **«Pocketly dev»** e sta accanto a quella vera. Lì la sincronizzazione è nascosta e i dati sono solo di quell'indirizzo: si parte importando
[`pocketly-test-data.json`](../../pocketly-test-data.json) da *Impostazioni → Importa backup*. Le prove di
sincronizzazione si fanno sul container Proxmox.

---

## 0. Smoke Test Rapido Pre-Rilascio (5–10 minuti)

Se hai poco tempo, esegui almeno questi controlli minimi (coprono le ultime integrazioni prima del rilascio):

- [ ] **Spese variabili e rapidi:** apri «Nuova spesa» (`+`), verifica il focus sull'importo, salva una spesa spuntando *«Salva anche come inserimento rapido»*; verifica il tocco 1-tap da `QuickExpenseBar` con toast «Modifica» / «Annulla» e la comparsa del chip in *«Frequenti»* riaprendo «Nuova spesa».
- [ ] **Entrate:** in `/entrate` verifica selettore mese/anno (`MonthSelector`), inserimento con note e tag, barra filtri per tag e *«Riepilogo per tag»*.
- [ ] **Dashboard e dettagli:** verifica `BalancePanel`, trend sulle righe di `BreakdownList` e navigazione al dettaglio (`/dettaglio/...`).
- [ ] **Salvadanai:** in `/budget` → scheda *«Salvadanai»* crea un salvadanaio, testa `+10 €` con «Annulla» e la modale «Versa o Preleva».
- [ ] **Omnisearch:** apri `SearchModal` (`Ctrl+K` / `Cmd+K` o lente in intestazione), cerca una voce e verifica salto alla vista corretta con evidenziazione temporanea.
- [ ] **Esportazione tabellare:** in `/impostazioni/dati` scarica un `.xlsx` e verifica che i fogli si aprano senza errori.
- [ ] **Impostazioni per argomento (`PKT-16`):** apri `/impostazioni` su telefono (indice raggruppato → pagina figlia con `← Impostazioni`, selettore anno nascosto in alto) e su PC (indice `sticky` a sinistra + sezione a destra); apri *Categorie* o *Tag* e verifica ricerca, filtri utilizzo, modifica nel foglio `BaseModal` e azione `+` contestuale.
- [ ] **Barra in basso e «+» (`PKT-20`):** sul telefono il «+» in basso fa l'azione della pagina (Entrate → nuova entrata, Budget → *Salvadanai* → nuovo salvadanaio, Dashboard → nuova spesa); «Altro» si apre, contiene la ricerca e si chiude toccando fuori; un toast non finisce sotto la barra o sotto il «+».
- [ ] **Console pulita:** nessuna eccezione JavaScript o errore di rendering nelle viste principali.

### Checklist Operativa Deploy e Sync (`PKT-06`)

Quando il rilascio alza il formato dati allo schema v3 (`CURRENT_SCHEMA_VERSION = 3`, con i nuovi campi sincronizzati `quickExpenses`, `savingsGoals`, `savingsMovements`, `incomes[].notes`, `incomes[].tagIds`):

- [ ] Esegui `update.sh` sul server Proxmox e verifica che l'app servita abbia la nuova versione in *Impostazioni → Aggiornamenti*.
- [ ] **Aggiorna tutti i telefoni/PC collegati alla sync** (*Impostazioni → Verifica aggiornamenti*, o *Ricarica dal server* se la PWA resta sulla versione precedente): grazie al formato v3, un dispositivo non ancora aggiornato che legge i nuovi dati dal server si ferma con `NewerFormatError` (stato «da aggiornare») invece di sovrascrivere e cancellare i campi nuovi, ma non potrà sincronizzare finché non viene aggiornato.

---

## A. Primo Avvio, Layout, Aspetto e Navigazione

- [ ] **Primo avvio (`WelcomePanel`):** su archivio vuoto compare il riquadro *«Per cominciare»* con i collegamenti ad entrata, spesa ricorrente e importazione; sparisce automaticamente appena viene inserito il primo dato (`incomes`, `oneTimeExpenses`, `recurringExpenses` o `loans`).
- [ ] **Piattaforme (`useAppearanceStore`):** in `/impostazioni` prova tutte e tre le scelte *iPhone*, *Android*, *PC* e verifica sia su viewport mobile (~390px) sia su desktop (~1280px):
  - su *iPhone*: barra superiore traslucida, titolo grande del periodo e foglio modale con barra *Annulla · Titolo · Fine*; sul telefono barra in basso in vetro con il «+» tondo accanto (non più in alto);
  - su *Android*: top app bar con nome vista, chip del selettore mese, pulsante `+` flottante in basso a destra che non copre l'ultima riga della lista;
  - su *PC*: menu laterale sinistro e barra superiore con pulsante `+ Nuova spesa`; con la finestra stretta (sotto 768 px) barra in basso centrata con il «+» dentro.
- [ ] **Barra in basso sul telefono (`BottomNav`, `PKT-20`):** su viewport mobile (~390px), per *iPhone*, *Android* e *PC*:
  - **«+» che segue la pagina (`usePageAction`):** in Entrate apre *«Nuova entrata»*, in Ricorrenti *«Nuova spesa ricorrente»*, in Prestiti *«Nuovo prestito»*, in Budget → *Salvadanai* *«Nuovo salvadanaio»*; in Budget → *Budget*, Dashboard, Variabili, Previsioni e Impostazioni apre *«Nuova spesa variabile»*. Passa rapidamente tra le pagine (anche con «Indietro») e verifica che il «+» non resti con l'azione della pagina precedente;
  - **«Altro»:** su Android sale dal fondo come pannello, su iPhone e PC compare sopra la barra; contiene *«Cerca movimenti, budget, prestiti…»* (apre la ricerca) e le altre sezioni; si chiude toccando fuori, con `Esc` e cambiando pagina; mentre è aperto il «+» di Android sparisce; su una pagina di «Altro» (es. Prestiti) la voce «Altro» resta evidenziata;
  - **Pallino di avviso (`resolveSettingsAlert`):** con il promemoria del backup attivo (o un aggiornamento pronto, o un errore di sincronizzazione sul container) compare un pallino su «Altro» e un'etichetta accanto a *Impostazioni* nel pannello; su PC largo il pallino è accanto a *Impostazioni* nel menu laterale. Con un lettore di schermo (TalkBack / VoiceOver) «Altro» si legge come *«Altro, Backup consigliato»*;
  - **Niente sotto la barra:** l'ultima riga di ogni lista si raggiunge scorrendo; i toast (es. dopo un rapido 1-tap) e il banner *«Aggiornamento pronto»* restano sopra la barra e sopra il «+» di Android;
  - **Schermi stretti:** a 360px (Android piccolo) e sotto 375px (es. 340px dagli strumenti del browser) le etichette della barra non si tagliano male; sotto 375px su iPhone e PC il «+» esce dalla barra e sale sopra, a destra, senza coprire contenuti.
- [ ] **Tema Chiaro / Scuro:** verifica il passaggio tra tema *Chiaro* e *Scuro* su tutte e 3 le piattaforme (6 combinazioni totali), controllando leggibilità dei testi e contrasto di badge, bottoni e avvisi.
- [ ] **Selettore del periodo (`MonthSelector`):**
  - cambia mese con ‹ e › (e con i tasti freccia `←` / `→` sulla tastiera);
  - apri il menu a tendina e seleziona *«Tutto il YYYY»* (verificando che ‹ e › spostino l'anno intero);
  - premi *«Oggi»* (`currentMonthShort`) per tornare al mese corrente.
- [ ] **Protezione modifiche non salvate (`BaseModal` + `useDirty`):** apri una modale (`TransactionForm`, `RecurringForm`, `SavingsGoalForm`), modifica almeno un campo e premi *Annulla* o `Esc`: deve comparire la conferma *«Scartare le modifiche?»* prima di chiudere.

---

## B. Spese Variabili (`OneTimeView`) e Modulo Spesa (`TransactionForm`)

- [ ] **Focus iniziale e tastiera su mobile:** aprendo *«Nuova spesa variabile»* (`+`) il cursore si posiziona sul campo `Importo (€)` (su iPhone la tastiera numerica si apre direttamente sul campo). Aprendo una spesa esistente in modifica il focus non forza l'importo.
- [ ] **Validazione errori sotto i campi (`useFormErrors` + `FieldError`):** prova a salvare con importo vuoto, non numerico o `0`, oppure con nome vuoto: gli errori compaiono sotto i rispettivi campi e il focus si sposta sul primo campo errato.
- [ ] **Campo dei tag che cerca e crea (`TagInput`, `PKT-21`):** su *iPhone*, *Android* e *PC*, in *«Nuova spesa»* e in un nuovo inserimento rapido:
  - tocca il campo *«Cerca o crea un tag»* vuoto: sotto compaiono al massimo 6 tag, i più usati, con *«N volte»*; non compaiono più tutte le pillole;
  - scrivi *«caf»*: compaiono solo i tag che corrispondono (prima chi inizia con «caf», poi chi lo contiene) e in fondo *«Crea «#caf»»*; scrivi *«caffe»* con un tag *«Caffè»* esistente: niente *«Crea»*, si sceglie quello esistente;
  - scegli un tag: diventa una pillola sotto il campo, il campo si svuota e resta attivo per il successivo; la ✕ della pillola lo toglie;
  - crea un tag nuovo dal campo: compare come pillola, sulla spesa salvata e in *Impostazioni → Tag*;
  - sul telefono, con la tastiera aperta, l'elenco resta visibile sopra la tastiera (la pagina scorre) e non viene tagliato dal foglio;
  - su *PC*: frecce su/giù, Invio sceglie, Esc chiude solo l'elenco (non il modulo), Invio nel campo non salva la spesa;
  - con TalkBack / VoiceOver il campo si annuncia come casella combinata e le proposte si leggono con il numero di usi.
- [ ] **Note e badge:** salva una spesa con note e più tag e verifica che appaiano in `EntryRow` in `/una-tantum`.
- [ ] **Chip «Frequenti» (`frequentTemplates`):** dopo aver registrato almeno una spesa, riapri *«Nuova spesa»* e verifica che in cima appaia la riga *«Frequenti»*; toccando un chip, importo, nome, categoria, metodo, note e tag si compilano automaticamente (con data impostata ad oggi).
- [ ] **Duplicazione (`duplicateAsNew` / `EntryRow`):** verifica la duplicazione sia dal pulsante dedicato in modifica (*«Duplica come nuova spesa»*) sia dall'azione sulla riga in `/una-tantum`; la copia propone la data di oggi e salva una nuova voce distinta.
- [ ] **Filtri per tag e riepilogo in `/una-tantum`:** clicca su un badge tag nella lista o nella barra filtri in alto; verifica l'aggiornamento del totale filtrato, la comparsa del banner tag attivo (con *«Mostra tutto l'anno»* se ci sono spese con lo stesso tag in altri mesi) e il pannello comprimibile *«Riepilogo per tag»*.

---

## C. Inserimenti Rapidi (`QuickExpenseBar`, `QuickExpenseManager`, `QuickExpenseForm`)

- [ ] **Salvataggio dal modulo spesa:** in *«Nuova spesa variabile»* spunta *«Salva anche come inserimento rapido»* e verifica le due varianti:
  - con *«Ricorda anche l'importo»* attivo → salva un rapido a importo fisso;
  - con *«Ricorda anche l'importo»* disattivato → salva un rapido ad importo variabile.
- [ ] **1-tap su rapido a importo fisso (`useQuickExpenseTrigger`):**
  - clicca sulla pillola del rapido nella `QuickExpenseBar` (sia in Dashboard sia in Variabili): la spesa viene registrata con la data di oggi e il saldo si aggiorna subito;
  - verifica la comparsa del toast con i pulsanti **«Modifica»** e **«Annulla»** (durata 10s, resta fermo se ci passi sopra con mouse/dito/focus, chiudibile con `✕`);
  - clicca **«Annulla»** sul toast e verifica che la spesa appena registrata venga eliminata;
  - ripeti e clicca **«Modifica»** sul toast e verifica che si apra `TransactionForm` sulla spesa appena creata.
- [ ] **Modifica prima di salvare (`prefill`):** clicca sull'icona matita (`✎`) accanto a un rapido a importo fisso e verifica che si apra *«Nuova spesa variabile»* precompilato, senza proporre di nuovo *«Salva anche come inserimento rapido»*.
- [ ] **Rapido ad importo libero:** clicca su un rapido senza importo fisso; nella pillola, al posto della cifra, compare «… €» in grigio e nessuna matita; toccandola si apre il modulo precompilato pronto per scrivere solo l'importo.
- [ ] **Gestione e riordino (`QuickExpenseManager`):** clicca *«Gestisci»* nella barra rapida (o vai a `/impostazioni#inserimenti-rapidi`), aggiungi un nuovo rapido, verificane gli errori di validazione (nome obbligatorio, importo facoltativo ma valido se presente), riordina le voci con ↑ / ↓ e verifica che il nuovo ordine si rifletta immediatamente in Dashboard e Variabili.

---

## D. Entrate (`/entrate`, `IncomeView`)

- [ ] **Inserimento entrata con note e tag:** aggiungi una nuova entrata in `/entrate` con categoria, accredito su (`paymentMethodId`), note e uno o più tag; verifica l'importo in verde (`text-accent`) nella lista.
- [ ] **Selettore periodo (`MonthSelector`):** verifica che l'anno e il mese si scelgano esclusivamente dal `MonthSelector` della pagina (non duplicati nella barra superiore) e che filtrino correttamente le entrate mostrate e il totale.
- [ ] **Filtri per tag e riepilogo:** filtra le entrate per tag dalla barra superiore o cliccando un tag nella riga; apri *«Riepilogo per tag»* e verifica percentuali, barre e banner totale annuo (*«Mostra tutto l'anno»* / *«Rimuovi filtro»*).
- [ ] **Duplicazione ed eliminazione:** duplica un'entrata esistente e poi elimina una voce verificando la conferma tramite `ConfirmHost`.

---

## E. Spese Ricorrenti (`/ricorrenti`, `RecurringView`, `RecurringForm`)

- [ ] **Creazione ricorrenza:** aggiungi una spesa ricorrente (es. mensile) con data di primo addebito e verifica che compaia in `/ricorrenti` e contribuisca al *«Totale (equivalente mensile)»* (`monthlyEquivalent`).
- [ ] **Modifica da addebito singolo (3 scelte in `RecurringForm`):** apri la modifica di una ricorrenza da *«Prossimi addebiti»* in Dashboard (o da `/dettaglio/...`) su un addebito successivo al primo e verifica tutte e 3 le opzioni:
  - *«Solo questo addebito»*: cambia importo o giorno (dentro lo stesso mese); verifica l'errore se provi a spostare il giorno fuori dal mese; verifica che gli altri mesi restino invariati;
  - *«Da questo addebito in poi»* (`splitRecurring`): cambia l'importo da un mese in poi; verifica che in `/ricorrenti` continui a comparire **una sola riga** per la serie, con il nuovo importo attivo, e che appaia il pulsante **«Storico»**;
  - *«Tutta la spesa»*: verifica il salvataggio sull'intera serie.
- [ ] **Salta addebito e Storico:** da un addebito singolo scegli *«Salta questo addebito»*, poi apri *«Storico»* sulla riga in `/ricorrenti`, verifica le parti della serie e le eccezioni e premi **«Ripristina»** sull'addebito saltato/modificato.
- [ ] **Eliminazione a 3 scelte (`deleteChoiceOpen`):** da un addebito singolo verifica le opzioni *«Solo l'addebito del …»*, *«Dall'addebito del … in poi»* (`endRecurringSeriesFrom`) e *«Tutta la spesa, con lo Storico»* (`deleteRecurringSeries`).

---

## F. Dashboard e Dettaglio Ripartizioni (`/`, `/dettaglio/:kind/:id`)

- [ ] **Pannello saldo (`BalancePanel`):**
  - verifica la cifra grande del previsto a fine mese/anno e la frase sotto con il risultato fino a oggi;
  - apri e chiudi *«Come si arriva a questa cifra»* (`explainToggle`), controllando che la somma delle righe coincida con la cifra grande;
  - verifica la barra *«Come si dividono le uscite»* (*Ricorrenti* vs *Variabili*) con i verdetti rispetto alla media dei mesi precedenti.
- [ ] **Colore neutro con stima decisiva:** con entrate stimate attive in un periodo che senza stima sarebbe negativo, verifica che la cifra grande resti neutra (`text-ink`) e compaia la riga *«Se le entrate stimate non arrivano: …»* in rosso.
- [ ] **Trend per categoria e metodo (`BreakdownList` + `tagTrends`):** seleziona un mese con movimenti in mesi precedenti dell'anno e verifica la comparsa discreta di *«più del solito»* / *«meno del solito»* sotto le righe che si discostano dalla media.
- [ ] **Dettaglio ripartizioni (`BreakdownDetailView`):**
  - clicca una riga di *«Spese per categoria»* e una di *«Spese per metodo di pagamento»*: verifica che la somma delle voci mostrate coincida con il totale nella Dashboard;
  - modifica una voce direttamente dal dettaglio e chiudi il modulo verificando che il focus torni alla voce modificata;
  - verifica la nota di confronto con la media nella testata della lista e il link *«Torna alla dashboard»* (che ripristina posizione/focus sulla riga);
  - apri manualmente un URL inesistente `/dettaglio/categoria/inesistente` e verifica lo stato «Categoria non trovata» con i collegamenti di ritorno.
- [ ] **Prossimi addebiti:** verifica la lista *«Prossimi addebiti»* sul mese corrente e sull'anno intero (raggruppati per mese e con pulsante *«Mostra tutti»* oltre la soglia).

---

## G. Budget e Salvadanai (`/budget`, `BudgetView`)

- [ ] **Budget mensile:**
  - imposta limiti mensili su una o più categorie e verifica le barre (`BudgetBar`: ok / attenzione / oltre limite), il disponibile al giorno e la proiezione a fine mese;
  - clicca *«Proponi dalla media»* (`suggestLimits`) verificando che compili solo le categorie senza limite;
  - **sincronizzazione del mese con le altre viste (`PKT-02`):** cambia mese in Dashboard o Variabili e apri `/budget` verificando che mostri lo stesso mese (`finance.selectedMonth`); naviga con ‹ e › nella pagina Budget (`useMonthStep`), compreso il passaggio dicembre ↔ gennaio nei limiti di `finance.years`, e verifica che tornando alle altre pagine il mese sia aggiornato;
  - **fallback su tutto l'anno:** seleziona *«Tutto il YYYY»* (`'all'`) in Dashboard e apri `/budget`: verifica che mostri il mese corrente (`finance.today`) con la nota informativa (`budget.wholeYearNote`), senza sovrascrivere `'all'` finché non clicchi ‹ o ›.
- [ ] **Scheda «Salvadanai» (`SavingsGoalForm`):**
  - passa alla scheda *«Salvadanai»* e verifica lo stato vuoto iniziale;
  - crea un nuovo salvadanaio con nome, importo target, importo già accantonato facoltativo, data obiettivo e colore; verifica validazione errori (nome obbligatorio, target > 0, accantonato non negativo);
  - verifica il riepilogo globale (totale accantonato, obiettivo, barra di avanzamento, quota mensile consigliata e conteggi *in corso* / *completati* / *scaduti*);
  - crea un salvadanaio con data obiettivo passata e verifica che appaia come *«Scaduto»* senza gonfiare la *«Quota mensile consigliata»* ma comparendo nella riga *«In più mancano … agli obiettivi scaduti»*.
- [ ] **Versamenti rapidi e Modale «Versa o Preleva» (`SavingsDepositModal`):**
  - clicca `+10 €` (o `+50 €`, `+100 €`) sulla card del salvadanaio: verifica l'incremento immediato e prova **«Annulla»** sul toast;
  - apri *«Versa o Preleva»*, prova i chip rapidi, *«Completa obiettivo»* e verifica lo stato *«Completato»* al raggiungimento del target;
  - passa a *«Preleva»*: verifica il blocco con messaggio di errore se provi a prelevare più del saldo attuale, poi testa *«Preleva tutto»*.

---

## H. Prestiti (`/prestiti`) e Previsioni (`/previsioni`)

- [ ] **Prestiti (`LoansView`):** crea un prestito *Credito* e uno *Debito*, aggiungi uno o più rimborsi parziali (`RepaymentForm`), verifica il calcolo di *Restituito*, *Rimasto* e lo stato *Saldato* al saldo completo, poi elimina un rimborso.
- [ ] **Previsioni (`ForecastView`):**
  - aggiungi una spesa simulata su un mese futuro e verifica l'aggiornamento immediato della tabella (*Saldo* e *Cumulato*);
  - attiva/disattiva *«Stima le entrate da questo mese in poi»* e seleziona/deseleziona manualmente le categorie, verificando l'impatto sia sulla tabella di proiezione sia sulla Dashboard.

---

## I. Ricerca Globale Omnisearch (`SearchModal`)

- [ ] **Apertura:** apri la ricerca sia dalla lente nell'intestazione sia con la scorciatoia `Ctrl+K` (o `Cmd+K` su macOS).
- [ ] **Motore di ricerca (`searchFinance`):**
  - verifica ricerca con più parole (es. `caffe 1,50`), senza distinzione di maiuscole o accenti (`caffe` trova `Caffè`);
  - verifica ricerca per categoria, metodo di pagamento, tag, nota e data;
  - verifica che una spesa ricorrente divisa (con *«Da questo addebito in poi»*) compaia come **un solo risultato**;
  - verifica che compaiano tutte le tipologie: *Variabile*, *Ricorrente*, *Entrata*, *Prestito*, *Salvadanaio*.
- [ ] **Navigazione ed evidenziazione (`useHighlight`):**
  - clicca un risultato (o premi `Invio` per il primo risultato): l'app passa alla pagina giusta, seleziona l'anno/mese corretto (e toglie eventuali filtri tag che nasconderebbero la voce), apre la scheda *«Salvadanai»* per i salvadanai, evidenzia temporaneamente la riga con anello colorato e rimuove il parametro `?highlight=` dall'indirizzo.

---

## J. Impostazioni, Backup, Import/Export, Sync e Notifiche (`/impostazioni`, `/impostazioni/:section`)

- [ ] **Indice per argomento e navigazione (`PKT-16`, `SettingsView`, `SettingsIndex`):**
  - su telefono (`< lg`) verifica che `/impostazioni` mostri i 4 gruppi (*Dati e sincronizzazione*, *Organizzazione*, *Preferenze*, *App*) con righe di stato aggiornate e pallini di avviso dedicati (con TalkBack / VoiceOver, a promemoria attivo, la riga si legge *«Dati e backup, Ultimo backup …, Backup consigliato»*); aprendo una sezione verifica il link `← Impostazioni`, il ritorno alla posizione dell'indice e il selettore dell'anno nascosto nell'header (`meta.hideYear`);
  - su PC (`>= lg`) verifica il layout a 2 colonne con indice `sticky` a sinistra (che resta visibile scorrendo liste lunghe a destra) e *Dati e backup* aperta di default su `/impostazioni`;
  - verifica i collegamenti diretti: icona cloud sync → `/impostazioni/sincronizzazione`, *«Gestisci»* in `QuickExpenseBar` → `/impostazioni/inserimenti-rapidi`, *«Importa…»* in `WelcomePanel` → `/impostazioni/dati`, e le vecchie ancore `/impostazioni#backup` e `/impostazioni#inserimenti-rapidi`;
  - verifica l'aspetto su tutte e 6 le combinazioni piattaforma (iPhone / Android / PC) × tema (chiaro / scuro), compreso il selettore `A–Z / Più usate` su iOS scuro.
- [ ] **Categorie, Metodi di pagamento e Tag (`TagManager`, `PKT-16`, `PKT-17`):**
  - verifica aggiunta inline in cima, campo ricerca sempre visibile (senza accenti/maiuscole), filtri *Tutte / In uso / Non usate*, ordinamento *A–Z / Più usate*, griglia a 2 colonne su schermi larghi e barra di salto alfabetico quando ci sono almeno 15 voci;
  - su telefono verifica che il `+` nella barra inferiore (`usePageAction`) porti il focus sul campo *Aggiungi* in Categorie, Metodi e Tag, e apra il modulo nuovo rapido in *Inserimenti rapidi*;
  - tocca una riga per aprire il foglio/modale `BaseModal`: verifica anteprima etichetta, rinomina (con controllo nome duplicato), cambio colore dalla tavolozza OKLCH / picker libero / casuale, conteggio utilizzi e cancellazione con riassegnazione delle voci su un'altra categoria/metodo (o rimozione solo tag);
  - verifica *«Riarmonizza i colori»* dentro *Aspetto e lingua* (`/impostazioni/aspetto`) e l'**ordine alfabetico** (`finance.sortedTags` / `sortTagsByName`, insensibile a maiuscole/accenti e con ordinamento numerico) nei menu a tendina (`TagSelect`), nella scelta tag (`TagInput`), in Impostazioni, in Budget e in Previsioni (i filtri tag in Variabili ed Entrate restano invece ordinati per importo).
- [ ] **Backup JSON e Promemoria (`BackupReminder`):**
  - in `/impostazioni/dati` esporta un backup in chiaro e un backup protetto con password (`AES-GCM`), verificando lo stato *«Tutti i dati sono nell'ultimo backup»*;
  - importa il backup cifrato inserendo prima una password errata (verifica errore *«Password errata»*) e poi quella corretta;
  - verifica che quando il promemoria `BackupReminder` è attivo, *«Vai al backup»* porti a `/impostazioni/dati#backup` mettendo a fuoco il riquadro del backup (e il banner non compaia né sull'indice delle Impostazioni né in *Dati e backup*, ma compaia ancora nelle altre pagine come *Tag* o *Aspetto e lingua*).
- [ ] **Importazione da Excel (`.xlsx`):** scegli un file `.xlsx` di Expense Tracker, controlla l'anteprima dei conteggi (incluse le entrate e i tag) e gli eventuali avvisi, e conferma la sostituzione dei dati.
- [ ] **Esportazione tabellare (`exportData`):**
  - prova **Excel (`.xlsx`)** con anno selezionato e *«Tutti gli anni»*: verifica aprendo il file in Excel/LibreOffice che ci siano i 5 fogli (*Spese variabili*, *Spese ricorrenti* con promemoria e addebiti saltati/cambiati, *Entrate* con tag e note, *Prestiti*, *Categorie e metodi*) e che le cifre siano numeriche formattate correttamente;
  - prova **Archivio ZIP** (verifica l'estrazione dei 5 CSV UTF-8 con BOM e separatori coerenti con la lingua `it`/`en`) e almeno un **singolo CSV**.
- [ ] **Sincronizzazione E2E tra due dispositivi (su istanza collegata al server):**
  - collega due browser/dispositivi con la stessa chiave server e password;
  - verifica il merge concorrente: aggiunte su entrambi i dispositivi di spese, versamenti su salvadanai (`SavingsMovement`), note/tag su entrate e riordino di `quickExpenses` (il riordino locale sopravvive alla sync se sul server l'ordine non è cambiato);
  - verifica le cancellazioni propagate da un dispositivo all'altro.
- [ ] **Notifiche Web Push e PWA (`NotificationSettings`, `UpdatePrompt`):**
  - configura regole predefinite e applicale alle ricorrenti esistenti;
  - su istanza HTTPS collegata al server, abilita le notifiche su dispositivo e invia una *«Notifica di prova»*;
  - verifica *«Verifica aggiornamenti»* e il flusso di installazione PWA / funzionamento offline.
