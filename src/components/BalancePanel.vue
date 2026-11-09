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

/** Una parte delle uscite: ricorrenti o variabili, con il colore del suo pallino e una nota facoltativa. */
interface Part {
  key: string
  label: string
  value: number
  dot: string
  note?: string
}

const props = defineProps<{ balance: Figure; income: Figure; expenses: Figure; projection?: Figure | null; split?: Part[] | null }>()

const { t, money } = useFormat()

/** Larghezza di ogni parte nella barretta, in proporzione al totale delle parti (che coincide con le uscite mostrate). */
const width = (value: number) => {
  const total = (props.split ?? []).reduce((acc, p) => acc + p.value, 0)
  return `${total > 0 ? (value / total) * 100 : 0}%`
}

const signColor = (v: number) => (v >= 0 ? 'text-blue-600' : 'text-rose-600')
/** La riga della previsione ha lo sfondo grigio chiaro: serve la tonalità più scura per restare sopra 4,5:1. */
const projectionColor = (v: number) => (v >= 0 ? 'text-blue-700' : 'text-rose-700')
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" :aria-label="balance.label">
    <div class="grid md:grid-cols-[1.3fr_1fr_1fr]">
      <div class="px-4 pt-4 pb-3 md:py-5 md:pr-6">
        <h3 class="text-xs font-medium text-balance text-slate-500">{{ balance.label }}</h3>
        <p class="mt-1 text-3xl font-bold tracking-tight whitespace-nowrap md:text-4xl" :class="signColor(balance.value)">
          {{ money(balance.value) }}
        </p>
        <p v-if="balance.hint" class="mt-1 text-xs text-slate-500">{{ balance.hint }}</p>
      </div>

      <div
        class="grid grid-cols-2 border-t border-slate-100 md:col-span-2 md:border-t-0 md:border-l"
      >
        <div class="px-4 py-3 md:py-5">
          <h3 class="text-xs font-medium text-balance text-slate-500">{{ income.label }}</h3>
          <p class="mt-1 text-lg font-bold whitespace-nowrap text-emerald-700">{{ money(income.value) }}</p>
          <p v-if="income.hint" class="mt-1 text-xs leading-snug text-slate-500">{{ income.hint }}</p>
        </div>
        <div class="border-l border-slate-100 px-4 py-3 md:py-5">
          <h3 class="text-xs font-medium text-balance text-slate-500">{{ expenses.label }}</h3>
          <p class="mt-1 text-lg font-bold whitespace-nowrap text-rose-600">{{ money(expenses.value) }}</p>
          <p v-if="expenses.hint" class="mt-1 text-xs leading-snug text-slate-500">{{ expenses.hint }}</p>
        </div>
      </div>
    </div>

    <!-- Di cui: le uscite mostrate sopra, divise tra ricorrenti e variabili. Le due parti sommano sempre il totale. -->
    <div v-if="split?.length" class="border-t border-slate-100 px-4 py-3">
      <h3 class="text-xs font-medium text-slate-500">{{ t('dashboard.splitTitle') }}</h3>
      <div class="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div v-for="part in split" :key="part.key" class="h-full first:rounded-l-full last:rounded-r-full" :class="part.dot" :style="{ width: width(part.value) }"></div>
      </div>
      <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        <div v-for="part in split" :key="part.key" class="min-w-0">
          <dt class="flex items-center gap-1.5 text-xs text-slate-600">
            <span class="h-2 w-2 shrink-0 rounded-full" :class="part.dot" aria-hidden="true"></span>{{ part.label }}
          </dt>
          <dd class="text-sm font-semibold whitespace-nowrap text-slate-800">{{ money(part.value) }}</dd>
          <dd v-if="part.note" class="text-xs leading-snug text-slate-500">{{ part.note }}</dd>
        </div>
      </dl>
    </div>

    <div
      v-if="projection"
      class="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t border-slate-100 bg-slate-50 px-4 py-3"
    >
      <h3 class="text-sm font-semibold text-slate-700">{{ projection.label }}</h3>
      <p class="text-lg font-bold whitespace-nowrap" :class="projectionColor(projection.value)">{{ money(projection.value) }}</p>
      <p v-if="projection.hint" class="col-span-2 text-xs text-slate-500">{{ projection.hint }}</p>
    </div>
  </section>
</template>
