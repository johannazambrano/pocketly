---
source-files:
  - src/views/IncomeView.vue
  - src/views/BudgetView.vue
  - server/webpush.py
  - src/stores/notifications.ts
verified: 2026-11-10
---

# Stato e Difetti Noti (Known Issues)

*Verificato il 10 Novembre 2026 sul commit `d9f4a6d` (merge `main`).*

Questo documento elenca le caratteristiche note, i limiti architetturali e i comportamenti specifici verificati direttamente sul codice sorgente di Pocketly.

---

## 1. Disallineamento UI Filtro Mese in `IncomeView`
- **Classificazione:** `Minor Robustness Risk` / Scelta UI
- **File coinvolti:** [`src/views/IncomeView.vue`](../src/views/IncomeView.vue) vs [`src/views/OneTimeView.vue`](../src/views/OneTimeView.vue)
- **Descrizione:**
  In `OneTimeView.vue` è presente il componente `MonthSelector`, che consente all'utente di filtrare le uscite per singolo mese oltre che per l'intero anno. Al contrario, `IncomeView.vue` visualizza direttamente `finance.incomesOfYear` senza componente `MonthSelector`.
- **Impatto:**
  L'utente in `IncomeView` vede sempre tutte le entrate dell'anno in corso in una lista unica. Se il numero di entrate nell'anno è elevato, la vista non offre il filtro mensile rapido.
- **Soluzione futura consigliata:**
  Introdurre `MonthSelector` anche in `IncomeView.vue` collegandolo a un elenco filtrato (es. `incomesFiltered`), coerentemente con quanto avviene per le spese una tantum.

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
