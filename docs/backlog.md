---
source-files: []
verified: 2026-11-20
---

# Backlog di Pocketly

Le attività del progetto e la loro storia, per chi ci lavora (Johanna, Jonny) e per gli agenti IA.
I difetti tecnici già analizzati sul codice stanno in [Stato e Difetti Noti](known-issues.md): qui c'è solo un
collegamento, senza ripeterne il testo.

## Riepilogo

| ID | Attività | Stato | Priorità | Chi |
|---|---|---|---|---|
| PKT-01 | Filtro del mese nelle Entrate | fatto | — | Jonny |
| PKT-02 | Il mese del Budget segue quello scelto nelle altre pagine | fatto | — | Jonny |
| PKT-03 | Inserimenti rapidi e Frequenti: dove sta ciascuno | fatto | — | Johanna, Jonny |
| PKT-04 | Rivedere e unire `feature/inserimenti-rapidi` | fatto | — | Johanna |
| PKT-05 | Rivedere e unire `feature/funzionalita-strategiche` | fatto | — | Johanna |
| PKT-06 | Pubblicare su Proxmox e provare sui telefoni | fatto | — | Johanna |
| PKT-07 | Conti con saldo iniziale e prestiti nel saldo | idea da decidere | bassa | libero |
| PKT-08 | Categorie di entrata separate da quelle di spesa | idea da decidere | bassa | libero |
| PKT-09 | Critique 12 della dashboard: P1 e P2 | fatto | — | Johanna |
| PKT-10 | L'avviso del backup porta al riquadro del backup | fatto | — | Johanna |
| PKT-11 | Import dei tag da Excel | fatto | — | Jonny, Johanna |
| PKT-12 | Progettare l'autenticazione nell'app | da fare | media | libero |
| PKT-13 | Analisi di scalabilità e progettazione dell'eventuale evoluzione | fatto | — | Jonny |
| PKT-14 | Analisi di sicurezza ed eventuali fix | da fare | media | libero |
| PKT-15 | Analisi per migliorare la struttura attuale dell'app | da fare | media | libero |
| PKT-16 | Impostazioni divise per argomento | fatto | — | Jonny, Johanna |
| PKT-17 | Categorie, metodi e tag in ordine alfabetico | fatto | — | Johanna |
| PKT-18 | Implementazione piano di scalabilità (da PKT-13) | da fare | media | libero |
| PKT-19 | Salvadanai nella cifra della Dashboard e `csvExport.ts` (da PKT-05) | da decidere | bassa | libero |
| PKT-20 | Barra in basso per iPhone, Android e PC con «+» che segue la pagina | fatto | — | Jonny, Johanna |
| PKT-21 | Scelta dei tag nel modulo con ricerca o menu a tendina | da fare | media | libero |
| PKT-22 | Sezione Patrimonio: monitoraggio e analisi del patrimonio | da fare | media | libero |

Stati possibili: `da fare`, `in corso`, `in attesa di …`, `idea da decidere`, `fatto nel ramo, da unire`, `fatto`, `annullato`.

## Come si usa

I rami di lavoro si uniscono in **`develop`**; `main` riceve `develop` quando si pubblica (è il ramo che
`update.sh` porta sul server).

1. **Le attività non si spostano.** Restano in ordine di numero; cambia solo la riga `Stato` (e la stessa riga
   del riepilogo). Spostare blocchi tra sezioni fa andare in conflitto i rami che toccano il file insieme.
2. **Nuova attività:** il numero successivo (`PKT-12`, `PKT-13`…), una riga nel riepilogo e un blocco qui sotto
   con `Stato`, `Perché`, `Fatto quando` e `Storia`. Per un difetto già descritto in
   [known-issues.md](known-issues.md) basta il collegamento.
3. **Prendere un'attività:** si mette `in corso` e il proprio nome con un piccolo commit **direttamente su
   `develop`**, così gli altri lo vedono subito e non la prendono in due.
4. **Chiudere un'attività:** `fatto` (o `fatto nel ramo, da unire` se il ramo non è ancora in `develop`) nel ramo
   del lavoro, nello stesso commit della modifica, con una riga in `Storia`: data, cosa e commit.
5. **Storico:** le attività chiuse restano qui. A fine anno quelle `fatto` e `annullato` passano in
   `docs/archivio/attivita-ANNO.md`, lasciando nel riepilogo solo quelle aperte.
6. **Agenti IA:** quando una revisione o un lavoro fanno emergere qualcosa da fare dopo, si apre un'attività qui
   invece di lasciarla solo nella conversazione.

---

### PKT-01 — Filtro del mese nelle Entrate
- **Stato:** fatto · **Chi:** Jonny
- **Perché:** la pagina Variabili si filtra per mese, le Entrate mostrano sempre tutto l'anno. Vedi
  [known-issues.md, punto 1](known-issues.md#1-disallineamento-ui-filtro-mese-in-incomeview).
- **Fatto quando:** le Entrate hanno lo stesso selettore del periodo di Variabili; `known-issues.md` aggiornato.
- **Storia:**
  - 2026-11-13 aperta (Jonny).
  - 2026-11-15 il selettore c'è già in `feature/funzionalita-strategiche`: si chiude con PKT-05.
  - 2026-11-15 nel ramo l'anno compare solo nel selettore della pagina (`2322033`).
  - 2026-11-15 in `develop` con PKT-05 (`d95cb45`).

### PKT-02 — Il mese del Budget segue quello scelto nelle altre pagine
- **Stato:** fatto · **Chi:** Jonny
- **Perché:** il Budget ha un suo mese, separato da quello di Dashboard e Variabili. Vedi
  [known-issues.md, punto 2](known-issues.md#2-indice-mese-locale-in-budgetview-risolto).
- **Decisione:** con l'anno intero (`'all'`) nelle altre pagine, il Budget mostra il mese corrente con nota informativa senza sovrascrivere `'all'` finché non si cambia mese; le frecce ‹ › usano `useMonthStep` (passaggio dicembre ↔ gennaio nei limiti di `finance.years`).
- **Fatto quando:** cambiando pagina il mese resta lo stesso; nessun errore nel cambio del mese.
- **Storia:**
  - 2026-11-13 aperta (Jonny).
  - 2026-11-17 completata nel ramo `fix/budget-mese` (Jonny): `BudgetView.vue` legge `finance.selectedMonth` (fallback al mese corrente su `'all'`) e naviga con `useMonthStep`; aggiunti test in `useMonthStep.test.ts` e aggiornati `known-issues.md`, `componenti-e-viste.md`, `mappa-codice.md`.
  - 2026-11-17 in `develop` con `3cdad26` (ramo `fix/budget-mese`, commit `f879aa3`).

### PKT-03 — Inserimenti rapidi e Frequenti: dove sta ciascuno
- **Stato:** fatto · **Chi:** Johanna, Jonny
- **Perché:** sono due funzioni diverse. I «Frequenti» di `feature/funzionalita-strategiche` sono suggerimenti
  automatici che compilano il modulo; gli inserimenti rapidi di `feature/inserimenti-rapidi` sono scorciatoie
  scelte da chi usa l'app, salvate e sincronizzate, che registrano la spesa con un tocco. Unite così come sono,
  però, mettevano nel modulo «Nuova spesa» due righe di pulsanti quasi uguali, spesso con le stesse voci.
- **Decisione:** ognuno al suo posto. Nel modulo «Nuova spesa» solo i Frequenti; gli inserimenti rapidi solo
  nella barra di Dashboard e Variabili. Nel modulo resta la casella per salvare una spesa come rapido.
- **Storia:**
  - 2026-11-15 aperta (revisione dei rami di Jonny).
  - 2026-11-15 chiarito che non sono doppioni; scelta la soluzione «ognuno al suo posto» (Johanna, Jonny). Il
    lavoro si fa in PKT-04: togliere la barra dei rapidi dal modulo.
  - 2026-11-15 barra tolta dal modulo in `feature/inserimenti-rapidi` (`5ba2035`).

### PKT-04 — Rivedere e unire `feature/inserimenti-rapidi`
- **Stato:** fatto · **Chi:** Johanna
- **Fatto quando:** revisione fatta, correzioni fatte, barra dei rapidi tolta dal modulo «Nuova spesa» (PKT-03),
  ramo in `develop`.
- **Storia:**
  - 2026-11-15 aperta.
  - 2026-11-15 revisione: da correggere l'ordine dei rapidi che si perde con la sincronizzazione, i conflitti con
    i P2 della critique 12 (modulo dei rapidi da allineare agli altri moduli) e l'avviso «Annulla» che dura 6 s.
  - 2026-11-15 correzioni nel ramo: unito `develop`; l'ordine riordinato su un dispositivo resta dopo la
    sincronizzazione; modulo dei rapidi con gli errori sotto i campi; l'avviso con «Annulla» resta 10 s e non sparisce
    mentre lo si usa.
  - 2026-11-15 in `develop` (`b35c5b8`); ramo cancellato. Prima di pubblicare: aggiornare l'app su tutti i telefoni
    (gli inserimenti rapidi sono un dato nuovo che si sincronizza).

### PKT-05 — Rivedere e unire `feature/funzionalita-strategiche`
- **Stato:** fatto · **Priorità:** — · **Chi:** Johanna
- **Perché:** è il ramo più grande (ricerca globale, esportazione CSV ed Excel, entrate con note e tag,
  salvadanai, confronto tra periodi, modelli di spesa). Una prima revisione è del 2026-11-12; da allora sono
  arrivati altri commit.
- **Fatto quando:** revisione aggiornata, correzioni fatte, ramo in `develop`; chiude anche PKT-01.
- **Da decidere (Johanna, Jonny):** se i soldi messi nei salvadanai devono ridurre la cifra della Dashboard (una
  riga «di cui messi da parte» o il versamento come uscita); se `csvExport.ts`, che nessuno usa, va tolto o collegato.
- **Storia:**
  - 2026-11-12 prima revisione.
  - 2026-11-15 aperta.
  - 2026-11-15 seconda revisione; unito `develop` nel ramo (`68c113d`), con i tag delle entrate dall'Excel.
  - 2026-11-15 correzioni nel ramo: versamenti dei salvadanai come movimenti, non più persi sincronizzando
    (`047bf0e`); confronto tra periodi con le ricorrenti al giorno di addebito e la media dal mese in cui la voce
    compare (`7e195e3`); quota mensile senza gli obiettivi scaduti (`47d3b98`); ricerca con una riga per spesa divisa,
    rotte per nome ed evidenziazione che si toglie (`0db5a22`, `af59374`); colori e Frequenti (`f21f9c2`); periodo
    di Entrate (`2322033`); esportazione con gli addebiti cambiati (`32d3077`); moduli e accessibilità dei
    salvadanai con «Annulla» (`962f8dd`); confronto leggibile al telefono (`d17aba4`).
  - 2026-11-15 in `develop` (`d95cb45`). Si chiude dopo le due decisioni. Prima di pubblicare: aggiornare l'app su
    tutti i telefoni (dati nuovi che si sincronizzano: salvadanai e loro movimenti, note e tag delle entrate).
  - 2026-11-17 chiusa (Johanna, Jonny): le due decisioni non bloccano la pubblicazione, si pubblica com'è e si
    decidono dopo in `PKT-19`.

### PKT-06 — Pubblicare su Proxmox e provare sui telefoni
- **Stato:** fatto · **Priorità:** — · **Chi:** Johanna
- **Perché:** in `main` ci sono modifiche non ancora pubblicate (critique 12, avviso del backup, tag da Excel).
- **Fatto quando:** `update.sh` lanciato, app aggiornata su tutti i telefoni; provato su iPhone che in «Nuova
  spesa» la tastiera si apre da sola sull'importo.
- **Storia:**
  - 2026-11-15 aperta.
  - 2026-11-17 prima di pubblicare `develop`: dati portati al formato 3 nel ramo `fix/formato-dati-3` (`7d7d102`),
    in `develop` con `274bfef`. Senza, un telefono rimasto alla versione di `main` scartava salvadanai, rapidi e
    note e tag delle entrate, e alla prima modifica li cancellava anche dal server. Ora si ferma su «aggiorna
    l'app» finché non si ricarica: dopo la pubblicazione ricaricare l'app su tutti i telefoni.
  - 2026-11-17 revisione del codice di `develop` rispetto a `main`: 9 correzioni nel ramo `fix/revisione-develop`,
    in `develop` con `caa0c46`. Base della sincronizzazione al formato corrente, così il primo giro dopo
    l'aggiornamento non annulla le modifiche fatte altrove (`883cfd8`); salvadanai sotto zero (`02a5a65`) e
    cancellati mentre altrove ci si versava (`3067b5d`); Ctrl+K sopra un modulo (`58262f8`); progresso complessivo
    dei salvadanai (`5a79d25`); `.xlsx` con caratteri invisibili (`310dba4`) e CSV letti come formule (`23340d6`);
    promemoria del backup con i soli rapidi (`6267392`); schede del Budget per i lettori di schermo (`ad6a404`).
    Restano fuori `csvExport.ts` (`PKT-19`) e i filtri dei tag copiati tra Entrate e Spese (da riordinare con
    `PKT-15`).
  - 2026-11-19 `develop` portato in `main` con `2f177e6` (formato dati 3, nome «Pocketly dev» per la prova su
    Vercel, rapidi senza importo, barra in basso `PKT-20`). Vercel ripubblica `main` da solo; restano `update.sh`
    sul container, la ricarica dell'app su tutti i telefoni e le prove della sincronizzazione.
  - 2026-11-19 `update.sh` lanciato sul container (Johanna): `main` a `2f177e6` pubblicato, formato dati 3.
    Fatta. Le app sui telefoni vanno ricaricate perché sincronizzino di nuovo; le prove dei telefoni seguono la
    [guida di prova](guide/test-utente.md).

### PKT-07 — Conti con saldo iniziale e prestiti nel saldo
- **Stato:** idea da decidere · **Priorità:** bassa · **Chi:** libero
- **Perché:** il saldo a oggi coinciderebbe con quello della banca; prestiti e restituzioni entrerebbero nel
  saldo e nelle previsioni. Esiste il ramo `feature/conti-saldo-iniziale` (30 ottobre), molto indietro rispetto a
  `main`: andrebbe rifatto più che unito.
- **Fatto quando:** decisione presa; se sì, nuove attività per il lavoro.
- **Storia:**
  - 2026-10-30 ramo `feature/conti-saldo-iniziale`.
  - 2026-11-15 aperta.

### PKT-08 — Categorie di entrata separate da quelle di spesa
- **Stato:** idea da decidere · **Priorità:** bassa · **Chi:** libero
- **Perché:** nel modulo di una spesa compaiono anche categorie da entrata (es. Stipendio). Serve un tipo sulle
  categorie, cioè un cambio del formato dei dati e della sincronizzazione.
- **Fatto quando:** decisione presa; se sì, nuove attività per il lavoro.
- **Storia:**
  - 2026-11-11 emersa dalla critique della dashboard.
  - 2026-11-15 aperta.

### PKT-09 — Critique 12 della dashboard: P1 e P2
- **Stato:** fatto · **Chi:** Johanna
- **Storia:**
  - 2026-11-12 P1: periodo scelto da un menu solo (`35df48c`); singoli addebiti di una ricorrente da saltare o
    cambiare, con le tre scelte come nei calendari (`05a0e87`, `0cb630f`); dati illeggibili mai sovrascritti
    (`e58051b`).
  - 2026-11-12 P2: riga «Se le entrate stimate non arrivano» sotto la cifra (`ccdc8f5`); prossimi addebiti
    dell'anno divisi per mese (`1b8d046`); moduli con l'importo per primo ed errori sotto il campo (`bd9f2f1`).
  - 2026-11-15 in `main`.

### PKT-10 — L'avviso del backup porta al riquadro del backup
- **Stato:** fatto · **Chi:** Johanna
- **Storia:**
  - 2026-11-15 «Fai il backup» non faceva il backup e l'avviso restava: ora «Vai al backup» apre il riquadro nelle
    Impostazioni, dove l'avviso non compare (`8f9725d`).

### PKT-11 — Import dei tag da Excel
- **Stato:** fatto · **Chi:** Jonny, Johanna
- **Storia:**
  - 2026-11-13 tag da Settings e da One-time (`52bed8f`, Jonny).
  - 2026-11-15 colonna N letta solo con l'intestazione «TAG», colori come nell'app anche nello script Python
    (`2250894`); in `main` (`384514e`).

### PKT-12 — Progettare l'autenticazione nell'app
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** definire un meccanismo di autenticazione per l'app in linea con l'architettura di Pocketly.
- **Fatto quando:** progetto dell'autenticazione completato e documentato (requisiti, flussi, sessione/credenziali, impatti su dati locali, sync e server); eventuali attività di sviluppo aperte nel backlog.
- **Storia:**
  - 2026-11-16 aperta.

### PKT-13 — Analisi di scalabilità e progettazione dell'eventuale evoluzione
- **Stato:** fatto · **Chi:** Jonny
- **Perché:** valutare se l'app è scalabile rispetto alla crescita di dati, dispositivi e utilizzo ed eventualmente progettare la scalabilità.
- **Risultato:** analisi completa, review sul codice e specifiche tecniche operative documentate in [Analisi e Progetto di Scalabilità](architettura/scalabilita.md). Per uso personale/familiare l'architettura attuale è adeguata; per i miglioramenti e i limiti individuati è stata aperta `PKT-18` (oltre al coordinamento con `PKT-12` per il multi-tenant).
- **Fatto quando:** analisi di scalabilità completata e documentata con eventuali limiti individuati e progetto evolutivo; eventuali attività operative aperte nel backlog.
- **Storia:**
  - 2026-11-16 aperta.
  - 2026-11-17 presa in carico (`542241c`, Jonny).
  - 2026-11-17 completata nel ramo `docs/scalabilita` (Jonny): redatta [scalabilita.md](architettura/scalabilita.md) con le specifiche tecniche complete, aggiornato [README.md](README.md) e aperta `PKT-18` con link diretto all'analisi.
  - 2026-11-17 in `develop` con `5e53524` (ramo `docs/scalabilita`, commit `0c3a83e`).

### PKT-14 — Analisi di sicurezza ed eventuali fix
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** eseguire un'analisi di sicurezza dell'app (frontend, crittografia, sync, notifiche, backend e deploy) e applicare gli eventuali fix necessari.
- **Fatto quando:** analisi di sicurezza completata e documentata; eventuali fix applicati e verificati (o tracciati in attività dedicate se richiedono interventi ampi).
- **Storia:**
  - 2026-11-16 aperta.

### PKT-15 — Analisi per migliorare la struttura attuale dell'app
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** analizzare la struttura attuale dell'app per individuare possibili miglioramenti architetturali, organizzativi e di manutenibilità.
- **Fatto quando:** analisi completata e documentata con proposte concrete di miglioramento e relativi task operativi aperti nel backlog.
- **Storia:**
  - 2026-11-16 aperta.

### PKT-16 — Impostazioni divise per argomento
- **Stato:** fatto · **Priorità:** — · **Chi:** Jonny, Johanna
- **Perché:** la pagina Impostazioni è un’unica lista di riquadri (backup, sincronizzazione, notifiche, import da
  Excel, esportazione, inserimenti rapidi, categorie, metodi di pagamento, tag, lingua, aspetto, aggiornamenti,
  privacy): al telefono va scorsa a lungo per trovare una funzione, e sul PC le due colonne mescolano argomenti
  diversi. Categorie, metodi e tag sono tre liste lunghe una sotto l’altra, senza ricerca né ordine.
- **Decisione:** indice raggruppato in 4 aree + pagine figlie (`/impostazioni/:section`), con `meta.navParent: 'settings'` e selettore dell'anno nascosto nell'header (`meta.hideYear: true`):
  - *Dati e sincronizzazione:* **Dati e backup** (`/impostazioni/dati`, backup + import Excel + export Excel/CSV), **Sincronizzazione** (`/impostazioni/sincronizzazione`), **Notifiche** (`/impostazioni/notifiche`).
  - *Organizzazione:* **Categorie** (`/impostazioni/categorie`), **Metodi di pagamento** (`/impostazioni/metodi`), **Tag** (`/impostazioni/tag`), **Inserimenti rapidi** (`/impostazioni/inserimenti-rapidi`).
  - *Preferenze:* **Aspetto e lingua** (`/impostazioni/aspetto`, inclusa «Riarmonizza i colori»).
  - *App:* **Informazioni** (`/impostazioni/informazioni`, aggiornamenti + privacy).

  Su telefono e schermi `< lg`: `/impostazioni` mostra solo l'indice con righe di stato e pallini di avviso (`resolveSettingsAlert`), ogni voce apre la pagina figlia con link «← Impostazioni» nel contenuto (pattern `BreakdownDetailView`). Su PC (`>= lg`): layout master-detail a 2 colonne con indice fisso (`sticky`) a sinistra e sezione attiva a destra (`dati` predefinita su `/impostazioni`).

  Nelle pagine di categorie, metodi e tag: form inline «Aggiungi» in cima, ricerca live sempre visibile, filtri rapidi (Tutte / In uso / Non usate + ordinamento A–Z / Più usate), raggruppamento per iniziale con barra di salto su elenchi lunghi e griglia a 2 colonne su schermi larghi per evitare lo scroll infinito; conteggio utilizzi calcolato in un solo passaggio; riga pulita cliccabile che apre un `BaseModal` (foglio dal basso su mobile) per rinominare, cambiare colore o eliminare con riassegnazione. Pulsante `+` contestuale nella barra inferiore (`usePageAction`) attivo su Categorie, Metodi, Tag e Inserimenti rapidi. Collegamenti interni aggiornati (`BackupReminder`, `QuickExpenseBar`, `AppHeader`, `WelcomePanel`, `BreakdownDetailView`) con compatibilità per le vecchie ancore `#backup` e `#inserimenti-rapidi`.
- **Alternative:** schede in cima alla pagina (più semplici, ma al telefono 5-6 schede non entrano e si sommano alla
  barra in basso); riquadri che si aprono e chiudono nella stessa pagina (poco lavoro, ma la pagina resta lunga e
  non si collega a una sezione).
- **Fatto quando:** scelta la soluzione; Impostazioni divise per argomento su iPhone, Android e PC; categorie,
  metodi e tag con una pagina ciascuno, ordinati e cercabili; l'avviso del backup porta ancora al riquadro giusto;
  documentazione e mappa del codice aggiornate.
- **Storia:**
  - 2026-11-17 aperta (Johanna).
  - 2026-11-20 decisione condivisa e presa in carico (Jonny, `85faffc`).
  - 2026-11-20 implementata nel ramo `feature/pkt-16-impostazioni-per-argomento` (Jonny): registro `settingsSections.ts`, rotte `/impostazioni/:section` con redirect vecchie ancore e `meta.hideYear`, `SettingsIndex` + 3 sotto-sezioni modulari (`SettingsDataSection`, `SettingsAppearanceSection`, `SettingsAboutSection`), master-detail desktop con indice sticky, `TagManager` riprogettato con conteggio usi `O(M)` (`countTagUsage` / `finance.tagUsageCounts`), ricerca sempre visibile, filtri utilizzo, ordinamento A–Z/più usate, salto alfabetico su elenchi lunghi, griglia 2 colonne su PC e modifica/cancellazione in `BaseModal`; azione `+` contestuale (`usePageAction`), link interni e documentazione aggiornati.
  - 2026-11-20 in `develop` con `210273d` (correzioni `f5e3002` avviso del backup letto dai lettori di schermo,
    `4f168de` promemoria del backup nascosto solo sull'indice e in Dati e backup, `35f34f0` sezione non montata
    sull'indice da telefono). Da provare sui telefoni nella versione di prova di `develop`.

### PKT-17 — Categorie, metodi e tag in ordine alfabetico
- **Stato:** fatto · **Priorità:** — · **Chi:** Johanna
- **Perché:** nei menu dei moduli (spesa, entrata, ricorrente, inserimenti rapidi), nei filtri e in Impostazioni
  categorie, metodi di pagamento e tag compaiono nell’ordine in cui sono stati creati: con molte voci quella
  cercata non si trova a colpo d’occhio. Solo la pagina Budget le ordina già.
- **Come:** un solo elenco ordinato nello store (ordine alfabetico che segue la lingua dell’app, senza badare a
  maiuscole e accenti), usato da tutti i menu al posto dell’elenco grezzo. I dati salvati non cambiano, quindi
  sincronizzazione e backup non sono toccati.
- **Fatto quando:** ogni menu, filtro ed elenco mostra le voci in ordine alfabetico; un test lo verifica;
  documentazione e mappa del codice aggiornate.
- **Storia:**
  - 2026-11-17 aperta (Johanna).
  - 2026-11-17 fatta nel ramo `feature/pkt-17-ordine-alfabetico` (`e624dcf`), in `develop` con `812a0ff`:
    `finance.sortedTags` usato da menu a tendina, scelta dei tag, Impostazioni, Budget e Previsioni. I filtri dei
    tag in Spese ed Entrate restano ordinati per importo.

### PKT-18 — Implementazione piano di scalabilità (da PKT-13)
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** dare seguito ai miglioramenti e ai limiti individuati nell'analisi di scalabilità (`PKT-13`) prima che la crescita di dati o dispositivi crei rallentamenti. Vedi il piano e le specifiche tecniche complete in [Analisi e Progetto di Scalabilità](architettura/scalabilita.md).
- **Come partire:** chi prende in carico l'attività può suddividerla in sotto-task operativi a partire dalle fasi e dalle specifiche della [Sezione 4 di scalabilita.md](architettura/scalabilita.md#4-specifiche-tecniche-per-limplementazione-guida-operativa) (quick wins server/client a zero breaking changes, ricerca/liste lunghe, compressione payload cifrati, evoluzione multi-tenant coordinata con `PKT-12`).
- **Fatto quando:** gli interventi prioritari (o i rispettivi sotto-task aperti) sono implementati, testati e documentati; analisi di scalabilità aggiornata.
- **Storia:**
  - 2026-11-17 aperta da analisi PKT-13 (Jonny).

### PKT-19 — Salvadanai nella cifra della Dashboard e `csvExport.ts` (da PKT-05)
- **Stato:** da decidere · **Priorità:** bassa · **Chi:** libero
- **Perché:** due decisioni rimaste aperte da `PKT-05`, rimandate per pubblicare intanto quello che c'è.
  1. I soldi messi nei salvadanai oggi non riducono la cifra principale della Dashboard: chi mette da parte 200 €
     vede ancora quei 200 € come disponibili. Si può aggiungere una riga «di cui messi da parte» o contare il
     versamento come un'uscita. Vedi [Stato e Difetti Noti](known-issues.md) §5.
  2. `src/services/csvExport.ts` (con il suo test) non è usato dall'app: l'esportazione passa da `exportData.ts`.
     Va tolto o collegato.
- **Fatto quando:** prese le due decisioni con Jonny; fatto quello che ne segue; documentazione e mappa del codice
  aggiornate.
- **Storia:**
  - 2026-11-17 aperta da `PKT-05` (Johanna).

### PKT-20 — Barra in basso per iPhone, Android e PC con «+» che segue la pagina
- **Stato:** fatto · **Priorità:** — · **Chi:** Jonny, Johanna
- **Perché:** sul telefono il «+» stava in alto su iPhone e apriva sempre la nuova spesa, anche in Entrate o
  Prestiti; la ricerca e gli avvisi delle Impostazioni (sincronizzazione, aggiornamento, backup) non si vedevano
  dalla barra in basso.
- **Come:** sotto `md` una barra flottante con l'aspetto di ogni sistema (vetro su iPhone, Material su Android,
  barra centrata sul PC a finestra stretta), il «+» in basso dove arriva il pollice che fa l'azione della pagina
  (`usePageAction`, di serie la nuova spesa), la ricerca dentro «Altro» e un pallino su «Altro» e Impostazioni
  quando c'è un avviso (`resolveSettingsAlert`). Da `md` in su resta la barra laterale.
- **Fatto quando:** provata su iPhone, Android e PC; avvisi e messaggi non finiscono sotto la barra; lettori di
  schermo informati degli avvisi; documentazione e mappa del codice aggiornate.
- **Storia:**
  - 2026-11-18 fatta da Jonny nel ramo `feature/barra-inferiore-os` (`04456fe`).
  - 2026-11-18 revisione (Johanna) e correzioni nel ramo `fix/barra-inferiore-os`: avviso letto dai lettori di
    schermo, una sola soglia di larghezza (375 px) per il «+» che sale sopra la barra, scelta documentata del «+»
    dell'intestazione da `md` in su (sempre nuova spesa).
  - 2026-11-18 in `develop` con `b40e398` (correzioni `7cf6550`, `aa7c31e`, `2fc592a`). Da provare sui telefoni
    nella versione di prova di `develop`.

### PKT-21 — Scelta dei tag nel modulo con ricerca o menu a tendina
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** nel modulo di spese ed entrate (`TagInput`, usato da `TransactionForm` e `QuickExpenseForm`) tutti i
  tag non scelti compaiono come pillole sotto il campo. Con tanti tag l'elenco diventa lungo, spinge in basso il
  resto del modulo e quello cercato non si trova a colpo d'occhio. Categoria e metodo di pagamento invece si
  scelgono da un menu a tendina.
- **Come:** un solo campo che cerca e crea. Scrivendo, sotto compare un menu a tendina con i tag che corrispondono
  (in ordine alfabetico, senza badare a maiuscole e accenti, come `PKT-17`); si sceglie con il tocco o con frecce e
  Invio; se il nome non esiste la prima voce è «Crea #nome». A campo vuoto il menu mostra pochi tag (i più usati o
  gli ultimi), non tutti. I tag scelti restano pillole con la ✕ sopra il campo. Da provare la tastiera del telefono
  (il menu non deve finire sotto la tastiera) e il lettore di schermo (combobox con elenco di opzioni).
- **Alternative:** menu a tendina a scelta multipla come per le categorie (semplice, ma con molti tag è di nuovo un
  elenco lungo e non si crea un tag nuovo); lasciare le pillole e aggiungere solo un campo per filtrarle (poco
  lavoro, ma il modulo resta lungo finché non si scrive).
- **Fatto quando:** scelta la soluzione; nel modulo i tag si cercano, si scelgono e si creano dallo stesso campo su
  iPhone, Android e PC; un test sul filtro; documentazione e mappa del codice aggiornate.
- **Storia:**
  - 2026-11-19 aperta (Johanna).

### PKT-22 — Sezione Patrimonio: monitoraggio e analisi del patrimonio
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** introdurre il monitoraggio e l'analisi completa del patrimonio (`Attività − Passività = Patrimonio Netto`) con un modello ibrido: conti liquidi collegati ai metodi di pagamento (saldo iniziale + flussi + giroconti + «Allinea saldo»), investimenti/beni/passività aggiornati a valutazioni periodiche e giroconti, integrazione senza doppi conteggi con Prestiti (`Loan`) e Salvadanai (`SavingsGoal`), serie storica con grafico SVG leggero senza dipendenze esterne, riquadro sintetico in Dashboard, Omnisearch ed export XLSX/CSV. Assorbe ed estende `PKT-07` e si coordina con `PKT-19` per la lettura della liquidità libera vs accantonata.
- **Come partire:** tutte le specifiche tecniche, il modello matematico, l'elenco file per file e la checklist di verifica sono salvati in [Progetto e Piano Implementativo: Sezione Patrimonio](architettura/patrimonio.md). Prima di scrivere codice, aprire un ramo dedicato (es. `feature/patrimonio`), confermare il posizionamento in `TABS` (menu «Altro» su mobile / sidebar su desktop) e considerare il salto a `CURRENT_SCHEMA_VERSION = 4`.
- **Fatto quando:** modello dati v4, migrazione, merge 3-vie, logica pura `wealth.ts`, vista `PatrimonyView.vue`, grafico storico SVG, card Dashboard, integrazione Prestiti/Omnisearch/Export, traduzioni `it`/`en` e documentazione aggiornati; `npm run test`, `npm run typecheck`, `npm run test:server`, `npm run build` e `npm run docs:check` tutti verdi; verifica visiva su tutte le 6 combinazioni piattaforma × tema.
- **Storia:**
  - 2026-11-19 aperta: analisi condivisa e piano implementativo completo salvato in [architettura/patrimonio.md](architettura/patrimonio.md).
