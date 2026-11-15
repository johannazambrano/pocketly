---
source-files: []
verified: 2026-11-15
---

# Backlog di Pocketly

Le attività del progetto e la loro storia, per chi ci lavora (Johanna, Jonny) e per gli agenti IA.
I difetti tecnici già analizzati sul codice stanno in [Stato e Difetti Noti](known-issues.md): qui c'è solo un
collegamento, senza ripeterne il testo.

## Riepilogo

| ID | Attività | Stato | Priorità | Chi |
|---|---|---|---|---|
| PKT-01 | Filtro del mese nelle Entrate | fatto nel ramo, da unire | media | Jonny |
| PKT-02 | Il mese del Budget segue quello scelto nelle altre pagine | da fare | media | libero |
| PKT-03 | Scegliere tra inserimenti rapidi e modelli di spesa | da fare | alta | Johanna, Jonny |
| PKT-04 | Rivedere e unire `feature/inserimenti-rapidi` | in attesa di PKT-03 | alta | Johanna |
| PKT-05 | Rivedere e unire `feature/funzionalita-strategiche` | in attesa di PKT-03 | alta | Johanna |
| PKT-06 | Pubblicare su Proxmox e provare sui telefoni | da fare | alta | Johanna |
| PKT-07 | Conti con saldo iniziale e prestiti nel saldo | idea da decidere | bassa | libero |
| PKT-08 | Categorie di entrata separate da quelle di spesa | idea da decidere | bassa | libero |
| PKT-09 | Critique 12 della dashboard: P1 e P2 | fatto | — | Johanna |
| PKT-10 | L'avviso del backup porta al riquadro del backup | fatto | — | Johanna |
| PKT-11 | Import dei tag da Excel | fatto | — | Jonny, Johanna |

Stati possibili: `da fare`, `in corso`, `in attesa di …`, `idea da decidere`, `fatto nel ramo, da unire`, `fatto`, `annullato`.

## Come si usa

1. **Le attività non si spostano.** Restano in ordine di numero; cambia solo la riga `Stato` (e la stessa riga
   del riepilogo). Spostare blocchi tra sezioni fa andare in conflitto i rami che toccano il file insieme.
2. **Nuova attività:** il numero successivo (`PKT-12`, `PKT-13`…), una riga nel riepilogo e un blocco qui sotto
   con `Stato`, `Perché`, `Fatto quando` e `Storia`. Per un difetto già descritto in
   [known-issues.md](known-issues.md) basta il collegamento.
3. **Prendere un'attività:** si mette `in corso` e il proprio nome con un piccolo commit **direttamente su
   `main`**, così gli altri lo vedono subito e non la prendono in due.
4. **Chiudere un'attività:** `fatto` (o `fatto nel ramo, da unire` se il ramo non è ancora in `main`) nel ramo
   del lavoro, nello stesso commit della modifica, con una riga in `Storia`: data, cosa e commit.
5. **Storico:** le attività chiuse restano qui. A fine anno quelle `fatto` e `annullato` passano in
   `docs/archivio/attivita-ANNO.md`, lasciando nel riepilogo solo quelle aperte.
6. **Agenti IA:** quando una revisione o un lavoro fanno emergere qualcosa da fare dopo, si apre un'attività qui
   invece di lasciarla solo nella conversazione.

---

### PKT-01 — Filtro del mese nelle Entrate
- **Stato:** fatto nel ramo, da unire · **Priorità:** media · **Chi:** Jonny
- **Perché:** la pagina Variabili si filtra per mese, le Entrate mostrano sempre tutto l'anno. Vedi
  [known-issues.md, punto 1](known-issues.md#1-disallineamento-ui-filtro-mese-in-incomeview).
- **Fatto quando:** le Entrate hanno lo stesso selettore del periodo di Variabili; `known-issues.md` aggiornato.
- **Storia:**
  - 2026-11-13 aperta (Jonny).
  - 2026-11-15 il selettore c'è già in `feature/funzionalita-strategiche`: si chiude con PKT-05.

### PKT-02 — Il mese del Budget segue quello scelto nelle altre pagine
- **Stato:** da fare · **Priorità:** media · **Chi:** libero
- **Perché:** il Budget ha un suo mese, separato da quello di Dashboard e Variabili. Vedi
  [known-issues.md, punto 2](known-issues.md#2-indice-mese-locale-in-budgetview).
- **Da decidere:** cosa mostra il Budget quando nelle altre pagine è scelto l'anno intero.
- **Fatto quando:** cambiando pagina il mese resta lo stesso; nessun errore nel cambio del mese.
- **Storia:**
  - 2026-11-13 aperta (Jonny).

### PKT-03 — Scegliere tra inserimenti rapidi e modelli di spesa
- **Stato:** da fare · **Priorità:** alta · **Chi:** Johanna, Jonny
- **Perché:** `feature/inserimenti-rapidi` (spese frequenti con un tocco) e il commit «duplicazione rapida e chip
  template spese frequenti» di `feature/funzionalita-strategiche` fanno quasi la stessa cosa. I due rami toccano
  20 file in comune, compresi formato dei dati, migrazione e sincronizzazione: unirli entrambi vorrebbe dire due
  funzioni doppie e due cambi del formato dei dati.
- **Fatto quando:** resta una sola funzione e l'altra è tolta dal suo ramo.
- **Storia:**
  - 2026-11-15 aperta (revisione dei rami di Jonny).

### PKT-04 — Rivedere e unire `feature/inserimenti-rapidi`
- **Stato:** in attesa di PKT-03 · **Priorità:** alta · **Chi:** Johanna
- **Fatto quando:** revisione fatta, correzioni fatte, ramo in `main`.
- **Storia:**
  - 2026-11-15 aperta.

### PKT-05 — Rivedere e unire `feature/funzionalita-strategiche`
- **Stato:** in attesa di PKT-03 · **Priorità:** alta · **Chi:** Johanna
- **Perché:** è il ramo più grande (ricerca globale, esportazione CSV ed Excel, entrate con note e tag,
  salvadanai, confronto tra periodi, modelli di spesa). Una prima revisione è del 2026-11-12; da allora sono
  arrivati altri commit.
- **Fatto quando:** revisione aggiornata, correzioni fatte, ramo in `main`; chiude anche PKT-01.
- **Storia:**
  - 2026-11-12 prima revisione.
  - 2026-11-15 aperta.

### PKT-06 — Pubblicare su Proxmox e provare sui telefoni
- **Stato:** da fare · **Priorità:** alta · **Chi:** Johanna
- **Perché:** in `main` ci sono modifiche non ancora pubblicate (critique 12, avviso del backup, tag da Excel).
- **Fatto quando:** `update.sh` lanciato, app aggiornata su tutti i telefoni; provato su iPhone che in «Nuova
  spesa» la tastiera si apre da sola sull'importo.
- **Storia:**
  - 2026-11-15 aperta.

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
