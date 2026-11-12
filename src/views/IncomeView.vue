<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Income } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { tagBreakdown } from '@/domain/calculations'
import { todayIso } from '@/utils/dates'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import MonthSelector from '@/components/MonthSelector.vue'

const finance = useFinanceStore()
const { t, money, date, month, locale, percent } = useFormat()
const confirmDelete = useConfirmDelete()
const route = useRoute()

const formOpen = ref(false)
const editing = ref<Income | null>(null)
const selectedTagId = ref<string | null>(null)
const showBreakdown = ref(false)
const highlightedId = ref<string | null>(null)

watch(
  () => route.query.highlight,
  (id) => {
    if (!id || typeof id !== 'string') return
    highlightedId.value = id
    // Se un filtro tag attivo nasconderebbe l'elemento evidenziato, rimuoviamo il filtro tag
    if (selectedTagId.value) {
      const inc = finance.incomesFiltered.find((e) => e.id === id)
      if (!inc || !inc.tagIds?.includes(selectedTagId.value)) {
        selectedTagId.value = null
      }
    }
    nextTick(() => {
      const el = document.getElementById(`entry-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  },
  { immediate: true },
)

const selectedTag = computed(() => (selectedTagId.value ? finance.tag('tags', selectedTagId.value) : null))

// Entrate filtrate per mese e, se selezionato, per tag
const displayedIncomes = computed(() => {
  if (!selectedTagId.value) return finance.incomesFiltered
  return finance.incomesFiltered.filter((e) => e.tagIds?.includes(selectedTagId.value!))
})

const total = computed(() => displayedIncomes.value.reduce((acc, e) => acc + e.amount, 0))

// Totale e conteggio per il tag attivo sull'intero anno
const yearTotalForSelectedTag = computed(() => {
  if (!selectedTagId.value) return 0
  return finance.incomesOfYear
    .filter((e) => e.tagIds?.includes(selectedTagId.value!))
    .reduce((acc, e) => acc + e.amount, 0)
})

const yearCountForSelectedTag = computed(() => {
  if (!selectedTagId.value) return 0
  return finance.incomesOfYear.filter((e) => e.tagIds?.includes(selectedTagId.value!)).length
})

// Ripartizione dei tag nel periodo filtrato (e sull'anno)
const incomeTagBreakdown = computed(() => tagBreakdown(finance.incomesFiltered))
const grandTotalForBreakdown = computed(() => finance.incomesFiltered.reduce((acc, e) => acc + e.amount, 0) || 1)

// Tag visibili nella barra dei filtri: tutti quelli che hanno entrate nell'anno corrente
const activeYearTags = computed(() => {
  const breakdown = tagBreakdown(finance.incomesOfYear)
  return breakdown.map((item) => {
    const tag = finance.tag('tags', item.id)
    return {
      id: item.id,
      name: tag?.name ?? t('common.unknown'),
      color: tag?.color ?? '#94a3b8',
      countInMonth: displayedIncomesCountForTag(item.id),
      totalInYear: item.total,
    }
  })
})

function displayedIncomesCountForTag(tagId: string): number {
  return finance.incomesFiltered.filter((e) => e.tagIds?.includes(tagId)).length
}

function toggleTagFilter(tagId: string | null) {
  if (selectedTagId.value === tagId) {
    selectedTagId.value = null
  } else {
    selectedTagId.value = tagId
  }
}

const emptyText = computed(() => {
  if (selectedTag.value) {
    return t('income.emptyTag', { tag: selectedTag.value.name })
  }
  if (finance.selectedMonth === 'all') return t('income.empty')
  const name = month(finance.selectedMonth)
  return t('income.emptyMonth', { month: locale.value === 'it' ? name.toLocaleLowerCase('it') : name })
})

const totalLabel = computed(() => {
  if (selectedTag.value) {
    return `${t('common.total')} (#${selectedTag.value.name})`
  }
  return t('common.total')
})

function open(item: Income | null) {
  editing.value = item
  formOpen.value = true
}

function duplicate(item: Income) {
  editing.value = {
    ...item,
    id: '',
    date: todayIso(),
  }
  formOpen.value = true
}

/** "Elimina" dentro il modulo (sul telefono è l'unico modo): dopo la conferma chiude anche il modulo. */
function remove() {
  const item = editing.value
  if (item) void confirmDelete(item.name, () => {
    finance.deleteIncome(item.id)
    formOpen.value = false
  })
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('income.title')">
      <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <MonthSelector />
        <button type="button" class="btn-primary page-add" @click="open(null)">
          <i class="fa-solid fa-plus mr-1"></i> {{ t('app.add') }}
        </button>
      </div>
    </PageHeader>

    <!-- Barra Filtri per Tag (visibile se ci sono tag con entrate nell'anno) -->
    <div v-if="activeYearTags.length > 0" class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            class="shrink-0 rounded-full px-3 py-1 font-medium transition-colors"
            :class="
              selectedTagId === null
                ? 'bg-chrome-2 text-on-color shadow-xs'
                : 'bg-surface border border-line text-ink-3 hover:bg-surface-2'
            "
            @click="toggleTagFilter(null)"
          >
            {{ t('income.allTags') }}
          </button>
          <button
            v-for="item in activeYearTags"
            :key="item.id"
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all"
            :class="
              selectedTagId === item.id
                ? 'bg-accent-fill text-on-color shadow-xs'
                : 'bg-surface border border-line text-ink-2 hover:bg-surface-2'
            "
            @click="toggleTagFilter(item.id)"
          >
            <span
              class="h-2 w-2 rounded-full"
              :style="{ backgroundColor: selectedTagId === item.id ? '#ffffff' : item.color }"
            ></span>
            <span>#{{ item.name }}</span>
            <span
              class="text-[10px] opacity-75 font-normal"
              :class="selectedTagId === item.id ? 'text-on-color' : 'text-ink-4'"
            >
              ({{ item.countInMonth }})
            </span>
          </button>
        </div>

        <!-- Pulsante toggle riepilogo raggruppato -->
        <button
          v-if="incomeTagBreakdown.length > 0"
          type="button"
          class="shrink-0 inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-3 shadow-2xs hover:bg-surface-2 transition-colors"
          :class="{ 'border-accent-bright text-accent bg-accent-soft': showBreakdown }"
          :title="t('income.tagSummary')"
          @click="showBreakdown = !showBreakdown"
        >
          <i class="fa-solid fa-chart-pie text-[11px]"></i>
          <span class="hidden sm:inline">{{ t('income.tagSummary') }}</span>
        </button>
      </div>

      <!-- Card Riepilogo Raggruppato per Tag (comprimibile) -->
      <div v-if="showBreakdown && incomeTagBreakdown.length > 0" class="card space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-2">
            {{ t('income.tagSummary') }}
          </h3>
          <span class="text-xs text-ink-4">{{ incomeTagBreakdown.length }} tag</span>
        </div>
        <div class="space-y-2">
          <div
            v-for="row in incomeTagBreakdown"
            :key="row.id"
            class="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-surface-2"
            @click="toggleTagFilter(row.id)"
          >
            <div class="mb-1 flex justify-between gap-2 text-xs">
              <span class="truncate font-medium text-ink-2 flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: finance.tag('tags', row.id)?.color ?? '#94a3b8' }"></span>
                <span>#{{ finance.tag('tags', row.id)?.name ?? t('common.unknown') }}</span>
                <span class="text-[10px] text-ink-4">({{ t('income.incomesCount', { n: row.count }, row.count) }})</span>
              </span>
              <span class="shrink-0 font-semibold text-accent">
                {{ money(row.total) }}
                <span class="font-normal text-ink-4">({{ percent(row.total / grandTotalForBreakdown) }})</span>
              </span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                class="h-full rounded-full transition-all"
                :style="{
                  width: `${(row.total / grandTotalForBreakdown) * 100}%`,
                  backgroundColor: finance.tag('tags', row.id)?.color ?? '#94a3b8',
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Banner Informativo Tag Attivo (con totale anno) -->
      <div
        v-if="selectedTag"
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent-line bg-accent-soft/80 p-3 text-xs text-accent-strongest shadow-2xs"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: selectedTag.color }"></span>
          <div class="min-w-0">
            <div class="font-bold truncate">
              #{{ selectedTag.name }}
              <span class="font-normal text-accent ml-1">
                ({{ t('income.incomesCount', { n: displayedIncomes.length }, displayedIncomes.length) }})
              </span>
            </div>
            <div v-if="finance.selectedMonth !== 'all' && yearCountForSelectedTag > displayedIncomes.length" class="text-[11px] text-accent mt-0.5">
              {{ t('income.yearTagTotal', { tag: selectedTag.name, amount: money(yearTotalForSelectedTag) }) }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-auto shrink-0">
          <button
            v-if="finance.selectedMonth !== 'all' && yearCountForSelectedTag > displayedIncomes.length"
            type="button"
            class="rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-accent-strong shadow-2xs hover:bg-accent-soft-2 transition-colors"
            @click="finance.selectedMonth = 'all'"
          >
            {{ t('income.viewAllYear') }}
          </button>
          <button
            type="button"
            class="rounded-md bg-accent-line/60 px-2 py-1 text-[11px] font-semibold text-accent-stronger hover:bg-accent-line transition-colors"
            @click="toggleTagFilter(null)"
          >
            {{ t('income.clearFilter') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Lista Entrate con Totale -->
    <EntryList
      :empty="!displayedIncomes.length"
      :empty-text="emptyText"
      :total-label="totalLabel"
      :total="money(total)"
    >
      <EntryRow
        v-for="e in displayedIncomes"
        :id="`entry-${e.id}`"
        :key="e.id"
        :name="e.name"
        :amount="money(e.amount)"
        amount-class="text-accent"
        :subtitle="e.notes"
        duplicable
        :class="{ 'ring-2 ring-accent rounded-xl bg-accent-soft/30 transition-all duration-500': highlightedId === e.id }"
        @edit="open(e)"
        @duplicate="duplicate(e)"
        @delete="confirmDelete(e.name, () => finance.deleteIncome(e.id))"
      >
        <template #meta>
          <span>{{ date(e.date) }}</span>
          <TagBadge kind="categories" :id="e.categoryId" />
          <TagBadge kind="paymentMethods" :id="e.paymentMethodId" />
          <TagBadge
            v-for="tagId in e.tagIds"
            :key="tagId"
            kind="tags"
            :id="tagId"
            clickable
            @click.stop="toggleTagFilter(tagId)"
          />
        </template>
      </EntryRow>
    </EntryList>

    <TransactionForm :open="formOpen" kind="income" :item="editing" :deletable="!!editing" @close="formOpen = false" @delete="remove" />
  </section>
</template>
