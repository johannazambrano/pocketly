<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Income } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import TransactionForm from '@/components/TransactionForm.vue'

const finance = useFinanceStore()
const { t, money, date } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<Income | null>(null)
const total = computed(() => finance.incomesOfYear.reduce((acc, e) => acc + e.amount, 0))

function open(item: Income | null) {
  editing.value = item
  formOpen.value = true
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('income.title')" add-label="" @add="open(null)" />
    <EntryList
      :empty="!finance.incomesOfYear.length"
      :empty-text="t('income.empty')"
      :total-label="t('common.total')"
      :total="money(total)"
    >
      <EntryRow
        v-for="e in finance.incomesOfYear"
        :key="e.id"
        :name="e.name"
        :amount="money(e.amount)"
        amount-class="text-emerald-600"
        @edit="open(e)"
        @delete="confirmDelete(e.name, () => finance.deleteIncome(e.id))"
      >
        <template #meta>
          <span>{{ date(e.date) }}</span>
          <TagBadge kind="categories" :id="e.categoryId" />
          <TagBadge kind="paymentMethods" :id="e.paymentMethodId" />
        </template>
      </EntryRow>
    </EntryList>
    <TransactionForm :open="formOpen" kind="income" :item="editing" @close="formOpen = false" />
  </section>
</template>
