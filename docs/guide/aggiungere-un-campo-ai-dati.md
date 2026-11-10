---
source-files:
  - src/types/models.ts
  - src/domain/defaults.ts
  - src/services/migration.ts
  - src/services/migration.test.ts
  - src/domain/merge.ts
  - src/domain/merge.test.ts
verified: 2026-11-10
---

# Guida: Aggiungere un Campo ai Dati

Aggiungere un nuovo attributo alle entità del modello dati di Pocketly richiede attenzione per preservare la retrocompatibilità dei backup esistenti, la robustezza del 3-way merge e l'allineamento dei tipi.

Segui scrupolosamente questa sequenza di passaggi:

---

## 1. Aggiornare l'Interfaccia in `src/types/models.ts`

Definisci il campo nell'interfaccia corrispondente. Se il campo è facoltativo o introdotto di recente su dati pregressi, segnalo come opzionale (`?`) o gestisci un default appropriato.

```ts
export interface OneTimeExpense {
  id: Id
  name: string
  amount: Cents
  date: IsoDate
  categoryId: Id
  paymentMethodId: Id
  notes: string
  tagIds?: Id[]
  receiptUrl?: string // <-- Nuovo campo opzionale
}
```

*Nota:* Se il campo rappresenta una cifra monetaria, usa rigorosamente `Cents` (numero intero). Se è una data, usa `IsoDate` (`YYYY-MM-DD`).

---

## 2. Aggiornare i Valori Predefiniti in `src/domain/defaults.ts`

Se il nuovo campo appartiene alla radice di `FinanceData` o a una configurazione globale (`ForecastSettings`, `BudgetSettings`), aggiorna le funzioni costruttrici:
- `createEmptyData()`
- `createDefaultData()`

---

## 3. Gestire la Normalizzazione in `src/services/migration.ts`

Il modulo `migration.ts` ripulisce e convalida qualsiasi dato proveniente da file JSON o dal server.

1. Se il campo è aggiunto a una transazione o entità, aggiorna la funzione di parsing difensivo corrispondente (es. `normalizeOneTimeExpense` o `normalizeForecast`).
2. Assicurati che se il campo è assente nel JSON (es. backup vecchio dell'utente), venga assegnato un fallback sicuro (es. `receiptUrl: typeof raw.receiptUrl === 'string' ? raw.receiptUrl : undefined`).
3. **Scrivi un test unitario** in `src/services/migration.test.ts` che verifichi:
   - Che un vecchio backup privo del campo venga importato con successo senza errori.
   - Che un backup con il nuovo campo preservi correttamente il valore.

---

## 4. Verificare l'Impatto sul Merge a 3 Vie (`src/domain/merge.ts`)

L'algoritmo `mergeFinanceData`:
- Per liste di entità con ID (`oneTimeExpenses`, `recurringExpenses`, `incomes`, `loans`, `categories`, `paymentMethods`, `tags`): utilizza `mergeIdList`, che unisce le entità per intero. Se il nuovo campo è dentro un'entità con ID, il merge funziona automaticamente.
- Se invece aggiungi una **nuova collezione di entità** o una **nuova proprietà alla radice di `FinanceData`**, devi registrarla esplicitamente in `mergeFinanceData` in `src/domain/merge.ts` e aggiungere un test dedicato in `src/domain/merge.test.ts`.

---

## 5. Aggiornare Store e Moduli UI

1. Nello store [`src/stores/finance.ts`](../../src/stores/finance.ts), aggiorna eventuali metodi di mutazione o payload di creazione se necessario.
2. Nei componenti form (es. `TransactionForm.vue`), aggiungi il campo di input con bind `v-model`.
3. In `src/i18n/it.ts` e `src/i18n/en.ts`, aggiungi le etichette localizzate del campo.

---

## 6. Verifica Completa

Esegui l'intera catena di test per accertarti dell'assenza di regressioni:
```bash
npm run typecheck
npm run test
npm run test:server
npm run docs:check
```
