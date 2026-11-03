<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OneTimeExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import MonthSelector from '@/components/MonthSelector.vue'

const finance = useFinanceStore()
const { t, money, date, month, locale } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<OneTimeExpense | null>(null)
const total = computed(() => finance.oneTimeFiltered.reduce((acc, e) => acc + e.amount, 0))

const emptyText = computed(() => {
  if (finance.selectedMonth === 'all') return t('onetime.empty')
  const name = month(finance.selectedMonth)
  return t('onetime.emptyMonth', { month: locale.value === 'it' ? name.toLocaleLowerCase('it') : name })
})

function open(item: OneTimeExpense | null) {
  editing.value = item
  formOpen.value = true
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('onetime.title')">
      <div class="flex flex-wrap items-center justify-end gap-2">
        <MonthSelector />
        <button type="button" class="btn-primary" @click="open(null)">
          <i class="fa-solid fa-plus mr-1"></i> {{ t('app.add') }}
        </button>
      </div>
    </PageHeader>
    <EntryList
      :empty="!finance.oneTimeFiltered.length"
      :empty-text="emptyText"
      :total-label="t('common.total')"
      :total="money(total)"
    >
      <EntryRow
        v-for="e in finance.oneTimeFiltered"
        :key="e.id"
        :name="e.name"
        :amount="money(e.amount)"
        :subtitle="e.notes"
        @edit="open(e)"
        @delete="confirmDelete(e.name, () => finance.deleteOneTime(e.id))"
      >
        <template #meta>
          <span>{{ date(e.date) }}</span>
          <TagBadge kind="categories" :id="e.categoryId" />
          <TagBadge kind="paymentMethods" :id="e.paymentMethodId" />
        </template>
      </EntryRow>
    </EntryList>
    <TransactionForm :open="formOpen" kind="expense" :item="editing" @close="formOpen = false" />
  </section>
</template>
