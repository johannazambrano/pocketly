---
source-files:
  - src/types/models.ts
  - src/domain/defaults.ts
  - src/services/migration.ts
  - src/services/migration.test.ts
  - src/domain/merge.ts
  - src/domain/merge.test.ts
verified: 2026-11-11
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
- `createDefaultData(locale)`
- `defaultForecastSettings()` / `defaultBudgetSettings()` per i campi delle impostazioni

---

## 3. Gestire la Normalizzazione in `src/services/migration.ts`

Il modulo `migration.ts` ripulisce e convalida qualsiasi dato proveniente da IndexedDB, da file JSON o dal server: `parseBackup` instrada verso `normalizeV2` (schema v2) o `migrateV1` (prototipi). `normalizeV2` ricostruisce ogni voce campo per campo, quindi **un campo non elencato lì viene scartato** al primo caricamento.

1. Se il campo è aggiunto a una transazione o entità, aggiungilo nella mappatura corrispondente dentro `normalizeV2` (per le spese una tantum è la callback passata a `valid<OneTimeExpense>` per `oneTimeExpenses`); per le impostazioni globali usa `normalizeForecast` o `normalizeBudget`, per categorie, metodi e tag `normalizeTags`. Se il campo ha senso anche per i dati dei prototipi, valuta `migrateV1`.
2. Assicurati che se il campo è assente nel JSON (es. backup vecchio dell'utente), venga assegnato un fallback sicuro (es. `receiptUrl: typeof raw.receiptUrl === 'string' ? raw.receiptUrl : undefined`).
3. **Scrivi un test unitario** in `src/services/migration.test.ts` che verifichi:
   - Che un vecchio backup privo del campo venga importato con successo senza errori.
   - Che un backup con il nuovo campo preservi correttamente il valore.

---

## 4. Verificare l'Impatto sul Merge a 3 Vie (`src/domain/merge.ts`)

L'algoritmo `mergeFinanceData` è generico (`mergeValue`): non elenca i campi di `FinanceData`.
- Qualsiasi elenco di voci con `id` viene unito voce per voce con `mergeIdList`, che tratta ogni voce come un'unità. Se il nuovo campo è dentro un'entità con ID, il merge funziona automaticamente.
- Anche una **nuova collezione di entità** o una **nuova proprietà alla radice** viene unita senza registrarla: gli oggetti si uniscono chiave per chiave, gli elenchi di stringhe come insiemi (`mergeStringSet`), gli altri valori con `conflict` (vince questo dispositivo).
- Va toccato `merge.ts` solo se il campo punta a una categoria o a un metodo di pagamento con un nome diverso da `categoryId`/`paymentMethodId` (`TAG_REFS`) o se è un'impostazione che va ripulita in `repairReferences`. In quel caso aggiungi un test in `src/domain/merge.test.ts`.

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
