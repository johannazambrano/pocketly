---
source-files: []
verified: 2026-11-26
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
| PKT-12 | Progettare l'autenticazione nell'app | fatto | — | Jonny |
| PKT-13 | Analisi di scalabilità e progettazione dell'eventuale evoluzione | fatto | — | Jonny |
| PKT-14 | Analisi di sicurezza ed eventuali fix | in corso | media | Johanna |
| PKT-15 | Analisi per migliorare la struttura attuale dell'app | fatto | — | Jonny |
| PKT-16 | Impostazioni divise per argomento | fatto | — | Jonny, Johanna |
| PKT-17 | Categorie, metodi e tag in ordine alfabetico | fatto | — | Johanna |
| PKT-18 | Implementazione piano di scalabilità (da PKT-13) | da fare | media | libero |
| PKT-19 | Salvadanai nella cifra della Dashboard e `csvExport.ts` (da PKT-05) | fatto | — | Johanna |
| PKT-20 | Barra in basso per iPhone, Android e PC con «+» che segue la pagina | fatto | — | Jonny, Johanna |
| PKT-21 | Scelta dei tag nel modulo con ricerca o menu a tendina | fatto | — | Johanna |
| PKT-22 | Sezione Patrimonio: monitoraggio e analisi del patrimonio | da fare | media | libero |
| PKT-23 | Nascondere gli importi con un tocco | idea da decidere | bassa | libero |
| PKT-24 | Scegliere cosa mostrare nella Dashboard | idea da decidere | bassa | libero |
| PKT-25 | Implementazione autenticazione Zero-Knowledge e blocco locale (da PKT-12) | in corso | media | Jonny |
| PKT-25.1 | [Fase A] Primitive crittografiche client e cifratura IndexedDB at-rest | da fare | media | libero |
| PKT-25.2 | [Fase A] Store blocco locale, auto-lock, `LockScreen` e privacy screen | da fare | media | libero |
| PKT-25.3 | [Fase A] Impostazioni Sicurezza (`/impostazioni/sicurezza`) e notifiche discrete | da fare | media | libero |
| PKT-25.4 | [Fase B1] Storage server SQLite WAL multi-tenant e migrazione JSON legacy | da fare | media | libero |
| PKT-25.5 | [Fase B1] Motore auth server, sessioni `HttpOnly` revocabili, API v2 e CLI admin | da fare | media | libero |
| PKT-25.6 | [Fase B1] Envelope Encryption client (`vaultDEK`, Recovery Key), policy password e client API | da fare | media | libero |
| PKT-25.7 | [Fase B1] UI Account, registrazione 2-step, gestione dispositivi/admin e deploy Proxmox | da fare | media | libero |
| PKT-25.8 | [Fase B2] Crittografia condivisione ECDH P-256, Safety Fingerprint e API membri/inviti | da fare | media | libero |
| PKT-25.9 | [Fase B2] Storage IndexedDB multi-vault, selettore archivio e UI condivisione famiglia | da fare | media | libero |
| PKT-26 | Blocco scroll e viewport delle modali su iPhone | fatto | — | Jonny |
| PKT-27 | Implementazione piano di miglioramento strutturale e manutenibilità (da PKT-15) | da fare | media | libero |
| PKT-28 | Interazione nativa PWA, long press e animazioni OS-adattive | da fare | media | libero |

Stati possibili: `da fare`, `in corso`, `in attesa di …`, `idea da decidere`, `fatto nel ramo, da unire`, `fatto`, `annullato`.

## Come si usa

I rami di lavoro si uniscono in **`develop`**; `main` riceve `develop` quando si pubblica (è il ramo che
`update.sh` porta sul server).

1. **Le attività non si spostano.** Restano in ordine di numero; cambia solo la riga `Stato` (e la stessa riga
   del riepilogo). Spostare blocchi tra sezioni fa andare in conflitto i rami che toccano il file insieme.
2. **Nuova attività:** il numero successivo (`PKT-12`, `PKT-13`…), una riga nel riepilogo e un blocco qui sotto
   con `Stato`, `Perché`, `Fatto quando` e `Storia`. Se un'attività ampia viene scomposta in sotto-attività, i figli
   usano la forma `PKT-XX.1`, `PKT-XX.2`… e stanno subito sotto il padre (nel riepilogo e come sotto-intestazioni
   `####` nel corpo), così non occupano nuovi numeri del contatore globale. Per un difetto già descritto in
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
- **Stato:** fatto · **Chi:** Jonny
- **Perché:** definire un meccanismo di autenticazione per l'app in linea con l'architettura di Pocketly.
- **Risultato:** progetto completo e piano implementativo a 3 fasi documentati in [Progetto e Piano Implementativo: Autenticazione](architettura/autenticazione.md) (blocco locale con cifratura IndexedDB at-rest incluso `SyncState.base`, Master Password unica Zero-Knowledge con envelope encryption `vaultDEK` e Recovery Key, piena compatibilità password manager e WebAuthn PRF, account su invito/admin con sessioni `HttpOnly` revocabili su SQLite WAL coordinato con `PKT-13`/`PKT-18`, archivi condivisi coppia/famiglia via ECDH P-256). Aperta l'attività operativa `PKT-25`.
- **Fatto quando:** progetto dell'autenticazione completato e documentato (requisiti, flussi, sessione/credenziali, impatti su dati locali, sync e server); eventuali attività di sviluppo aperte nel backlog.
- **Storia:**
  - 2026-11-16 aperta.
  - 2026-11-20 analisi condivisa e progetto completato (Jonny): redatta [autenticazione.md](architettura/autenticazione.md), aggiornati [README.md](README.md) e [scalabilita.md](architettura/scalabilita.md), aperta `PKT-25` con link diretto al piano implementativo.

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
- **Stato:** in corso · **Priorità:** media · **Chi:** Johanna
- **Perché:** eseguire un'analisi di sicurezza dell'app (frontend, crittografia, sync, notifiche, backend e deploy) e applicare gli eventuali fix necessari.
- **Fatto quando:** analisi di sicurezza completata e documentata; eventuali fix applicati e verificati (o tracciati in attività dedicate se richiedono interventi ampi).
- **Storia:**
  - 2026-11-16 aperta.
  - 2026-11-23 presa in carico (Johanna).

### PKT-15 — Analisi per migliorare la struttura attuale dell'app
- **Stato:** fatto · **Chi:** Jonny
- **Perché:** analizzare la struttura attuale dell'app per individuare possibili miglioramenti architetturali, organizzativi e di manutenibilità.
- **Risultato:** analisi empirica completa e strategia implementativa incrementale a 3 fasi documentate in [Analisi e Piano di Miglioramento Strutturale](architettura/struttura-e-manutenibilita.md) (deduplicazione `OneTimeView`/`IncomeView` e servizi condivisi, guardia idempotente `finance.init()`, scomposizione modulare di `DashboardView`, `BudgetView`, `notifications.ts`, `finance.ts`, `calculations.ts` e `style.css`, estensione `docs-check.mjs`, split del package backend `server/` e test su composables/store/servizi scoperti; coordinata con `PKT-14`, `PKT-18`, `PKT-22`, `PKT-24` e `PKT-25`). Aperta l'attività operativa `PKT-27`.
- **Fatto quando:** analisi completata e documentata con proposte concrete di miglioramento e relativi task operativi aperti nel backlog.
- **Storia:**
  - 2026-11-16 aperta.
  - 2026-11-24 presa in carico (`d4e51bb`, Jonny).
  - 2026-11-24 analisi e strategia implementativa completate (Jonny): redatta [struttura-e-manutenibilita.md](architettura/struttura-e-manutenibilita.md), aggiornato [README.md](README.md) e aperta `PKT-27` con link diretto al piano implementativo.

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
  - 2026-11-20 `develop` portato in `main` con `2c25946`. Vercel ripubblica `main` da solo; resta `update.sh` sul
    container. Il formato dei dati resta il 3, quindi i telefoni non devono aggiornarsi per sincronizzare.

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
- **Stato:** fatto · **Priorità:** — · **Chi:** Johanna
- **Perché:** due decisioni rimaste aperte da `PKT-05`, rimandate per pubblicare intanto quello che c'è.
  1. I soldi messi nei salvadanai oggi non riducono la cifra principale della Dashboard: chi mette da parte 200 €
     vede ancora quei 200 € come disponibili. Si può aggiungere una riga «di cui messi da parte» o contare il
     versamento come un'uscita. Vedi [Stato e Difetti Noti](known-issues.md) §5.
  2. `src/services/csvExport.ts` (con il suo test) non è usato dall'app: l'esportazione passa da `exportData.ts`.
     Va tolto o collegato.
- **Decisione (Johanna, Jonny, 2026-11-20):**
  1. I soldi nei salvadanai sono messi da parte apposta per non usarli: se restano nella cifra grande si rischia di
     farci affidamento. Nella cifra grande della Dashboard («Risultato di …», «Risultato a oggi», «Risultato
     dell'anno») i versamenti nei salvadanai contano come uscite e i prelievi come entrate; contano solo i movimenti
     già fatti. Il confronto con la media dei mesi precedenti usa la stessa regola anche sugli altri mesi. Il
     dettaglio per categoria e per metodo di pagamento resta delle sole spese (i versamenti non hanno categoria);
     previsioni, Budget e formato dei dati non cambiano.
     Sotto la cifra una riga, solo se c'è almeno un salvadanaio attivo, che porta a Budget → Salvadanai:
     ```
     Risultato di novembre
     +300 €
     200 € nei salvadanai · consigliati 350 € questo mese  ›
     ```
     La quota è la «quota mensile consigliata» che l'app calcola già (`savingsSummary`); raggiunta la quota la riga
     lo dice («in linea»). Niente riquadro nuovo nella Dashboard. Da aggiornare anche
     [Stato e Difetti Noti](known-issues.md) §5.
  2. `csvExport.ts` si toglie: l'esportazione per sezioni di `exportData.ts` copre già tutto.
- **Fatto quando:** prese le due decisioni con Jonny; fatto quello che ne segue; documentazione e mappa del codice
  aggiornate.
- **Storia:**
  - 2026-11-17 aperta da `PKT-05` (Johanna).
  - 2026-11-20 prese le due decisioni con Jonny (vedi **Decisione**); presa in carico (Johanna). `csvExport.ts`
    tolto nel ramo `chore/togli-csv-export` (`38da887`).
  - 2026-11-20 `csvExport.ts` tolto in `develop` con `b1daf55`. Resta la parte dei salvadanai.
  - 2026-11-23 parte dei salvadanai fatta nel ramo `feature/pkt-19-salvadanai-dashboard` (Johanna): `savedBetween`
    in `savings.ts`; risultato, previsto e media dei mesi precedenti al netto dei salvadanai; riga sotto la cifra
    che porta a Budget → Salvadanai, con la quota consigliata nel mese in corso e «in linea» quando è raggiunta.
    Provata su iPhone, Android e PC. Per un mese passato o per l'anno la riga dice solo quanto è andato nei
    salvadanai; per un mese futuro solo la quota.
  - 2026-11-23 in `develop` con `511cdc9` (commit `34f3e03`). Da provare sui telefoni nella versione di prova di
    `develop`.
  - 2026-11-23 corretto nel ramo `fix/pkt-19-verdetto-mese` (Johanna): per un mese passato la frase «meglio/peggio
    della media» confrontava il risultato senza togliere i salvadanai del mese con una media che li toglieva; ora
    `balanceVsAverage` li toglie da tutte e due le parti. Nello stesso ramo, fuori da `PKT-19`: sulla Dashboard il
    messaggio «nessun addebito in arrivo» compariva anche sotto un elenco corto di prossimi addebiti.
  - 2026-11-23 in `develop` con `b9e1a09`; `develop` portato in `main` con `a3a072e` (Johanna).

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
- **Stato:** fatto · **Priorità:** — · **Chi:** Johanna
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
  - 2026-11-20 scelta la soluzione del campo unico che cerca e crea, con l'elenco dentro il modulo (Johanna).
    In `develop` con `040c0b7` (`29b3649` `suggestTags` con i test, `f0e55d5` nuovo `TagInput`): a campo vuoto i 6
    tag più usati, scrivendo quelli che corrispondono senza badare a maiuscole e accenti, «Crea #nome» se il nome
    non esiste; tag scelti come pillole sotto il campo. Da provare sui telefoni nella versione di prova di `develop`.
  - 2026-11-23 `develop` portato in `main` con `a3a072e` (Johanna).

### PKT-22 — Sezione Patrimonio: monitoraggio e analisi del patrimonio
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** introdurre il monitoraggio e l'analisi completa del patrimonio (`Attività − Passività = Patrimonio Netto`) con un modello ibrido: conti liquidi collegati ai metodi di pagamento (saldo iniziale + flussi + giroconti + «Allinea saldo»), investimenti/beni/passività aggiornati a valutazioni periodiche e giroconti, integrazione senza doppi conteggi con Prestiti (`Loan`) e Salvadanai (`SavingsGoal`), serie storica con grafico SVG leggero senza dipendenze esterne, riquadro sintetico in Dashboard, Omnisearch ed export XLSX/CSV. Assorbe ed estende `PKT-07` e si coordina con `PKT-19` per la lettura della liquidità libera vs accantonata.
- **Come partire:** tutte le specifiche tecniche, il modello matematico, l'elenco file per file e la checklist di verifica sono salvati in [Progetto e Piano Implementativo: Sezione Patrimonio](architettura/patrimonio.md). Prima di scrivere codice, aprire un ramo dedicato (es. `feature/patrimonio`), confermare il posizionamento in `TABS` (menu «Altro» su mobile / sidebar su desktop) e considerare il salto a `CURRENT_SCHEMA_VERSION = 4`.
- **Fatto quando:** modello dati v4, migrazione, merge 3-vie, logica pura `wealth.ts`, vista `PatrimonyView.vue`, grafico storico SVG, card Dashboard, integrazione Prestiti/Omnisearch/Export, traduzioni `it`/`en` e documentazione aggiornati; `npm run test`, `npm run typecheck`, `npm run test:server`, `npm run build` e `npm run docs:check` tutti verdi; verifica visiva su tutte le 6 combinazioni piattaforma × tema.
- **Storia:**
  - 2026-11-19 aperta: analisi condivisa e piano implementativo completo salvato in [architettura/patrimonio.md](architettura/patrimonio.md).

### PKT-23 — Nascondere gli importi con un tocco
- **Stato:** idea da decidere · **Priorità:** bassa · **Chi:** libero
- **Perché:** idea di Jonny (2026-11-20). Chi apre l'app in pubblico o la mostra a qualcuno non vuole che si
  leggano le cifre.
- **Come (da decidere):** un tasto (es. l'icona dell'occhio nell'intestazione) che copre gli importi con «••••» in
  tutta l'app finché non lo si tocca di nuovo; la scelta resta salvata sul dispositivo. Da decidere se vale per
  tutte le cifre o solo per quelle della Dashboard, e cosa leggono i lettori di schermo («importo nascosto»).
- **Fatto quando:** decisa la soluzione; gli importi si nascondono e si mostrano su iPhone, Android e PC;
  documentazione e mappa del codice aggiornate.
- **Storia:**
  - 2026-11-20 aperta dall'idea di Jonny (Johanna).

### PKT-24 — Scegliere cosa mostrare nella Dashboard
- **Stato:** idea da decidere · **Priorità:** bassa · **Chi:** libero
- **Perché:** idea di Jonny (2026-11-20). Non a tutti servono gli stessi blocchi: chi non usa i salvadanai o gli
  inserimenti rapidi vorrebbe una Dashboard più corta.
- **Come (da decidere):** in Impostazioni → Aspetto un elenco dei blocchi della Dashboard (riga dei salvadanai di
  `PKT-19`, inserimenti rapidi, prossimi addebiti, categorie, metodi di pagamento) con un interruttore ciascuno; la
  cifra principale resta sempre. Da decidere se la scelta vale per il dispositivo o si sincronizza.
- **Fatto quando:** decisa la soluzione; i blocchi si accendono e si spengono su iPhone, Android e PC;
  documentazione e mappa del codice aggiornate.
- **Storia:**
  - 2026-11-20 aperta dall'idea di Jonny (Johanna).

### PKT-25 — Implementazione autenticazione Zero-Knowledge e blocco locale (da PKT-12)
- **Stato:** in corso · **Priorità:** media · **Chi:** Jonny
- **Perché:** implementare l'autenticazione progettata in `PKT-12` (blocco locale opzionale con cifratura IndexedDB at-rest, Master Password unica Zero-Knowledge con compatibilità password manager, account su invito/admin con sessioni revocabili su SQLite WAL e archivi condivisi coppia/famiglia). Tutte le specifiche crittografiche, le API, lo schema SQLite e i contratti HTML per password manager sono documentati in [Progetto e Piano Implementativo: Autenticazione](architettura/autenticazione.md). Copre inoltre i punti rimandati dall'analisi di sicurezza `PKT-14` (punto 3: dati locali in chiaro in Fase A; punto 4: sincronizzazione solo con account registrato e policy robustezza Master Password in Fase B1) e realizza la Fase 3 di `PKT-18` (storage SQLite WAL multi-tenant).
- **Sotto-task operativi:** attività ombrello scomposta in 9 sotto-task sequenziali e rilasciabili (dettaglio nella [Sezione 7 di autenticazione.md](architettura/autenticazione.md#7-piano-implementativo-a-3-fasi-guida-operativa-per-pkt-25)):
  - **Fase A (solo frontend, offline-first, rilasciabile subito):** `PKT-25.1` (crypto + `localVault` + cifratura IndexedDB at-rest + `finance.init()` idempotente), `PKT-25.2` (`useAuthStore` + boot + auto-lock + `LockScreen` + privacy screen), `PKT-25.3` (`/impostazioni/sicurezza` + notifiche discrete).
  - **Fase B1 (account Zero-Knowledge, sessioni revocabili, SQLite WAL):** `PKT-25.4` (storage SQLite WAL + migrazione JSON legacy, realizza `PKT-18` Fase 3), `PKT-25.5` (`server/auth.py`, sessioni `HttpOnly` revocabili, API v2 e CLI admin), `PKT-25.6` (Envelope Encryption `vaultDEK`, Recovery Key, policy Master Password e client API auth/sync/push), `PKT-25.7` (UI Account, registrazione 2-step, gestione dispositivi/admin, migrazione guidata legacy e deploy Proxmox).
  - **Fase B2 (archivi condivisi coppia/famiglia ECDH P-256):** `PKT-25.8` (crittografia ECDH P-256, Safety Fingerprint e API inviti/rotazione membri), `PKT-25.9` (IndexedDB namespaced per vault, switch archivio e UI condivisione famiglia).
- **Fatto quando:** tutti i sotto-task `PKT-25.1`–`PKT-25.9` sono completati, coperti da test client e server, verificati con password manager e sulle 6 combinazioni piattaforma × tema, con `mappa-codice.md` e documentazione aggiornati e `npm run test`, `npm run typecheck`, `npm run test:server`, `npm run build` e `npm run docs:check` tutti verdi.
- **Storia:**
  - 2026-11-20 aperta da progetto PKT-12 (Jonny), collegata a [architettura/autenticazione.md](architettura/autenticazione.md).
  - 2026-11-25 presa in carico nel ramo `feature/pkt-25-autenticazione` (Jonny) e scomposta in 9 sotto-task operativi (`PKT-25.1`–`PKT-25.9`) allineati con le 3 fasi di [autenticazione.md](architettura/autenticazione.md), i punti 3–4 di `PKT-14` e la Fase 3 di `PKT-18`.

#### PKT-25.1 — [Fase A] Primitive crittografiche client e cifratura IndexedDB at-rest
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** nessuna (parte di `PKT-25`; copre il punto 3 di `PKT-14`; si coordina con `PKT-27` §4.2–4.3 per Base64 condiviso e `finance.init()` idempotente).
- **Perché:** oggi `deviceDataStore` (`src/services/storage.ts`) salva `'finance-data'` e `useSyncStore` (`src/stores/sync.ts`) salva `SyncState.base` in chiaro in IndexedDB; inoltre `useFinanceStore.init()` registra watcher e listener ad ogni chiamata senza guardia di idempotenza né reset pulito. Serve lo strato puro crittografico e di persistenza cifrata at-rest prima di collegare il flusso di blocco/sblocco UI.
- **Come partire:** seguire [autenticazione.md §4.1](architettura/autenticazione.md#41-cifratura-at-rest-di-indexeddb-srcserviceslocalvaultts-srcservicesstoragets):
  - Creare `src/services/authCrypto.ts`: helper Web Crypto (`PBKDF2-SHA-256` 600.000 iter con normalizzazione NFC, `HKDF-SHA-256` con separazione domini, generazione e wrap/unwrap AES-256-GCM 256 bit di `localDataKey`, wrapper PIN 6+ cifre, helper rilevamento/valutazione WebAuthn PRF con verifica `getClientExtensionResults()?.prf?.enabled`).
  - Creare `src/services/localVault.ts`: envelope `EncryptedLocalRecord { format: 'pocketly-local-encrypted', version: 1, iv, data }`, cifratura/decifratura con AAD dedicati (`"pocketly-local-v1:finance-data"`, `"pocketly-local-v1:sync-base"`) e migrazione atomica chiaro ↔ cifrato.
  - Integrare in modo trasparente `localVault` in `src/services/storage.ts` (a blocco spento resta tutto identico; `readStoredDataRaw()` resta intatto per `LoadErrorScreen`) e in `src/stores/sync.ts` (cifratura `SyncState.base`, pausa/ripresa trigger).
  - Rendere `useFinanceStore.init()` idempotente e aggiungere `resetForLock()` in `src/stores/finance.ts` (azzera `data`, imposta `ready = false`, ferma timer/watcher/listener senza duplicarli al successivo sblocco).
- **Fatto quando:** test unitari verdi per `authCrypto.test.ts`, `localVault.test.ts`, `storage.ts` (chiaro, cifrato, record corrotto con `readStoredDataRaw` e `NewerFormatError`) e idempotenza/reset di `finance.ts`; `mappa-codice.md` e `dati-e-sincronizzazione.md` aggiornati; `npm run test`, `npm run typecheck`, `npm run test:server`, `npm run build` e `npm run docs:check` tutti verdi.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.2 — [Fase A] Store blocco locale, auto-lock, `LockScreen` e privacy screen
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** `PKT-25.1`.
- **Perché:** orchestrare il ciclo di vita di avvio/blocco/sblocco senza mai caricare `FinanceData` in RAM finché l'app è bloccata, offrendo una schermata di sblocco compatibile con i password manager, con biometria WebAuthn PRF e con PIN locale isolato, più la protezione delle miniature nello switcher app di iOS/Android.
- **Come partire:** seguire [autenticazione.md §4.2–4.3](architettura/autenticazione.md#42-ciclo-di-vita-avvio-auto-lock-e-notifiche-discrete):
  - Creare `src/stores/auth.ts`: stato reattivo (`localLockEnabled`, `locked`, metodi abilitati, timeout auto-lock), persistenza di `'auth-local-config'` in IndexedDB, azioni `init()`, `unlock()` (passphrase / WebAuthn PRF / PIN con contatore errori max 5 e distruzione automatica del wrapper PIN), `lock()` (azzeramento `localDataKey` in RAM, `finance.resetForLock()`, pausa `sync`, chiusura modali/Omnisearch) e timer auto-lock (`Immediato`, `1 min`, `5 min`, `15 min`, `Solo manuale`) + `visibilitychange`.
  - Aggiornare `src/main.ts` e `src/App.vue`: boot condizionato a `useAuthStore().init()` (nessuna vista, `SearchModal` o `BackupReminder` montati finché `locked === true`) e **Privacy Screen** opaco su `document.visibilityState === 'hidden'` quando il blocco è attivo.
  - Creare `src/components/LockScreen.vue`: solo gettoni semantici di `src/style.css` sulle 6 combinazioni piattaforma × tema; contratto HTML password manager per passphrase (`autocomplete="username"` `sr-only` + `autocomplete="current-password"`) e isolamento PIN (`type="text" inputmode="numeric" autocomplete="off"`, `-webkit-text-security: disc`, `data-1p-ignore`, `data-bwignore="true"`, `data-lpignore="true"`).
  - Aggiungere le chiavi tradotte in `src/i18n/it.ts` e `src/i18n/en.ts`.
- **Fatto quando:** `src/stores/auth.test.ts` copre avvio sbloccato/bloccato, unlock con passphrase/PIN/PRF, blocco e distruzione PIN dopo 5 errori, auto-lock e azzeramento RAM; verifica visiva di `LockScreen` e privacy screen sulle 6 combinazioni piattaforma × tema; `mappa-codice.md`, `frontend.md` e `componenti-e-viste.md` aggiornati; tutta la checklist di controllo (`test`, `typecheck`, `test:server`, `build`, `docs:check`) verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.3 — [Fase A] Impostazioni Sicurezza (`/impostazioni/sicurezza`) e notifiche discrete
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** `PKT-25.2`.
- **Perché:** consentire a chi usa Pocketly di attivare, configurare e disattivare il blocco locale da una sezione dedicata delle Impostazioni e proteggere la privacy anche nelle notifiche di sistema nascondendo importi e descrizioni. Completa e rende rilasciabile l'intera **Fase A** (100% offline-first, inclusa la build su Vercel).
- **Come partire:** seguire [autenticazione.md §4.2 e §7 Fase A](architettura/autenticazione.md#fase-a--blocco-locale-dellapp-e-cifratura-indexeddb-at-rest-solo-frontend):
  - Registrare la sezione `'sicurezza'` in `src/utils/settingsSections.ts`, `src/router/index.ts`, `src/views/SettingsView.vue` e `src/components/settings/SettingsIndex.vue` (aggiornando `src/utils/settingsSections.test.ts` e riga di stato live).
  - Creare `src/components/settings/SettingsSecuritySection.vue`: attivazione/disattivazione blocco locale (migrazione cifrata/in chiaro di `'finance-data'` e `SyncState.base`), cambio passphrase, gestione biometria WebAuthn PRF (con rilevamento supporto e nota sull'hostname Proxmox) e PIN locale (con avviso chiaro sul modello di sicurezza), scelta timeout auto-lock e pulsante «Blocca ora».
  - Aggiungere l'opzione booleana `discreet` in `NotificationConfig` (`src/stores/notifications.ts`, `src/domain/notifications.ts`, `src/components/NotificationSettings.vue`) per emettere testi generici senza importi né descrizioni sia nelle notifiche locali sia nei payload Web Push cifrati.
  - Allineare `src/i18n/it.ts` e `src/i18n/en.ts`, aggiornare documentazione (`mappa-codice.md`, `frontend.md`, `componenti-e-viste.md`, `NOTIFICHE.md`, `guide/test-utente.md`).
- **Fatto quando:** flusso completo attiva → blocca → sblocca → cambia metodo → disattiva e notifiche discrete testati (unitari + 6 combinazioni piattaforma × tema); tutta la checklist (`test`, `typecheck`, `test:server`, `build`, `docs:check`) verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.4 — [Fase B1] Storage server SQLite WAL multi-tenant e migrazione JSON legacy
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** nessuna bloccante sul frontend (realizza anche la **Fase 3 di `PKT-18`** definita in [scalabilita.md §4.5](architettura/scalabilita.md#45-schema-sqlite-multi-tenant-fase-3-coordinata-con-pkt-12--pkt-25); coordinata con la modularizzazione di `server/` in `PKT-27` §4.7).
- **Perché:** l'attuale backend (`server/main.py`) usa file JSON single-tenant (`current.json`, `history/v*.json`, `push.json`), incompatibili con account multi-utente, sessioni revocabili, isolamento per archivio (`vault_id`) e query indicizzate sui promemoria push.
- **Come partire:** seguire [autenticazione.md §5.2 e §6.1](architettura/autenticazione.md#52-schema-sqlite-wal-unificato-con-scalabilitamd-45):
  - Creare `server/db.py` (solo libreria standard Python 3.9+ `sqlite3`, `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`) su `POCKETLY_DATA_DIR/pocketly.db` con lo schema completo: `users`, `invites`, `password_resets`, `sessions`, `vaults`, `vault_members`, `vault_invites`, `sync_state`, `sync_history` (retention `HISTORY_KEEP = 30` per vault), `push_meta`, `push_devices`, `push_schedule` (con indice su `fire_at`) e `push_sent`.
  - Implementare la migrazione automatica zero-data-loss da `current.json`, `history/v*.json` e `push.json`, archiviando i file legacy in `.migrated` / `history-legacy/` senza mai cancellarli.
  - Adattare gli store sync e push di `server/main.py` al backend SQLite mantenendo invariato il comportamento degli endpoint esistenti fino all'introduzione delle API v2 (`PKT-25.5`).
- **Fatto quando:** tutti i test esistenti in `server/test_main.py` restano verdi e nuovi test Python coprono schema, vincoli FK, concorrenza WAL, isolamento per `vault_id`, retention storico/push e migrazione idempotente da JSON legacy; `mappa-codice.md`, `backend.md` e `scalabilita.md` aggiornati; tutta la checklist di controllo verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.5 — [Fase B1] Motore auth server, sessioni `HttpOnly` revocabili, API v2 e CLI admin
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** `PKT-25.4`.
- **Perché:** sostituire l'unica chiave statica `POCKETLY_SYNC_KEY` con account su invito, verifica Zero-Knowledge (`scrypt`), sessioni per dispositivo revocabili immediatamente (cookie `HttpOnly` con rotazione + Access Token breve) e API `/api/vaults/{vaultId}/*`.
- **Come partire:** seguire [autenticazione.md §5.1, §5.3, §6.1–6.2](architettura/autenticazione.md#51-sessioni-revocabili-cookie-httponly-con-rotazione--access-token-in-ram):
  - Creare `server/auth.py`: normalizzazione/validazione `username`, `hashlib.scrypt` (`n=16384, r=8, p=1, dklen=32`) + `hmac.compare_digest`, salt sintetico anti-enumerazione `HMAC-SHA256(server_pepper, username)[:16]`, Access Token breve (15 min) firmato `HMAC-SHA256` (`POCKETLY_TOKEN_SECRET`) con cache in memoria delle sessioni revocate, Refresh Token 256 bit in cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` (30 gg sliding) con rotazione e revoca dell'intera `token_family` su reuse, protezione CSRF (`X-Pocketly-Client: 1` + verifica `Origin`/`Host`), rate limiting a doppio asse (IP su loopback + `username`) con pruning automatico (`scalabilita.md` §4.1).
  - Aggiungere in `server/main.py` gli endpoint API v2: `GET /api/health` (`api: 2`, `authMode: "accounts" | "legacy"`), `POST /api/auth/{params,register,login,refresh,logout,change-password,recover}`, `GET/DELETE /api/sessions`, `GET/POST /api/admin/invites`, `POST /api/admin/password-resets`, `GET/POST /api/vaults`, `GET/PUT /api/vaults/{vaultId}/sync` (accettando `EncryptedBackup` v1 e v2 con `compression: 'gzip'` opzionale), `/api/vaults/{vaultId}/push/*`, modalità transitoria `legacy` → `accounts` (`410 Gone` sui vecchi endpoint dopo la migrazione) e log sanitizzati (`Handler.log_message` privo di username, token, cookie o codici invito).
  - Aggiungere `server/cli.py` (o subcommand CLI in `server/main.py`) per bootstrap admin e operazioni self-hosted (`--create-invite --admin`, `--create-reset <username>`).
- **Fatto quando:** test Python completi (registrazione con invito, login, salt anti-enumerazione, refresh rotation + reuse family revocation, CSRF, revoca immediata sessione + rimozione push del dispositivo, rate limiting IP+username, isolamento tra vault, dual-mode `legacy`/`accounts` e `410 Gone`); `mappa-codice.md` e `backend.md` aggiornati; tutta la checklist di controllo verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.6 — [Fase B1] Envelope Encryption client (`vaultDEK`, Recovery Key), policy password e client API
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** `PKT-25.1`, `PKT-25.5` (si coordina con `PKT-27` §4.2 per il client condiviso `src/services/http.ts` e con il punto 4 di `PKT-14` per lunghezza minima e robustezza della Master Password).
- **Perché:** introdurre sul frontend la crittografia Zero-Knowledge ad envelope (`Master Password` → `authKey` ⊥ `masterEncKey` → `vaultDEK` + Recovery Key) e collegare gli store `auth`, `sync` e `notifications` alle API v2 con Access Token solo in RAM e refresh trasparente offline-first.
- **Come partire:** seguire [autenticazione.md §3.1–3.2 e §7 Fase B1](architettura/autenticazione.md#3-modello-crittografico-zero-knowledge-envelope-encryption):
  - Estendere `src/services/authCrypto.ts` e `src/services/backupCrypto.ts`: derivazione `PBKDF2` → `HKDF` (`authKey` + `masterEncKey` non estraibile), coppia ECDH P-256 utente (`encrypted_private_key` con `AAD = "pocketly-privkey-v1:<userId>"`), `vaultDEK` (AES-256-GCM 256 bit), formato `EncryptedBackup` v2 con `AAD = "pocketly-vault:<vaultId>:v2"` (retrocompatibile in lettura con backup v1 e predisposto a `compression: 'gzip'` di `PKT-18` §4.4), generazione/decifratura **Recovery Key** Base32 (`PKLY-...`) con bundle `{ privateKey, personalVaultDEK }`, e validazione lunghezza minima / robustezza Master Password (punto 4 di `PKT-14`).
  - Creare `src/services/auth/api.ts` (con `credentials: 'same-origin'` e header `X-Pocketly-Client: 1`) per `/api/auth/*`, `/api/sessions/*`, `/api/admin/*`, `/api/vaults/*`.
  - Aggiornare `src/stores/auth.ts`, `src/services/sync/api.ts`, `src/services/sync/engine.ts`, `src/stores/sync.ts`, `src/services/notifications/api.ts` e `src/stores/notifications.ts`: Access Token solo in RAM, refresh trasparente su `401` senza errori in modalità offline, sync e push su `/api/vaults/{vaultId}/*` cifrati con `vaultDEK`, mantenendo la sola transizione guidata dal vecchio sync legacy verso il primo account.
- **Fatto quando:** test unitari coprono separazione `authKey` ⊥ `masterEncKey`, envelope `vaultDEK` v2 + lettura v1, Recovery Key round-trip, cambio Master Password senza ricifratura storico, policy robustezza password, refresh trasparente su `401` e comportamento offline-first; `mappa-codice.md` e `dati-e-sincronizzazione.md` aggiornati; tutta la checklist di controllo verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.7 — [Fase B1] UI Account, registrazione 2-step, gestione dispositivi/admin e deploy Proxmox
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** `PKT-25.3`, `PKT-25.6`.
- **Perché:** esporre i flussi account Zero-Knowledge con piena compatibilità nativa per i password manager, dismettere la vecchia configurazione a doppia chiave in `SyncSettings.vue` (la sincronizzazione si attiva solo con account registrato, punto 4 di `PKT-14`) e aggiornare gli script/configurazioni di deploy Proxmox. Completa la **Fase B1**.
- **Come partire:** seguire [autenticazione.md §4.3, §6 e §7 Fase B1](architettura/autenticazione.md#43-compatibilità-nativa-con-password-manager-e-autofill):
  - Integrare in `/impostazioni/sicurezza` e `src/components/SyncSettings.vue` i flussi UI con contratti HTML password manager: **Login**, **Registrazione con invito in 2 step** (Step 1 codice invito `type="text" autocomplete="one-time-code"`; Step 2 `username` + `new-password` + `passwordrules` + indicatore robustezza) con visualizzazione one-shot **Recovery Key** (copia/stampa/conferma), **Cambio Master Password** (con revoca opzionale altri dispositivi), **Recupero account** (token reset admin + Recovery Key), **Dispositivi collegati** (lista + revoca immediata), **Pannello Admin** (inviti monouso e token reset) e **migrazione guidata** del primo account admin da dati legacy.
  - Aggiornare il deploy Proxmox: `deploy/proxmox/nginx/pocketly.conf` (preservazione `Set-Cookie`, `Host`, `Origin` su `location /api/`, coordinata con gli header di sicurezza di `PKT-14`), `deploy/proxmox/pocketly-sync.service` e `deploy/proxmox/install-sync.sh` (`POCKETLY_TOKEN_SECRET`, permessi SQLite).
  - Allineare `src/i18n/it.ts`, `src/i18n/en.ts` e aggiornare documentazione (`mappa-codice.md`, `frontend.md`, `componenti-e-viste.md`, `backend.md`, `deploy.md`, `dati-e-sincronizzazione.md`, `guide/sync-e-notifiche.md`, `guide/test-utente.md`).
- **Fatto quando:** tutti i flussi account sono verificati sulle 6 combinazioni piattaforma × tema e con password manager (Apple Passwords, Google Password Manager e un gestore esterno, confermando che il PIN non sovrascriva la Master Password); deploy Proxmox aggiornato e documentato; tutta la checklist (`test`, `typecheck`, `test:server`, `build`, `docs:check`) verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.8 — [Fase B2] Crittografia condivisione ECDH P-256, Safety Fingerprint e API membri/inviti
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** `PKT-25.7`.
- **Perché:** abilitare la condivisione Zero-Knowledge di un archivio finanziario tra account coppia/famiglia senza che il server possa mai accedere alla `vaultDEK`, garantendo *forward secrecy* alla rimozione di un membro.
- **Come partire:** seguire [autenticazione.md §3.3 e §5.3](architettura/autenticazione.md#33-archivi-condivisi-coppiafamiglia-ecdh-p-256):
  - Estendere `src/services/authCrypto.ts`: wrapping/unwrapping di `vaultDEK` tramite coppia ECDH P-256 effimera + `HKDF-SHA-256` (`info="pocketly-vault-share-v1:<vaultId>"`) + AES-256-GCM, e calcolo del **Safety Fingerprint** da `SHA-256(publicKey)`.
  - Implementare sul server (`server/main.py`, `server/db.py`, `server/auth.py`) gli endpoint: `GET /api/users/{username}/public-key`, creazione vault condiviso su `POST /api/vaults`, `POST /api/vaults/{vaultId}/invites`, elenco inviti ricevuti, `POST /api/vaults/{vaultId}/invites/{id}/accept` e `DELETE /api/vaults/{vaultId}/members/{userId}` con rotazione atomica `key_version + 1` e aggiornamento dei `wrapped_dek` per i soli membri rimanenti.
  - Estendere `src/services/auth/api.ts` con i nuovi endpoint di condivisione.
- **Fatto quando:** test client e server coprono wrap/unwrap ECDH P-256, Safety Fingerprint, invito/accettazione, rimozione membro con rotazione `key_version + 1` e verifica che il membro rimosso non possa decifrare né accedere alle versioni successive; `mappa-codice.md` e `backend.md` aggiornati; tutta la checklist di controllo verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

#### PKT-25.9 — [Fase B2] Storage IndexedDB multi-vault, selettore archivio e UI condivisione famiglia
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Dipendenze:** `PKT-25.8`.
- **Perché:** permettere a chi partecipa a più archivi (es. *Personale* + *Casa/Famiglia*) di passare da un archivio all'altro senza incrociare dati locali, sync o notifiche, mantenendo zero complessità visiva per chi usa un solo archivio. Completa la **Fase B2** e chiude `PKT-25`.
- **Come partire:** seguire [autenticazione.md §5.4 e §7 Fase B2](architettura/autenticazione.md#54-multi-vault-sul-frontend):
  - Estendere `src/services/storage.ts`, `src/stores/finance.ts`, `src/stores/sync.ts`, `src/stores/notifications.ts` e `src/stores/backup.ts` con chiavi IndexedDB namespaced per archivio (`finance-data:<vaultId>`, `sync-config:<vaultId>`), mantenendo la migrazione/compatibilità trasparente da `'finance-data'` e isolamento completo di sync e promemoria Web Push per `vaultId`.
  - Aggiungere la UI per creare un archivio condiviso, invitare un membro verificando il **Safety Fingerprint**, accettare/rifiutare inviti pendenti, rimuovere membri (con rotazione chiave) e un selettore compatto dell'archivio attivo visibile **solo quando l'utente ha ≥ 2 vault**.
  - Allineare `src/i18n/it.ts`, `src/i18n/en.ts`, verificare tutte le 6 combinazioni piattaforma × tema e aggiornare la documentazione completa (`mappa-codice.md`, `frontend.md`, `componenti-e-viste.md`, `dati-e-sincronizzazione.md`, `NOTIFICHE.md`, `guide/test-utente.md`) chiudendo anche `PKT-25`.
- **Fatto quando:** test unitari verificano l'isolamento multi-vault (storage, cifratura locale, sync, push) e il cambio archivio senza perdite; verifica visiva sulle 6 combinazioni piattaforma × tema (e selettore nascosto con un solo vault); tutta la checklist (`test`, `typecheck`, `test:server`, `build`, `docs:check`) verde.
- **Storia:**
  - 2026-11-25 aperta dalla scomposizione di `PKT-25` (Jonny).

### PKT-26 — Blocco scroll e viewport delle modali su iPhone
- **Stato:** fatto · **Priorità:** — · **Chi:** Jonny
- **Perché:** su iPhone, aprendo la modale per inserire una spesa (`TransactionForm` dentro `BaseModal`), trascinando il dito in orizzontale, verticale o con movimenti combinati 2D il contenuto del foglio si spostava liberamente come una pagina web senza vincoli (`body.style.overflow = 'hidden'` ignorato da iOS WebKit, mancanza di `overflow-x-hidden` e `touch-pan-y`, intestazione dentro l'area scorrevole e `fixed inset-0` / `90dvh` non adattati a `window.visualViewport` con tastiera virtuale aperta).
- **Come:** utility testata [`modalViewport.ts`](../src/utils/modalViewport.ts) (`createBackgroundScrollLock`, `readVisualViewportBox`, `shouldPreventModalTouchMove`, `findModalScrollables`, `refreshHorizontalScrollers`, `createHorizontalDragFallback`) integrata in `BaseModal.vue`: blocco scroll di sfondo compatibile con iOS e modali sovrapposte, overlay ancorato a `visualViewport` (con azzeramento derive `offsetTop`), sfondo separato `touch-none`, testata fissa (`shrink-0 touch-none`) e corpo scorrevole solo in verticale (`overflow-x-hidden overflow-y-auto overscroll-contain touch-manipulation`), preservando fin dalla prima apertura con tastiera lo scorrimento orizzontale interno (chip «Frequenti» in `TransactionForm.vue` con `overflow-y-hidden touch-pan-x will-change-scroll`, reflow post-tastiera e fallback `scrollLeft` quando WebKit congela lo scroller nativo). Aggiunto `overflow-x: clip` su `html`/`body` e `max-w-full` su `.field` in `src/style.css`.
- **Fatto quando:** test unitari verdi, `typecheck`, `test:server`, `build` e `docs:check` verdi, documentazione aggiornata; verificato su iPhone (Safari e PWA) che la modale resti ferma su scorrimenti orizzontali/2D e scorra solo in verticale quando serve.
- **Storia:**
  - 2026-11-23 aperta e implementata nel ramo `fix/modale-scroll-ios` (Jonny, `ecc4017`): introdotta `modalViewport.ts` con test unitari, aggiornati `BaseModal.vue`, `TransactionForm.vue`, `style.css` e documentazione (`mappa-codice.md`, `componenti-e-viste.md`, `frontend.md`).
  - 2026-11-23 seconda iterazione dopo prova su iPhone (`1b514c6`): `touch-manipulation` sul corpo e `overflow-y-hidden touch-pan-x will-change-scroll` sui chip «Frequenti».
  - 2026-11-23 terza iterazione dopo prova su iPhone: azzeramento derive `visualViewport.offsetTop`, reflow reale post-tastiera (`refreshHorizontalScrollers` a 350 ms) e fallback `createHorizontalDragFallback` su `scrollLeft` (con soppressione click accidentali) se `WKChildScrollView` resta bloccato alla prima apertura con tastiera. Da riprovare su iPhone e unire in `develop`.
  - 2026-11-23 in `develop` con `1d663dd`; `develop` portato in `main` con `a3a072e` (Johanna).

### PKT-27 — Implementazione piano di miglioramento strutturale e manutenibilità (da PKT-15)
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** implementare i miglioramenti strutturali, di deduplicazione, modularità, quality gates e copertura test individuati nell'analisi `PKT-15` (inclusi i filtri dei tag copiati tra Entrate e Spese segnalati in `PKT-06`), documentati in [Analisi e Piano di Miglioramento Strutturale](architettura/struttura-e-manutenibilita.md).
- **Come partire:** seguire il piano incrementale a 3 fasi e le specifiche tecniche della [Sezione 4 di struttura-e-manutenibilita.md](architettura/struttura-e-manutenibilita.md#4-specifiche-tecniche-operative-guida-operativa-per-pkt-27) (chi prende in carico il lavoro può suddividerlo in PR/sotto-task per Fase 1, Fase 2 e Fase 3: Fase 1 deduplicazione `OneTimeView`/`IncomeView` e servizi/utility condivise + guardia `finance.init()` + `docs-check.mjs`; Fase 2 scomposizione `DashboardView`, `BudgetView`, `notifications.ts`, `finance.ts`, `calculations.ts`, `style.css` e `components/`; Fase 3 modularizzazione `server/main.py` e copertura test su composables, store e servizi scoperti). Coordinato con `PKT-18`, `PKT-22`, `PKT-24` e `PKT-25`.
- **Fatto quando:** gli interventi prioritari (o i rispettivi sotto-task) sono implementati con zero breaking changes, `mappa-codice.md` e documentazione aggiornati, verifica visiva sulle 6 combinazioni piattaforma × tema per i refactor UI/CSS, e `npm run test`, `npm run typecheck`, `npm run test:server`, `npm run build` e `npm run docs:check` tutti verdi.
- **Storia:**
  - 2026-11-24 aperta da analisi PKT-15 (Jonny), collegata a [architettura/struttura-e-manutenibilita.md](architettura/struttura-e-manutenibilita.md).

### PKT-28 — Interazione nativa PWA, long press e animazioni OS-adattive
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** eliminare i comportamenti tipici da pagina web nella PWA (selezione accidentale del testo, callout nativo di Safari/Chrome, doppio tap per zoom, pull-to-refresh involontario, trascinamento icone) e introdurre un sistema unificato di pressione prolungata (long press su mobile / tasto destro su PC), feedback tattile/aptico, menu contestuale dinamico e animazioni conformi agli standard del sistema operativo in cui gira l'app (**iOS** Haptic Touch `UIMenu` Liquid Glass con curve spring, **Android** Material 3 Expressive Modal Bottom Sheet con ripple radiale, vibrazione e drag-to-dismiss, **Desktop** Popover al cursore navigabile da tastiera).
- **Come partire:** tutte le decisioni confermate, la matrice grafica/animazioni per piattaforma, le specifiche file per file e la checklist di verifica sono salvate in [Progetto e Piano Implementativo: Interazione Nativa PWA](architettura/interazione-nativa-pwa.md). Intervento puramente frontend senza cambi a `FinanceData` v3 né al backend; aprire un ramo dedicato (es. `feature/pkt-28-interazione-nativa`) e seguire le 6 fasi del documento (preservando `PKT-26` su `BaseModal` e `modalViewport.ts`).
- **Fatto quando:** regole native app shell e gettoni movimento/pressione su tutte e 6 le combinazioni in `src/style.css`, utility pure testate (`longPress`, `contextMenuLayout`, `sheetDrag`, `overlayStack`, `haptics`), composable `useLongPress`, `ContextMenuHost` integrato in `App.vue` + viste/componenti target, animazioni OS e drag-to-dismiss su `BaseModal`/`BottomNav`, chiavi `it`/`en` e documentazione aggiornati; `npm run test`, `npm run typecheck`, `npm run test:server`, `npm run build` e `npm run docs:check` tutti verdi; verifica manuale sulle 6 combinazioni piattaforma × tema e sui dispositivi reali.
- **Storia:**
  - 2026-11-25 aperta con progetto e piano implementativo salvato in [architettura/interazione-nativa-pwa.md](architettura/interazione-nativa-pwa.md).
