<script setup lang="ts">
import { computed } from 'vue'
import { useFormat } from '@/i18n'

/**
 * Il riquadro principale della dashboard. In alto una sola cifra grande, la risposta del periodo (di solito il previsto,
 * per un periodo passato il saldo finale), con sotto il saldo di oggi in una frase; poi entrate e uscite che spiegano
 * la cifra e di cosa sono fatte le uscite. La disposizione non dipende dai numeri: cambia solo il colore.
 */
interface Figure {
  label: string
  value: number
  hint?: string
}

/**
 * La cifra grande: con `today` sotto compare il risultato fino a oggi, detto con la sua portata ("Da inizio novembre a
 * oggi: …"), con `note` una frase che dice cosa conta.
 */
interface Main extends Figure {
  today?: { label: string; value: number }
  note?: string
}

/** Una parte delle uscite: ricorrenti o variabili, con il colore del suo pallino e una nota facoltativa. */
interface Part {
  key: string
  label: string
  value: number
  dot: string
  note?: string
}

const props = defineProps<{
  main: Main
  income: Figure
  expenses: Figure
  split?: Part[] | null
}>()

const { t, money } = useFormat()

/**
 * Le medie e i confronti sotto ricorrenti e variabili servono a chi vuole approfondire, non al colpo d'occhio:
 * restano chiusi finché non si chiede di vederli. Chi usa il riquadro può tenere la scelta con `v-model:notes-open`.
 */
const notesOpen = defineModel<boolean>('notesOpen', { default: false })
const hasNotes = computed(() => (props.split ?? []).some((p) => p.note))

/** Larghezza di ogni parte nella barretta, in proporzione al totale delle parti (che coincide con le uscite mostrate). */
const width = (value: number) => {
  const total = (props.split ?? []).reduce((acc, p) => acc + p.value, 0)
  return `${total > 0 ? (value / total) * 100 : 0}%`
}

/**
 * Il rosso ha un solo significato in tutta la dashboard: sei, o sarai, sotto zero (un saldo finale o un previsto
 * negativo). Le uscite normali, le scadenze vicine e gli zeri restano in colori neutri, così il rosso quando compare
 * si nota davvero.
 */
const signColor = (v: number) => (v >= 0 ? 'text-blue-600' : 'text-rose-600')
/** Le entrate sono verdi solo quando c'è qualcosa: uno zero non è una buona notizia. */
const incomeColor = computed(() => (props.income.value > 0 ? 'text-emerald-700' : 'text-slate-800'))

/**
 * La cifra grande cresce di una misura sugli schermi più larghi. Le cifre non vanno mai a capo, quindi quelle molto
 * lunghe (dalle centinaia di migliaia in su) scendono di una misura per restare dentro il riquadro anche sul telefono.
 */
const LONG = 11
const heroSize = (v: number) => (money(v).length > LONG ? 'text-2xl lg:text-3xl' : 'text-3xl lg:text-4xl')
const pairSize = (v: number) => (money(v).length > LONG + 1 ? 'text-base' : 'text-lg')
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" :aria-label="main.label">
    <div class="grid">
      <div class="px-4 pt-4 pb-3 md:py-5">
        <h3 class="text-xs font-medium text-balance text-slate-500">{{ main.label }}</h3>
        <p class="mt-1 font-bold tracking-tight whitespace-nowrap" :class="[heroSize(main.value), signColor(main.value)]">
          {{ money(main.value) }}
        </p>
        <!-- Il risultato fino a oggi non compete con la cifra grande: è una frase, con l'importo in evidenza. -->
        <p v-if="main.today !== undefined" class="mt-1.5 text-sm font-medium text-slate-700">
          {{ main.today.label }}
          <b class="font-bold whitespace-nowrap text-slate-800">{{ money(main.today.value) }}</b>
        </p>
        <p v-if="main.note" class="mt-1.5 text-sm font-medium text-slate-700">{{ main.note }}</p>
        <p v-if="main.hint" class="mt-1 text-xs text-slate-500">{{ main.hint }}</p>
      </div>

      <!-- Le due colonne condividono le righe (subgrid): se un'etichetta va a capo, le cifre restano allineate. -->
      <div
        class="grid grid-cols-2 grid-rows-[auto_auto_1fr] border-t border-slate-100"
      >
        <div class="row-span-3 grid grid-rows-subgrid gap-y-1 px-4 py-3 md:py-5">
          <p class="text-xs font-medium text-balance text-slate-500">{{ income.label }}</p>
          <p class="font-bold whitespace-nowrap" :class="[pairSize(income.value), incomeColor]">{{ money(income.value) }}</p>
          <p v-if="income.hint" class="text-xs leading-snug text-slate-500">{{ income.hint }}</p>
        </div>
        <div class="row-span-3 grid grid-rows-subgrid gap-y-1 border-l border-slate-100 px-4 py-3 md:py-5">
          <p class="text-xs font-medium text-balance text-slate-500">{{ expenses.label }}</p>
          <p class="font-bold whitespace-nowrap text-slate-800" :class="pairSize(expenses.value)">{{ money(expenses.value) }}</p>
          <p v-if="expenses.hint" class="text-xs leading-snug text-slate-500">{{ expenses.hint }}</p>
        </div>
      </div>
    </div>

    <!-- Di cui: le uscite mostrate sopra, divise tra ricorrenti e variabili. Le due parti sommano sempre il totale. -->
    <div v-if="split?.length" class="border-t border-slate-100 px-4 py-3">
      <p class="text-xs font-medium text-slate-500">{{ t('dashboard.splitTitle') }}</p>
      <div class="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div v-for="part in split" :key="part.key" class="h-full first:rounded-l-full last:rounded-r-full" :class="part.dot" :style="{ width: width(part.value) }"></div>
      </div>
      <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 md:flex md:gap-x-12">
        <div v-for="part in split" :key="part.key" class="min-w-0 md:max-w-xs">
          <dt class="flex items-center gap-1.5 text-xs text-slate-600">
            <span class="h-2 w-2 shrink-0 rounded-full" :class="part.dot" aria-hidden="true"></span>{{ part.label }}
          </dt>
          <dd class="text-sm font-semibold whitespace-nowrap text-slate-800">{{ money(part.value) }}</dd>
          <dd v-if="part.note && notesOpen" class="text-xs leading-snug text-slate-500">
            {{ part.note }}
          </dd>
        </div>
      </dl>
      <button
        v-if="hasNotes"
        type="button"
        class="-ml-1 mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
        :aria-expanded="notesOpen"
        @click="notesOpen = !notesOpen"
      >
        <span aria-hidden="true"><i class="fa-solid fa-chevron-down text-xs transition-transform" :class="{ 'rotate-180': notesOpen }"></i></span>
        {{ t(notesOpen ? 'dashboard.splitNotesHide' : 'dashboard.splitNotesShow') }}
      </button>
    </div>
  </section>
</template>
