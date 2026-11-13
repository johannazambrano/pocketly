---
source-files: []
verified: 2026-11-13
---

# Backlog Progetto — Pocketly

Registro condiviso delle attività da svolgere su Pocketly per collaboratori umani e agenti IA.
Per difetti e limiti tecnici già analizzati sul codice vedi anche [Stato e Difetti Noti](known-issues.md).

## Come usarlo

1. **Prendere in carico un task:** sposta la scheda in **In corso**, imposta **Assegnatario** (es. `@nome` o agente/branch) e aggiorna lo stato prima di iniziare a scrivere codice.
2. **Aggiungere un task:** usa il prossimo ID progressivo `PKT-XX`, indica area, file coinvolti (solo link relativi, senza `file://` e senza numeri di riga) e criteri **Fatto quando**.
3. **Chiudere un task:** verifica la checklist in [AGENTS.md](../AGENTS.md), sposta il task in **Completati recenti** indicando data e commit/PR di riferimento.
4. **Pulizia periodica:** quando **Completati recenti** cresce troppo, sposta i vecchi task in [docs/archivio/](archivio/README.md) per mantenere il file leggero.

---

## 🔥 In corso

*(Nessun task in corso)*

---

## 📋 Da fare

### Alta priorità

#### `PKT-01` — Aggiungere filtro mensile (`MonthSelector`) in `IncomeView`
- **Area:** `UI` · `Coerenza`
- **Assegnatario:** `libero`
- **Riferimenti:** [`IncomeView.vue`](../src/views/IncomeView.vue), [`OneTimeView.vue`](../src/views/OneTimeView.vue), [`known-issues.md`](known-issues.md)
- **Contesto:** `OneTimeView.vue` integra `MonthSelector` per filtrare le uscite per singolo mese o per l'intero anno, mentre `IncomeView.vue` mostra sempre tutte le entrate dell'anno (`finance.incomesOfYear`).
- **Fatto quando:**
  - `IncomeView.vue` integra `MonthSelector` con comportamento coerente a `OneTimeView.vue`.
  - Eventuali nuove chiavi di testo sono allineate in `src/i18n/it.ts` e `src/i18n/en.ts`.
  - La vista è verificata su tutte e 6 le combinazioni piattaforma/tema (`ios`/`android`/`desktop` × `light`/`dark`).
  - `npm run test`, `npm run typecheck`, `npm run build` e `npm run docs:check` passano.

### Media priorità

#### `PKT-02` — Allineare il mese di `BudgetView` allo stato globale `finance.selectedMonth`
- **Area:** `UI` · `Store`
- **Assegnatario:** `libero`
- **Riferimenti:** [`BudgetView.vue`](../src/views/BudgetView.vue), [`finance.ts`](../src/stores/finance.ts), [`known-issues.md`](known-issues.md)
- **Contesto:** `BudgetView.vue` gestisce un `monthIndex` locale anziché sincronizzarsi con `finance.selectedMonth` usato da `DashboardView` e `OneTimeView`.
- **Decisione aperta:** confermare la strategia quando `finance.selectedMonth === 'all'` (fallback sul mese corrente mantenendo `'all'` per le altre viste o aggiornamento selettivo).
- **Fatto quando:**
  - La selezione del mese in `BudgetView.vue` resta coerente con la navigazione tra viste senza regressioni sul cambio mese.
  - `npm run test`, `npm run typecheck`, `npm run build` e `npm run docs:check` passano.

### Bassa priorità

*(Nessun task in coda)*

---

## ⏸️ In attesa / Da decidere

*(Idee, proposte o attività bloccate in attesa di decisioni di prodotto/UX)*

---

## ✅ Completati recenti

*(Spostare qui i task chiusi con data di completamento e riferimento al commit/PR)*
