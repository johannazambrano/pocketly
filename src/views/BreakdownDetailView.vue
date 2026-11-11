<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { breakdownItems } from '@/domain/calculations'
import { monthIndex, parseIsoDate } from '@/utils/dates'
import MonthSelector from '@/components/MonthSelector.vue'

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
function back(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  if (router.options.history.state.back === '/') router.back()
  else router.push('/')
}
</script>

<template>
  <section class="space-y-4">
    <a
      href="/"
      @click="back"
      class="-ml-1 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
    >
      <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>{{ t('detail.back') }}
    </a>

    <div v-if="!tag" class="card text-sm text-slate-600">{{ t('detail.notFound') }}</div>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="min-w-0">
          <!-- Sta sullo sfondo grigio della pagina, non su un riquadro bianco: serve il grigio più scuro per 4,5:1. -->
          <p class="text-xs font-medium text-slate-600">{{ kindLabel }}</p>
          <h2 ref="heading" tabindex="-1" class="flex items-center gap-2 text-lg font-bold text-slate-800 focus:outline-none">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: tag.color }" aria-hidden="true"></span>
            <span class="truncate">{{ tag.name }}</span>
          </h2>
        </div>
        <MonthSelector />
      </div>

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p class="text-xs font-medium text-slate-500">{{ periodLabel }}</p>
          <p class="text-lg font-bold whitespace-nowrap text-slate-800">{{ money(total) }}</p>
        </div>
        <ul v-if="items.length" class="divide-y divide-slate-100">
          <li v-for="item in items" :key="item.key" class="flex items-center justify-between gap-3 px-4 py-2.5">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-800">{{ item.name }}</p>
              <p class="text-xs text-slate-500">
                {{ date(item.date) }} ·
                {{ t(item.source === 'recurring' ? 'detail.recurring' : 'detail.variable') }}
              </p>
            </div>
            <span class="shrink-0 text-sm font-semibold text-slate-700">{{ money(item.amount) }}</span>
          </li>
        </ul>
        <p v-else class="px-4 py-6 text-center text-sm text-slate-500">{{ t('detail.empty') }}</p>
      </div>
    </template>
  </section>
</template>
