<script setup lang="ts">
import { useHighlight } from '@/composables/useHighlight'
import { computed, ref } from 'vue'
import type { OneTimeExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { todayIso } from '@/utils/dates'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import MonthSelector from '@/components/MonthSelector.vue'
import QuickExpenseBar from '@/components/QuickExpenseBar.vue'
import { usePageAction } from '@/composables/usePageAction'
import { useTagFilteredEntries } from '@/composables/useTagFilteredEntries'
import TagFilterPanel from '@/components/TagFilterPanel.vue'

const finance = useFinanceStore()
const { t, money, date, month, locale } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<OneTimeExpense | null>(null)
const {
  selectedTagId,
  selectedTag,
  displayedItems: displayedExpenses,
  total,
  yearTotalForSelectedTag,
  yearCountForSelectedTag,
  breakdown,
  grandTotalForBreakdown,
  activeYearTags,
  toggleTagFilter,
  revealEntry,
} = useTagFilteredEntries({
  filtered: () => finance.oneTimeFiltered,
  ofYear: () => finance.oneTimeOfYear,
  lookupTag: (id) => finance.tag('tags', id),
})
const highlightedId = useHighlight((id) => `entry-${id}`, revealEntry)

const emptyText = computed(() => {
  if (selectedTag.value) {
    return t('onetime.emptyTag', { tag: selectedTag.value.name })
  }
  if (finance.selectedMonth === 'all') return t('onetime.empty')
  const name = month(finance.selectedMonth)
  return t('onetime.emptyMonth', { month: locale.value === 'it' ? name.toLocaleLowerCase('it') : name })
})

const totalLabel = computed(() => {
  if (selectedTag.value) {
    return `${t('common.total')} (#${selectedTag.value.name})`
  }
  return t('common.total')
})

function open(item: OneTimeExpense | null) {
  editing.value = item
  formOpen.value = true
}
usePageAction(() => ({ label: t('onetime.new'), run: () => open(null) }))

function duplicate(item: OneTimeExpense) {
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
    finance.deleteOneTime(item.id)
    formOpen.value = false
  })
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('onetime.title')">
      <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <MonthSelector />
        <button type="button" class="btn-primary page-add" @click="open(null)">
          <i class="fa-solid fa-plus mr-1"></i> {{ t('app.add') }}
        </button>
      </div>
    </PageHeader>

    <QuickExpenseBar manage-link />

    <TagFilterPanel
      section="onetime"
      :tags="activeYearTags"
      :breakdown="breakdown"
      :grand-total="grandTotalForBreakdown"
      :selected-tag-id="selectedTagId"
      :selected-tag="selectedTag"
      :shown-count="displayedExpenses.length"
      :year-count="yearCountForSelectedTag"
      :year-total="yearTotalForSelectedTag"
      @toggle="toggleTagFilter"
    />

    <!-- Lista Spese con Totale -->
    <EntryList
      :empty="!displayedExpenses.length"
      :empty-text="emptyText"
      :total-label="totalLabel"
      :total="money(total)"
    >
      <EntryRow
        v-for="e in displayedExpenses"
        :id="`entry-${e.id}`"
        :key="e.id"
        :name="e.name"
        :amount="money(e.amount)"
        :subtitle="e.notes"
        duplicable
        :class="{ 'ring-2 ring-accent rounded-xl bg-accent-soft/30 transition-all duration-500': highlightedId === e.id }"
        @edit="open(e)"
        @duplicate="duplicate(e)"
        @delete="confirmDelete(e.name, () => finance.deleteOneTime(e.id))"
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

    <TransactionForm :open="formOpen" kind="expense" :item="editing" :deletable="!!editing" @close="formOpen = false" @delete="remove" />
  </section>
</template>
