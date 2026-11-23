---
source-files:
  - src/views/IncomeView.vue
  - src/views/BudgetView.vue
  - src/composables/useMonthStep.ts
  - src/domain/savings.ts
  - src/views/DashboardView.vue
  - server/webpush.py
  - src/stores/notifications.ts
verified: 2026-11-23
---

# Stato e Difetti Noti (Known Issues)

*Verificato il 12 Novembre 2026.*

Questo documento elenca le caratteristiche note, i limiti architetturali e i comportamenti specifici verificati direttamente sul codice sorgente di Pocketly.

---

## 1. Disallineamento UI Filtro Mese in `IncomeView` [RISOLTO]
- **Classificazione:** Risolto (12 Novembre 2026)
- **File coinvolti:** [`src/views/IncomeView.vue`](../src/views/IncomeView.vue), [`src/stores/finance.ts`](../src/stores/finance.ts)
- **Risoluzione:**
  `IncomeView.vue` è stata armonizzata con `OneTimeView.vue`: dispone di `MonthSelector` nella testata, mostra `incomesFiltered`, supporta filtri e riepilogo raggruppato per tag (`tagBreakdown`), e visualizza note e badge dei tag per ciascuna entrata.

---

## 2. Indice Mese Locale in `BudgetView` [RISOLTO]
- **Classificazione:** Risolto (17 Novembre 2026, PKT-02)
- **File coinvolti:** [`src/views/BudgetView.vue`](../src/views/BudgetView.vue), [`src/composables/useMonthStep.ts`](../src/composables/useMonthStep.ts), [`src/stores/finance.ts`](../src/stores/finance.ts)
- **Risoluzione:**
  `BudgetView.vue` ora legge direttamente `finance.selectedMonth` e naviga tramite `useMonthStep` (che accetta un parametro opzionale `effectiveMonth`), mantenendo il mese sincronizzato con Dashboard, Variabili ed Entrate e gestendo correttamente il passaggio dicembre ↔ gennaio nei limiti di `finance.years`. Quando nelle altre pagine è selezionato l'anno intero (`'all'`), il Budget mostra il mese corrente di calendario (`finance.today`) con una nota informativa (`budget.wholeYearNote`) senza sovrascrivere `'all'` finché l'utente non cambia mese dal Budget.

---

## 3. [RISOLTO] Validazione Endpoint Web Push e Profilo SSRF
- **Classificazione:** `Risolto` (ex `Minor Robustness Risk`)
- **File coinvolti:** [`server/webpush.py`](../server/webpush.py) (funzioni `valid_endpoint`, `_public_host`)
- **Risoluzione:**
  È stato introdotto il controllo rigoroso `_public_host(parsed.hostname)` in `valid_endpoint`: qualsiasi tentativo di inviare notifiche push verso indirizzi IP (tramite `ipaddress.ip_address`), host `localhost` o domini con suffissi non pubblici (`.local`, `.lan`, `.test`, `.example`, `.home`) viene rigettato. In tal modo è precluso qualsiasi abuso SSRF verso apparati della rete locale o metadati cloud.

---

## 4. Orizzonte Temporale di Pianificazione Notifiche (60 Giorni)
- **Classificazione:** `Caratteristica di Design` (Documentata in UI)
- **File coinvolti:** [`src/stores/notifications.ts`](../src/stores/notifications.ts), [`src/components/NotificationSettings.vue`](../src/components/NotificationSettings.vue), [`server/main.py`](../server/main.py) (`MAX_PUSH_SCHEDULE`)
- **Descrizione:**
  Il calcolo dei promemoria (`calculateUpcomingReminders`) genera le scadenze su un orizzonte massimo di 60 giorni in avanti. Inoltre, il server accetta al massimo 5000 notifiche pianificate in totale (`MAX_PUSH_SCHEDULE = 5000`).
- **Miglioramento apportato:**
  L'interfaccia utente in `NotificationSettings.vue` chiarisce ora esplicitamente all'utente questo comportamento ("I promemoria coprono i prossimi 60 giorni e si rinnovano a ogni apertura dell'app"), e lo store notifica avvisi visivi dedicati (`scheduleProblem`) qualora il tetto massimo di 5000 notifiche venga raggiunto (`tooMany`) o si verifichino errori di rete nell'inoltro del calendario (`failed`). Spese con scadenza oltre 60 giorni vengono pianificate non appena rientrano nella finestra.

---

## 5. Salvadanai e Cifra della Dashboard
- **Classificazione:** `Caratteristica di Design` (Documentata)
- **File coinvolti:** [`src/domain/savings.ts`](../src/domain/savings.ts), [`src/views/BudgetView.vue`](../src/views/BudgetView.vue), [`src/stores/finance.ts`](../src/stores/finance.ts), [`src/views/DashboardView.vue`](../src/views/DashboardView.vue)
- **Descrizione:**
  I salvadanai (`SavingsGoal`) gestiscono l'accantonamento fondi verso obiettivi futuri monitorando il capitale attuale e il target desiderato (`targetAmount`). I versamenti e i prelievi sono movimenti (`savingsMovements`) da cui si calcola il capitale attuale, e non generano transazioni contabili nel bilancio operativo del mese (`oneTimeExpenses` / `incomes`).
- **Nella Dashboard (`PKT-19`, decisione di Johanna e Jonny del 2026-11-20):** i soldi messi da parte non sono più disponibili, e lasciati nella cifra grande ci si poteva fare affidamento. Il risultato e il previsto della Dashboard tolgono quanto è andato nei salvadanai nel periodo (versamenti come uscite, prelievi come entrate, solo i movimenti già fatti, `savedBetween`); il confronto con la media dei mesi precedenti usa la stessa regola. Una riga sotto la cifra dice quanto è andato nei salvadanai e la quota mensile consigliata, e porta a Budget → Salvadanai.
- **Cosa resta separato:** i movimenti non diventano spese o entrate. Le entrate e le uscite del riquadro, le ripartizioni per categoria e metodo (i versamenti non hanno categoria), la pagina Previsioni, il Budget e il formato dei dati non cambiano. Cancellando un salvadanaio si cancellano anche i suoi movimenti, quindi i risultati dei mesi passati risalgono come se quei soldi non fossero mai stati messi da parte.
