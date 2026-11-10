---
source-files:
  - src/router/index.ts
  - src/components/BottomNav.vue
  - src/i18n/it.ts
  - src/i18n/en.ts
verified: 2026-11-10
---

# Guida: Aggiungere una Nuova Vista

Questa guida illustra i passaggi necessari per implementare una nuova schermata o vista in Pocketly, garantendo coerenza con il routing, la navigazione, l'internazionalizzazione e la documentazione.

---

## 1. Creare il Componente Vista

Crea il nuovo file `.vue` nella cartella `src/views/` (es. `src/views/AnalyticsView.vue`):

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import PageHeader from '@/components/PageHeader.vue'

const finance = useFinanceStore()
const { t } = useFormat()
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('analytics.title')" />
    <!-- Contenuto della vista -->
  </section>
</template>
```

---

## 2. Registrare la Rotta in `src/router/index.ts`

1. Aggiungi il nuovo tab nell'array costante `TABS`:
   ```ts
   export const TABS = [
     // ... tab esistenti ...
     { name: 'analytics', path: '/analisi', icon: 'fa-chart-simple' },
   ] as const
   ```
2. Aggiungi la definizione della rotta in `routes` con dynamic import:
   ```ts
   { path: '/analisi', name: 'analytics', component: () => import('@/views/AnalyticsView.vue') },
   ```

---

## 3. Aggiungere le Traduzioni in `src/i18n/`

Aggiungi il nuovo blocco di traduzioni **sia in `src/i18n/it.ts` che in `src/i18n/en.ts`**:

In `src/i18n/it.ts`:
```ts
nav: {
  // ...
  analytics: 'Analisi',
},
analytics: {
  title: 'Analisi Finanziaria',
  // ... altre chiavi ...
},
```

In `src/i18n/en.ts`:
```ts
nav: {
  // ...
  analytics: 'Analytics',
},
analytics: {
  title: 'Financial Analytics',
  // ... altre chiavi ...
},
```

---

## 4. Aggiornare Documentazione e Verifiche

1. Aggiungi la nuova vista alla [Mappa del Codice](../riferimento/mappa-codice.md) nella sezione "Viste dell'Applicazione".
2. Documenta la nuova vista in [Componenti e Viste](../riferimento/componenti-e-viste.md).
3. Esegui la verifica:
   ```bash
   npm run typecheck
   npm run test
   npm run docs:check
   ```
