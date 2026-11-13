---
source-files:
  - src/views/IncomeView.vue
  - src/views/BudgetView.vue
  - src/domain/savings.ts
  - server/webpush.py
  - src/stores/notifications.ts
verified: 2026-11-12
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

## 2. Indice Mese Locale in `BudgetView`
- **Classificazione:** `Minor Robustness Risk` / Architettura UI
- **File coinvolti:** [`src/views/BudgetView.vue`](../src/views/BudgetView.vue), [`src/stores/finance.ts`](../src/stores/finance.ts)
- **Descrizione:**
  Nello store `finance.ts` è presente la proprietà reattiva globale `selectedMonth` (inizializzata al mese corrente `new Date().getMonth()`, con tipo `number | 'all'`), utilizzata da `DashboardView` e `OneTimeView`. La vista `BudgetView.vue`, invece, gestisce internamente un proprio stato locale `const monthIndex = ref(parseIsoDate(finance.today).month)` con pulsanti di navigazione mensile dedicati ("Mese precedente", "Mese successivo", "Mese corrente").
- **Impatto:**
  Se l'utente seleziona un mese diverso nella Dashboard o in Spese una tantum e successivamente naviga sulla pagina del Budget, `BudgetView` non eredita il mese selezionato, mostrando di default il mese corrente di calendario.
- **Soluzione futura consigliata:**
  Valutare se sincronizzare bidirezionalmente il mese di `BudgetView` con lo stato globale `finance.selectedMonth` (convertendo `'all'` nel mese corrente per il budget).

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

## 5. Tracciamento Salvadanai e Isolamento dal Saldo Operativo
- **Classificazione:** `Caratteristica di Design` (Documentata)
- **File coinvolti:** [`src/domain/savings.ts`](../src/domain/savings.ts), [`src/views/BudgetView.vue`](../src/views/BudgetView.vue), [`src/stores/finance.ts`](../src/stores/finance.ts)
- **Descrizione:**
  I salvadanai (`SavingsGoal`) gestiscono l'accantonamento fondi verso obiettivi futuri monitorando il capitale attuale (`currentAmount`) e il target desiderato (`targetAmount`). I versamenti e i prelievi modificano direttamente `currentAmount` dell'obiettivo e non generano transazioni contabili nel bilancio operativo del mese (`oneTimeExpenses` / `incomes`).
- **Motivazione:**
  L'accantonamento in un salvadanaio è un trasferimento patrimoniale / riserva liquida e non un consumo a fondo perduto né una nuova entrata reddituale; mantenere isolato il saldo operativo evita distorsioni nelle medie storiche e nelle stime previsionali dell'anno.
