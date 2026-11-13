<script setup lang="ts">
import type { OneTimeExpense, QuickExpense } from '@/types/models'
import { useFormat } from '@/i18n'
import { useFinanceStore } from '@/stores/finance'
import { useQuickExpenseTrigger } from '@/composables/useQuickExpenseTrigger'
import { OTHER_COLOR } from '@/utils/colors'

const props = defineProps<{
  /** Aspetto compatto per stare dentro il modulo "Nuova spesa" invece che come scheda di pagina. */
  compact?: boolean
  /** Mostra il collegamento alle Impostazioni per modificare/riordinare i rapidi. */
  manageLink?: boolean
}>()

const emit = defineEmits<{
  prefill: [preset: QuickExpense]
  recorded: [expense: OneTimeExpense]
}>()

const finance = useFinanceStore()
const { t, money } = useFormat()
const { trigger, prefill } = useQuickExpenseTrigger()

function categoryColor(categoryId: string): string {
  return finance.tag('categories', categoryId)?.color ?? OTHER_COLOR
}

function onTrigger(preset: QuickExpense) {
  trigger(preset, {
    onPrefill: props.compact ? (p) => emit('prefill', p) : undefined,
    onRecorded: props.compact ? (e) => emit('recorded', e) : undefined,
  })
}

function onPrefill(preset: QuickExpense) {
  prefill(preset, props.compact ? (p) => emit('prefill', p) : undefined)
}
</script>

<template>
  <div v-if="finance.quickExpenses.length" :class="compact ? 'space-y-1.5 border-b border-line pb-3' : 'card space-y-2.5'">
    <div class="flex items-center justify-between gap-2">
      <h3 v-if="!compact" class="text-sm font-semibold text-ink-2">
        <i class="fa-solid fa-bolt mr-1 text-accent-icon" aria-hidden="true"></i> {{ t('quickExpenses.title') }}
      </h3>
      <span v-else class="field-label mb-0">{{ t('quickExpenses.title') }}</span>
      <RouterLink
        v-if="manageLink"
        to="/impostazioni#inserimenti-rapidi"
        class="text-xs font-medium text-accent hover:underline"
      >
        {{ t('quickExpenses.manage') }}
      </RouterLink>
    </div>

    <div class="flex flex-wrap gap-2">
      <template v-for="q in finance.quickExpenses" :key="q.id">
        <div
          v-if="q.amount && q.amount > 0"
          class="inline-flex min-h-10 max-w-full items-stretch overflow-hidden rounded-full border border-line bg-surface-2 text-xs font-medium text-ink-2 shadow-2xs"
        >
          <button
            type="button"
            class="inline-flex min-w-0 items-center gap-1.5 px-3 py-1.5 transition-colors hover:bg-surface-3 active:bg-surface-4"
            @click="onTrigger(q)"
          >
            <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: categoryColor(q.categoryId) }" aria-hidden="true"></span>
            <span class="truncate">{{ q.name }}</span>
            <span class="shrink-0 font-semibold text-ink tabular-nums">{{ money(q.amount) }}</span>
          </button>
          <button
            type="button"
            class="inline-flex w-9 shrink-0 items-center justify-center border-l border-line text-ink-4 transition-colors hover:bg-surface-3 hover:text-ink-2"
            :aria-label="t('quickExpenses.prefillLabel', { name: q.name })"
            :title="t('quickExpenses.prefillLabel', { name: q.name })"
            @click="onPrefill(q)"
          >
            <i class="fa-solid fa-pen text-[11px]" aria-hidden="true"></i>
          </button>
        </div>

        <button
          v-else
          type="button"
          class="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-2 shadow-2xs transition-colors hover:bg-surface-3 active:bg-surface-4"
          @click="onTrigger(q)"
        >
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: categoryColor(q.categoryId) }" aria-hidden="true"></span>
          <span class="truncate">{{ q.name }}</span>
          <i class="fa-solid fa-pen-to-square shrink-0 text-[11px] text-ink-4" aria-hidden="true"></i>
        </button>
      </template>
    </div>
  </div>
</template>
