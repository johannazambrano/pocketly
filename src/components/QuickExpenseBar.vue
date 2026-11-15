<script setup lang="ts">
import { useFormat } from '@/i18n'
import { useFinanceStore } from '@/stores/finance'
import { useQuickExpenseTrigger } from '@/composables/useQuickExpenseTrigger'
import { OTHER_COLOR } from '@/utils/colors'

/** Barra degli inserimenti rapidi: sta nella Dashboard e in Variabili, non nel modulo «Nuova spesa» (lì ci sono i Frequenti). */
defineProps<{
  /** Mostra il collegamento alle Impostazioni per modificare/riordinare i rapidi. */
  manageLink?: boolean
}>()

const finance = useFinanceStore()
const { t, money } = useFormat()
const { trigger, prefill } = useQuickExpenseTrigger()

function categoryColor(categoryId: string): string {
  return finance.tag('categories', categoryId)?.color ?? OTHER_COLOR
}

</script>

<template>
  <div v-if="finance.quickExpenses.length" class="card space-y-2.5">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-ink-2">
        <i class="fa-solid fa-bolt mr-1 text-accent-icon" aria-hidden="true"></i> {{ t('quickExpenses.title') }}
      </h3>
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
            @click="trigger(q)"
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
            @click="prefill(q)"
          >
            <i class="fa-solid fa-pen text-[11px]" aria-hidden="true"></i>
          </button>
        </div>

        <button
          v-else
          type="button"
          class="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-2 shadow-2xs transition-colors hover:bg-surface-3 active:bg-surface-4"
          @click="trigger(q)"
        >
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: categoryColor(q.categoryId) }" aria-hidden="true"></span>
          <span class="truncate">{{ q.name }}</span>
          <i class="fa-solid fa-pen-to-square shrink-0 text-[11px] text-ink-4" aria-hidden="true"></i>
        </button>
      </template>
    </div>
  </div>
</template>
