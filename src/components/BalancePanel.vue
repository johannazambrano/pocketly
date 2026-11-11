<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
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
  /** Le entrate stimate su cui conta la cifra, dette subito sotto di essa. */
  estimate?: string
  /** Colore neutro invece di blu/rosso: la cifra è positiva solo grazie alla stima. */
  neutral?: boolean
  note?: string
}

/**
 * Il conto che porta alla cifra grande, aperto solo a richiesta: da dove si parte, cosa entra e cosa esce, fino al
 * risultato. `estimate` dice su cosa si basa la stima delle entrate e porta a dove la si cambia.
 */
export interface Explain {
  rows: { key: string; label: string; note?: string; value: number }[]
  total: { label: string; value: number; neutral?: boolean }
  estimate?: string
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
  explain?: Explain | null
}>()

const { t, money } = useFormat()

/** "Come si arriva a questa cifra": chiuso di serie, perché serve a chi vuole capire, non al colpo d'occhio. */
const explainOpen = ref(false)
const explainId = useId()
/** Le righe del conto hanno sempre il segno: si leggono come una somma. */
const signed = (v: number) => (v > 0 ? `+${money(v)}` : money(v))

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
    <!--
      Sui telefoni tutto in colonna. Da schermo largo la cifra grande e la coppia entrate/uscite stanno affiancate:
      una cifra sola in un riquadro largo lasciava mezza riga vuota.
    -->
    <div class="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div class="px-4 pt-4 pb-3 md:py-5 lg:border-r lg:border-slate-100">
        <h3 class="text-xs font-medium text-balance text-slate-500">{{ main.label }}</h3>
        <p class="mt-1 font-bold tracking-tight whitespace-nowrap" :class="[heroSize(main.value), main.neutral ? 'text-slate-800' : signColor(main.value)]">
          {{ money(main.value) }}
        </p>
        <!-- Il risultato fino a oggi non compete con la cifra grande: è una frase, con l'importo in evidenza. -->
        <p v-if="main.estimate" class="mt-1 flex items-start gap-1.5 text-sm font-medium text-slate-700">
          <i class="fa-solid fa-circle-info mt-1 text-xs text-slate-500" aria-hidden="true"></i>{{ main.estimate }}
        </p>
        <p v-if="main.today !== undefined" class="mt-1.5 text-sm font-medium text-slate-700">
          {{ main.today.label }}
          <b class="font-bold whitespace-nowrap text-slate-800">{{ money(main.today.value) }}</b>
        </p>
        <p v-if="main.note" class="mt-1.5 text-sm font-medium text-slate-700">{{ main.note }}</p>
        <p v-if="main.hint" class="mt-1 text-xs text-slate-500">{{ main.hint }}</p>

        <template v-if="explain">
          <button
            type="button"
            class="-ml-1 mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
            :aria-expanded="explainOpen"
            :aria-controls="explainId"
            @click="explainOpen = !explainOpen"
          >
            <span aria-hidden="true"><i class="fa-solid fa-chevron-down text-xs transition-transform" :class="{ 'rotate-180': explainOpen }"></i></span>
            {{ t('dashboard.explainToggle') }}
          </button>
          <div v-show="explainOpen" :id="explainId" class="mt-1 rounded-lg bg-slate-50 px-3 py-2">
            <dl>
              <div v-for="row in explain.rows" :key="row.key" class="flex items-baseline justify-between gap-3 py-1">
                <dt class="min-w-0 text-sm text-slate-700">
                  {{ row.label }}
                  <span v-if="row.note" class="block text-xs text-slate-600">{{ row.note }}</span>
                </dt>
                <dd class="shrink-0 text-sm font-semibold whitespace-nowrap text-slate-800">{{ signed(row.value) }}</dd>
              </div>
              <div class="mt-1 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2">
                <dt class="text-sm font-semibold text-slate-800">{{ explain.total.label }}</dt>
                <dd class="shrink-0 text-sm font-bold whitespace-nowrap" :class="explain.total.neutral ? 'text-slate-800' : signColor(explain.total.value)">{{ money(explain.total.value) }}</dd>
              </div>
            </dl>
            <p v-if="explain.estimate" class="mt-2 text-xs leading-snug text-slate-600">
              {{ explain.estimate }}
              <RouterLink to="/previsioni" class="font-medium text-emerald-700 underline hover:text-emerald-800">{{ t('dashboard.explainChange') }}</RouterLink>
            </p>
          </div>
        </template>
      </div>

      <!-- Le due colonne condividono le righe (subgrid): se un'etichetta va a capo, le cifre restano allineate. -->
      <div
        class="grid grid-cols-2 grid-rows-[auto_auto_1fr] content-start border-t border-slate-100 lg:border-t-0"
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
      <!--
        Ogni parte sta sotto il suo colore nella barretta: la prima a sinistra, dove comincia, l'ultima allineata a destra,
        dove finisce. Così la legenda occupa tutta la larghezza della barra e nessuna metà resta vuota sugli schermi larghi.
      -->
      <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        <div v-for="part in split" :key="part.key" class="min-w-0 last:text-right">
          <dt class="flex items-center gap-1.5 text-xs text-slate-600 [div:last-child>&]:justify-end">
            <span class="h-2 w-2 shrink-0 rounded-full" :class="part.dot" aria-hidden="true"></span>{{ part.label }}
          </dt>
          <dd class="text-sm font-semibold whitespace-nowrap text-slate-800">{{ money(part.value) }}</dd>
          <!-- Il confronto con la media, sempre visibile: è la risposta a "come sto andando" su questa parte. -->
          <dd v-if="part.note" class="text-xs leading-snug text-slate-500">
            {{ part.note }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
