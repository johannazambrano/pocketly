<script setup lang="ts">
import { ref } from 'vue'
import type { QuickExpense } from '@/types/models'
import { useFormat } from '@/i18n'
import { useFinanceStore } from '@/stores/finance'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { OTHER_COLOR } from '@/utils/colors'
import TagBadge from './TagBadge.vue'
import QuickExpenseForm from './QuickExpenseForm.vue'

const finance = useFinanceStore()
const { t, money } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<QuickExpense | null>(null)

function openForm(item: QuickExpense | null) {
  editing.value = item
  formOpen.value = true
}

function removeFromModal() {
  const item = editing.value
  if (!item) return
  void confirmDelete(item.name, () => {
    finance.deleteQuickExpense(item.id)
    formOpen.value = false
  })
}

function categoryColor(categoryId: string): string {
  return finance.tag('categories', categoryId)?.color ?? OTHER_COLOR
}
</script>

<template>
  <div id="inserimenti-rapidi" class="card space-y-3 scroll-mt-24">
    <div class="flex items-start justify-between gap-2">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-ink-2">
          <i class="fa-solid fa-bolt mr-1 text-accent-icon" aria-hidden="true"></i> {{ t('quickExpenses.title') }}
        </h3>
        <p class="text-xs text-ink-4">{{ t('quickExpenses.hint') }}</p>
      </div>
      <button
        type="button"
        class="min-h-10 shrink-0 rounded-lg bg-chrome-2 px-3 text-xs font-medium text-on-color hover:bg-chrome-3"
        @click="openForm(null)"
      >
        <i class="fa-solid fa-plus mr-1" aria-hidden="true"></i>{{ t('app.add') }}
      </button>
    </div>

    <p v-if="!finance.quickExpenses.length" class="text-xs text-ink-4">{{ t('quickExpenses.empty') }}</p>

    <ul v-else class="divide-y divide-line-soft">
      <li v-for="(q, index) in finance.quickExpenses" :key="q.id" class="flex items-center justify-between gap-2 py-2">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: categoryColor(q.categoryId) }" aria-hidden="true"></span>
            <span class="truncate text-sm font-medium text-ink">{{ q.name }}</span>
            <span v-if="q.amount" class="shrink-0 text-xs font-semibold text-ink-2 tabular-nums">{{ money(q.amount) }}</span>
            <span v-else class="shrink-0 text-xs text-ink-4">{{ t('quickExpenses.variableAmount') }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 pl-4 text-xs text-ink-4">
            <TagBadge kind="categories" :id="q.categoryId" />
            <TagBadge kind="paymentMethods" :id="q.paymentMethodId" />
            <TagBadge v-for="tagId in q.tagIds" :key="tagId" kind="tags" :id="tagId" />
            <span v-if="q.notes" class="truncate">{{ q.notes }}</span>
          </div>
        </div>

        <div class="flex shrink-0 items-center">
          <template v-if="finance.quickExpenses.length > 1">
            <button
              type="button"
              class="icon-btn text-xs text-ink-4"
              :disabled="index === 0"
              :aria-label="t('quickExpenses.moveUp', { name: q.name })"
              @click="finance.moveQuickExpense(q.id, -1)"
            >
              <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="icon-btn text-xs text-ink-4"
              :disabled="index === finance.quickExpenses.length - 1"
              :aria-label="t('quickExpenses.moveDown', { name: q.name })"
              @click="finance.moveQuickExpense(q.id, 1)"
            >
              <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
            </button>
          </template>
          <button
            type="button"
            class="icon-btn text-xs text-recurring"
            :aria-label="`${t('common.edit')}: ${q.name}`"
            @click="openForm(q)"
          >
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="icon-btn text-xs text-negative-light"
            :aria-label="`${t('common.delete')}: ${q.name}`"
            @click="confirmDelete(q.name, () => finance.deleteQuickExpense(q.id))"
          >
            <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
          </button>
        </div>
      </li>
    </ul>

    <QuickExpenseForm
      :open="formOpen"
      :item="editing"
      :deletable="!!editing"
      @close="formOpen = false"
      @delete="removeFromModal"
    />
  </div>
</template>
