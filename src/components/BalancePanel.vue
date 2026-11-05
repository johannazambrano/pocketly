<script setup lang="ts">
import { useFormat } from '@/i18n'

/**
 * Il riquadro principale della dashboard: il saldo in primo piano, entrate e uscite che lo spiegano,
 * e in fondo la previsione, cioè dove si arriverà. Legge dall'alto in basso come una frase:
 * "hai questo, perché è entrato questo e uscito questo, e arriverai qui".
 */
interface Figure {
  label: string
  value: number
  hint?: string
}

defineProps<{ balance: Figure; income: Figure; expenses: Figure; projection?: Figure | null }>()

const { money } = useFormat()

const signColor = (v: number) => (v >= 0 ? 'text-blue-600' : 'text-rose-600')
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" :aria-label="balance.label">
    <div class="grid md:grid-cols-[1.3fr_1fr_1fr]">
      <div class="px-4 pt-4 pb-3 md:py-5 md:pr-6">
        <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{{ balance.label }}</h3>
        <p class="mt-1 text-3xl font-bold tracking-tight md:text-4xl" :class="signColor(balance.value)">
          {{ money(balance.value) }}
        </p>
        <p v-if="balance.hint" class="mt-1 text-xs text-slate-500">{{ balance.hint }}</p>
      </div>

      <div
        class="grid grid-cols-2 border-t border-slate-100 md:col-span-2 md:border-t-0 md:border-l"
      >
        <div class="px-4 py-3 md:py-5">
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{{ income.label }}</h3>
          <p class="mt-1 text-lg font-bold text-emerald-600">{{ money(income.value) }}</p>
          <p v-if="income.hint" class="mt-0.5 text-xs text-slate-500">{{ income.hint }}</p>
        </div>
        <div class="border-l border-slate-100 px-4 py-3 md:py-5">
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{{ expenses.label }}</h3>
          <p class="mt-1 text-lg font-bold text-rose-600">{{ money(expenses.value) }}</p>
          <p v-if="expenses.hint" class="mt-0.5 text-xs text-slate-500">{{ expenses.hint }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="projection"
      class="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t border-slate-100 bg-slate-50 px-4 py-3"
    >
      <h3 class="text-sm font-semibold text-slate-700">{{ projection.label }}</h3>
      <p class="text-lg font-bold" :class="signColor(projection.value)">{{ money(projection.value) }}</p>
      <p v-if="projection.hint" class="col-span-2 text-xs text-slate-500">{{ projection.hint }}</p>
    </div>
  </section>
</template>
