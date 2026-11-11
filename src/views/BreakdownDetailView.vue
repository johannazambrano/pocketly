<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { breakdownItems } from '@/domain/calculations'
import { monthIndex, parseIsoDate } from '@/utils/dates'
import MonthSelector from '@/components/MonthSelector.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import RecurringForm from '@/components/RecurringForm.vue'
import type { BreakdownItem } from '@/domain/calculations'
import type { OneTimeExpense, RecurringExpense } from '@/types/models'

/**
 * Il dettaglio di una riga della dashboard ("Spese per categoria" o "per metodo di pagamento"): tutte le voci che la
 * compongono, spese variabili e addebiti ricorrenti insieme, per il periodo scelto. Il totale coincide con la riga
 * della dashboard perché segue le stesse regole (vedi `breakdownItems`).
 */
const route = useRoute()
const router = useRouter()
const finance = useFinanceStore()
const { t, money, date, month } = useFormat()

const kind = computed<TagKind>(() => (route.params.kind === 'metodo' ? 'paymentMethods' : 'categories'))
const field = computed(() => (kind.value === 'paymentMethods' ? 'paymentMethodId' : 'categoryId'))
const id = computed(() => String(route.params.id))
const tag = computed(() => finance.tag(kind.value, id.value))

const items = computed(() =>
  breakdownItems(finance.data, finance.selectedYear, finance.selectedMonth, field.value, id.value, finance.today),
)
const total = computed(() => items.value.reduce((acc, i) => acc + i.amount, 0))

/** Il periodo detto per esteso, con la stessa regola della dashboard: fino a oggi, tutto avvenuto o solo programmato. */
const periodLabel = computed(() => {
  const today = parseIsoDate(finance.today)
  const year = finance.selectedYear
  const m = finance.selectedMonth
  if (m === 'all') {
    return year === today.year ? t('detail.yearToDate', { year }) : t('detail.year', { year })
  }
  const args = { month: month(m), year }
  const key = monthIndex(year, m)
  const now = monthIndex(today.year, today.month)
  if (key === now) return t('detail.monthToDate', args)
  return key > now ? t('detail.monthScheduled', args) : t('detail.month', args)
})
const kindLabel = computed(() => t(kind.value === 'paymentMethods' ? 'detail.paymentMethod' : 'detail.category'))

/**
 * Arrivando nella pagina, il nome della scheda del browser e il focus dicono dove si è: chi usa un lettore di schermo
 * sente subito il nome della categoria, invece di ripartire dall'inizio del documento.
 */
const heading = ref<HTMLElement | null>(null)
const previousTitle = document.title
watch(
  () => tag.value?.name,
  async (name) => {
    document.title = name ? `${name} · Pocketly` : previousTitle
    await nextTick()
    heading.value?.focus()
  },
  { immediate: true },
)
onBeforeUnmount(() => (document.title = previousTitle))

/**
 * "Torna alla dashboard": se si è arrivati da lì si torna indietro nella cronologia, così la dashboard riappare nel
 * punto in cui la si era lasciata; aprendo il link direttamente si va alla dashboard dall'inizio.
 * È un link normale e non un RouterLink: il RouterLink naviga da solo prima di questo gestore, e quel `push('/')` in più
 * faceva montare la dashboard senza sapere da quale riga si tornava (e quindi senza rimetterci il focus).
 * Ctrl/Cmd+clic e il tasto centrale restano al browser, che apre la dashboard in un'altra scheda.
 */
/**
 * Ogni voce si apre per la modifica con lo stesso modulo delle pagine Variabili e Ricorrenti: il dettaglio non è un
 * vicolo cieco. Per un addebito ricorrente si modifica la spesa ricorrente intera (il titolo del modulo lo dice).
 * Chiuso il modulo, il focus torna sulla voce da cui si era partiti, o sul titolo se la voce non c'è più (per esempio
 * perché le si è cambiata categoria).
 */
const editingOneTime = ref<OneTimeExpense | null>(null)
const editingRecurring = ref<RecurringExpense | null>(null)
const editingOccurrence = ref<string | null>(null)
let returnKey: string | null = null
function edit(item: BreakdownItem) {
  returnKey = item.key
  if (item.source === 'oneTime') editingOneTime.value = finance.data.oneTimeExpenses.find((e) => e.id === item.sourceId) ?? null
  else {
    editingRecurring.value = finance.data.recurringExpenses.find((r) => r.id === item.sourceId) ?? null
    editingOccurrence.value = item.date
  }
}
async function closeForm() {
  editingOneTime.value = null
  editingRecurring.value = null
  await nextTick()
  const row = returnKey ? document.querySelector<HTMLElement>(`[data-item-key="${CSS.escape(returnKey)}"]`) : null
  ;(row ?? heading.value)?.focus()
  returnKey = null
}

function back(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  if (router.options.history.state.back === '/') router.back()
  else router.push('/')
}
</script>

<template>
  <section class="space-y-4">
    <!-- Senza categoria il ritorno è il pulsante dentro il riquadro: qui sarebbe un doppione. -->
    <a
      v-if="tag"
      href="/"
      @click="back"
      class="-ml-1 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-medium text-accent hover:text-accent-strong"
    >
      <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>{{ t('detail.back') }}
    </a>

    <!-- Una categoria eliminata, o un indirizzo vecchio: si dice cosa è successo e dove andare. -->
    <div v-if="!tag" class="card space-y-3">
      <h2 ref="heading" tabindex="-1" class="text-lg font-bold text-ink focus:outline-none">{{ t(kind === 'paymentMethods' ? 'detail.notFoundMethodTitle' : 'detail.notFoundTitle') }}</h2>
      <p class="text-sm text-ink-3">{{ t(kind === 'paymentMethods' ? 'detail.notFoundMethod' : 'detail.notFound') }}</p>
      <div class="flex flex-wrap gap-2">
        <a href="/" class="btn-primary" @click="back">{{ t('detail.back') }}</a>
        <RouterLink
          to="/impostazioni"
          class="inline-flex min-h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
        >
          {{ t('detail.manageTags') }}
        </RouterLink>
      </div>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="min-w-0">
          <!-- Sta sullo sfondo grigio della pagina, non su un riquadro bianco: serve il grigio più scuro per 4,5:1. -->
          <p class="text-xs font-medium text-ink-3">{{ kindLabel }}</p>
          <h2 ref="heading" tabindex="-1" class="flex items-center gap-2 text-lg font-bold text-ink focus:outline-none">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: tag.color }" aria-hidden="true"></span>
            <span class="truncate">{{ tag.name }}</span>
          </h2>
        </div>
        <MonthSelector />
      </div>

      <div class="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div class="flex items-baseline justify-between gap-3 border-b border-line-soft px-4 py-3">
          <p class="text-xs font-medium text-ink-4">{{ periodLabel }}</p>
          <p class="text-lg font-bold whitespace-nowrap text-ink">{{ money(total) }}</p>
        </div>
        <ul v-if="items.length" class="divide-y divide-line-soft">
          <li v-for="item in items" :key="item.key">
            <button
              type="button"
              :data-item-key="item.key"
              :aria-label="t('detail.editRow', { name: item.name, date: date(item.date), type: t(item.source === 'recurring' ? 'detail.recurring' : 'detail.variable').toLocaleLowerCase(), amount: money(item.amount) })"
              class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
              @click="edit(item)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-ink">{{ item.name }}</span>
                <span class="block text-xs text-ink-4">
                  {{ date(item.date) }} ·
                  {{ t(item.source === 'recurring' ? 'detail.recurring' : 'detail.variable') }}
                </span>
              </span>
              <span class="flex shrink-0 items-center gap-2 text-sm font-semibold text-ink-2">
                {{ money(item.amount) }}
                <i class="fa-solid fa-pen text-xs text-ink-5" aria-hidden="true"></i>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="px-4 py-6 text-center text-sm text-ink-4">{{ t('detail.empty') }}</p>
      </div>
    </template>

    <TransactionForm :open="!!editingOneTime" kind="expense" :item="editingOneTime" @close="closeForm" />
    <RecurringForm :open="!!editingRecurring" :item="editingRecurring" :occurrence="editingOccurrence" @close="closeForm" />
  </section>
</template>
