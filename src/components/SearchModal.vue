<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useFinanceStore } from '@/stores/finance'
import { useAppearanceStore } from '@/stores/appearance'
import { useFormat } from '@/i18n'
import { searchFinance, type SearchResult } from '@/domain/search'
import { isActiveInYear } from '@/domain/recurrence'
import BaseModal from './BaseModal.vue'
import TagBadge from './TagBadge.vue'

const ui = useUiStore()
const finance = useFinanceStore()
const appearance = useAppearanceStore()
const router = useRouter()
const { t } = useI18n()
const { money, date } = useFormat()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const results = computed(() => searchFinance(finance.data, query.value))

watch(
  () => ui.searchOpen,
  (open) => {
    if (open) {
      query.value = ''
      // Autofocus solo su desktop per evitare l'apertura forzata della tastiera mobile
      if (appearance.platform === 'desktop') {
        nextTick(() => {
          setTimeout(() => inputRef.value?.focus(), 50)
        })
      }
    }
  },
)

function selectResult(item: SearchResult) {
  if (item.kind === 'onetime' || item.kind === 'income') {
    if (item.year !== undefined) {
      finance.selectedYear = item.year
    }
    if (item.month !== undefined) {
      finance.selectedMonth = item.month
    }
  } else if (item.kind === 'recurring') {
    // Sposta l'anno solo se la spesa ricorrente non è attiva nell'anno già selezionato
    const rec = finance.data.recurringExpenses.find((r) => r.id === item.id)
    if (rec && !isActiveInYear(rec, finance.selectedYear) && item.year !== undefined) {
      finance.selectedYear = item.year
    }
  }
  // Per i prestiti, LoansView mostra tutti i prestiti senza filtro anno/mese: non alteriamo selectedYear/Month

  ui.closeSearch()
  ui.quickAddOpen = false

  switch (item.kind) {
    case 'onetime':
      void router.push({ path: '/una-tantum', query: { highlight: item.id } })
      break
    case 'recurring':
      void router.push({ path: '/ricorrenti', query: { highlight: item.id } })
      break
    case 'income':
      void router.push({ path: '/entrate', query: { highlight: item.id } })
      break
    case 'loan':
      void router.push({ path: '/prestiti', query: { highlight: item.id } })
      break
    case 'goal':
      void router.push({ path: '/budget', query: { tab: 'savings', highlight: item.id } })
      break
  }
}
</script>

<template>
  <BaseModal :open="ui.searchOpen" :title="t('search.title')" @close="ui.closeSearch()">
    <div class="space-y-3">
      <!-- Barra di input ricerca -->
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden="true"></i>
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          :placeholder="t('search.placeholder')"
          class="field pl-9 pr-9"
          maxlength="100"
          @keydown.enter="results.length > 0 && selectResult(results[0]!)"
        />
        <button
          v-if="query"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 p-1"
          :aria-label="t('common.cancel')"
          @click="query = ''"
        >
          <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Conteggio risultati se presenti -->
      <div v-if="query.trim() && results.length > 0" class="flex items-center justify-between px-1 text-xs text-ink-4">
        <span>{{ t('search.resultsCount', { n: results.length }, results.length) }}</span>
      </div>

      <!-- Lista risultati -->
      <div v-if="results.length > 0" class="max-h-[55vh] space-y-2 overflow-y-auto pr-0.5">
        <div
          v-for="item in results"
          :key="`${item.kind}-${item.id}`"
          role="button"
          tabindex="0"
          class="card flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:bg-surface-2 focus:bg-surface-2 outline-none"
          @click="selectResult(item)"
          @keydown.enter="selectResult(item)"
          @keydown.space.prevent="selectResult(item)"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span
                class="inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                :class="{
                  'bg-surface-3 text-ink-2': item.kind === 'onetime',
                  'bg-chrome-2/15 text-chrome-2': item.kind === 'recurring',
                  'bg-accent-soft text-accent': item.kind === 'income',
                  'bg-caution-soft text-caution-strong': item.kind === 'loan',
                  'bg-positive-soft text-positive-strong': item.kind === 'goal',
                }"
              >
                {{ t(`search.kinds.${item.kind}`) }}
              </span>
              <span class="truncate text-sm font-semibold text-ink">{{ item.name }}</span>
            </div>

            <p v-if="item.notes" class="truncate text-xs text-ink-3">{{ item.notes }}</p>

            <div class="flex flex-wrap items-center gap-1.5 text-xs text-ink-4">
              <span v-if="item.date">{{ date(item.date) }}</span>
              <TagBadge v-if="item.categoryId" kind="categories" :id="item.categoryId" />
              <TagBadge v-if="item.paymentMethodId" kind="paymentMethods" :id="item.paymentMethodId" />
              <TagBadge v-for="tagId in item.tagIds" :key="tagId" kind="tags" :id="tagId" />
            </div>
          </div>

          <div class="shrink-0 text-right">
            <span
              class="text-sm font-bold"
              :class="item.kind === 'income' ? 'text-accent' : 'text-ink'"
            >
              {{ money(item.amount) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Nessun risultato -->
      <div v-else-if="query.trim()" class="py-10 text-center text-sm text-ink-4">
        <i class="fa-solid fa-magnifying-glass mb-2 block text-2xl opacity-40" aria-hidden="true"></i>
        <p>{{ t('search.noResults', { query: query.trim() }) }}</p>
      </div>

      <!-- Guida iniziale quando la barra è vuota -->
      <div v-else class="py-8 text-center text-sm text-ink-4">
        <i class="fa-solid fa-magnifying-glass mb-2 block text-2xl opacity-40" aria-hidden="true"></i>
        <p>{{ t('search.emptyHint') }}</p>
      </div>
    </div>
  </BaseModal>
</template>
