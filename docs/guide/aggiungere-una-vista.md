---
source-files:
  - src/router/index.ts
  - src/components/BottomNav.vue
  - src/i18n/it.ts
  - src/i18n/en.ts
  - src/views/BreakdownDetailView.vue
  - src/views/DashboardView.vue
verified: 2026-11-11
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

1. **Se è una vista principale (tab di navigazione):**
   Aggiungi il nuovo tab nell'array costante `TABS`:
   ```ts
   export const TABS = [
     // ... tab esistenti ...
     { name: 'analytics', path: '/analisi', icon: 'fa-chart-simple' },
   ] as const
   ```
   *Nota:* se la schermata è una **vista secondaria o di dettaglio** (es. `BreakdownDetailView.vue` per `/dettaglio/:kind/:id`), non deve comparire nei tab: salta questo passaggio.

2. **Registra la rotta in `routes`:**
   Aggiungi la definizione con lazy loading (`component: () => import(...)`):
   ```ts
   { path: '/analisi', name: 'analytics', component: () => import('@/views/AnalyticsView.vue') },
   ```
   Per viste parametriche di secondo livello o di dettaglio, specifica `meta.navParent`:
   ```ts
   {
     path: '/dettaglio/:kind(categoria|metodo)/:id',
     name: 'detail',
     component: () => import('@/views/BreakdownDetailView.vue'),
     // Mantiene evidenziata la tab padre nella barra di navigazione
     meta: { navParent: 'dashboard' },
   },
   ```

3. **Routing gerarchico con `meta.navParent` e convenzioni per viste di dettaglio:**
   Se la nuova schermata è un approfondimento analitico o una vista figlia (come `BreakdownDetailView.vue`), non deve essere inclusa nell'array `TABS`. Tuttavia, per fornire all'utente un punto di riferimento visivo chiaro:
   - Registra nei metadati la proprietà `meta: { navParent: '<tabName>' }`, dove `<tabName>` è il nome della vista padre definito in `TABS` (es. `'dashboard'`). In questo modo [`BottomNav.vue`](../../src/components/BottomNav.vue) riconosce la gerarchia e mantiene visivamente attiva la tab padre sia su dispositivi mobili sia nella sidebar desktop.
   - **Ritorno intelligente con cronologia:** usa un link normale (`<a href="/" @click="back">`) con la funzione di ritorno di `BreakdownDetailView.vue`:
     ```ts
     function back(e: MouseEvent) {
       if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
       e.preventDefault()
       if (router.options.history.state.back === '/') router.back()
       else router.push('/')
     }
     ```
     Ctrl/Cmd/Maiusc/Alt+clic e il tasto centrale restano al browser (per esempio per aprire la pagina padre in un'altra scheda). Se si arriva dalla pagina padre si torna indietro nella cronologia: con la politica di `scrollBehavior` configurata in `src/router/index.ts` (`savedPosition ?? { top: 0 }`) la pagina padre riappare nella posizione di scorrimento in cui la si era lasciata. Aprendo la pagina direttamente si va alla pagina padre con `router.push('/')`.
     Non usare un `RouterLink`: naviga da solo prima del gestore, e quel `push('/')` in più fa montare la pagina padre come una visita nuova. La dashboard, per esempio, in `onMounted` legge `router.options.history.state.forward` per rimettere il focus sulla riga da cui si era entrati, e con il `RouterLink` non lo saprebbe.
   - **Accessibilità e focus del titolo:** implementa l'autofocus programmatico sul titolo `h2` (`ref="heading"`, `tabindex="-1"`, `focus:outline-none`) e aggiorna dinamicamente `document.title` al montaggio (ripristinando il titolo precedente in `onBeforeUnmount`) per consentire a screen reader e utenti da tastiera di recepire subito il nuovo contesto.

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
