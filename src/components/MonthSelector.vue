<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { parseIsoDate } from '@/utils/dates'
import { useMonthStep, type MonthTarget } from '@/composables/useMonthStep'
import { useAppearanceStore } from '@/stores/appearance'

/**
 * `heading`: su iPhone il titolo grande della pagina è il periodo stesso (la dashboard): il selettore lo disegna e lo
 * rende il menu del periodo, come il titolo di Calendario. Senza, su iPhone il menu è un testo nella tinta.
 */
const props = defineProps<{ heading?: string }>()

const finance = useFinanceStore()
const appearance = useAppearanceStore()
const { t, month, locale } = useFormat()

const todayParts = computed(() => parseIsoDate(finance.today))
const currentMonth = computed(() => todayParts.value.month)
const isCurrentYear = computed(() => finance.selectedYear === todayParts.value.year)
const onCurrentMonth = computed(() => isCurrentYear.value && finance.selectedMonth === currentMonth.value)

/** Dopo "Oggi" il pulsante si nasconde: il focus passa al menu, che resta dov'era, invece di perdersi. */
const select = ref<HTMLSelectElement | null>(null)
function goToCurrentMonth() {
  finance.selectedYear = todayParts.value.year
  finance.selectedMonth = currentMonth.value
  select.value?.focus()
}

const { previous, next, go } = useMonthStep()

/**
 * Tasti ← → per il periodo prima e dopo, su qualunque pagina mostri questo filtro (dashboard, dettaglio, spese
 * variabili). Non agiscono mentre si scrive, quando il focus è su un menu (lì le frecce cambiano già la scelta) o con
 * una finestra aperta.
 */
function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const el = e.target as HTMLElement | null
  if (el?.closest('input, select, textarea, [contenteditable="true"]')) return
  if (document.querySelector('[aria-modal="true"]')) return
  if (go(e.key === 'ArrowLeft' ? previous.value : next.value)) e.preventDefault()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

/** Se dopo il passo la freccia si spegne (fine dell'elenco), il focus passa al menu invece di perdersi sulla pagina. */
async function step(target: MonthTarget | null, event: MouseEvent) {
  const button = event.currentTarget as HTMLButtonElement
  if (!go(target)) return
  await nextTick()
  if (button.disabled) select.value?.focus()
}

/**
 * Il nome del periodo su cui porta una freccia: l'anno compare solo quando cambia ("dicembre 2025", ma "ottobre"). In
 * una frase italiana il mese va in minuscolo ("Mese precedente: ottobre"); in inglese resta maiuscolo.
 */
function targetName(target: MonthTarget): string {
  if (target.month === 'all') return String(target.year)
  const name = locale.value === 'it' ? month(target.month).toLocaleLowerCase('it') : month(target.month)
  return target.year === finance.selectedYear ? name : `${name} ${target.year}`
}
/** Sull'anno intero le frecce cambiano anno, su un mese cambiano mese: l'etichetta dice quale. */
const fromAll = computed(() => finance.selectedMonth === 'all')
const previousLabel = computed(() => {
  if (!previous.value) return t(fromAll.value ? 'dashboard.previousYearNone' : 'dashboard.previousMonthNone')
  return t(fromAll.value ? 'dashboard.previousYear' : 'dashboard.previousMonth', { month: targetName(previous.value) })
})
const nextLabel = computed(() => {
  if (!next.value) return t(fromAll.value ? 'dashboard.nextYearNone' : 'dashboard.nextMonthNone')
  return t(fromAll.value ? 'dashboard.nextYear' : 'dashboard.nextMonth', { month: targetName(next.value) })
})

/**
 * Un solo menu per il periodo, con l'anno dentro: le voci sono raggruppate per anno (il più recente in cima), e ogni
 * anno comincia con "Tutto il 2026", poi i mesi; quello di oggi è segnato. Il valore è "anno:mese" ("2026:10",
 * "2026:all"), così il menu cambia anno e mese insieme.
 */
const groups = computed(() =>
  [...finance.years]
    .sort((a, b) => b - a)
    .map((year) => ({
      year,
      options: [
        { value: `${year}:all`, label: t('dashboard.yearTitle', { year }) },
        ...Array.from({ length: 12 }, (_, m) => ({
          value: `${year}:${m}`,
          label: year === todayParts.value.year && m === currentMonth.value ? `${month(m)} · ${t('dashboard.todayMark')}` : month(m),
        })),
      ],
    })),
)
const period = computed({
  get: () => `${finance.selectedYear}:${finance.selectedMonth}`,
  set: (value: string) => {
    const [y, m] = value.split(':')
    finance.selectedYear = Number(y)
    finance.selectedMonth = m === 'all' ? 'all' : Number(m)
  },
})
/** Il periodo scelto per esteso, come lo mostrano il testo, la chip e il menu chiuso: "Novembre 2026", "Tutto il 2026". */
const periodLabel = computed(() =>
  finance.selectedMonth === 'all'
    ? t('dashboard.yearTitle', { year: finance.selectedYear })
    : `${month(finance.selectedMonth)} ${finance.selectedYear}`,
)

/**
 * Il titolo grande di iPhone si stringe quando è lungo ("Novembre 2026") o lo schermo è stretto (iPhone SE, 320 px),
 * per lasciare posto a "Oggi" e alle frecce senza tagliare il nome del periodo.
 */
const headingSize = computed(() =>
  (props.heading?.length ?? 0) > 10 ? 'text-[28px] max-[359px]:text-[20px]' : 'text-[34px] max-[359px]:text-[22px]',
)

/** iPhone: frecce tonde nella tinta, sul fondo grigio della pagina. */
const roundArrow =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent transition-colors disabled:text-ink-6'
/** Android: frecce come icon button di Material e il periodo come chip con il menu. */
const iconArrow =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 disabled:text-ink-6 disabled:hover:bg-transparent'

const arrow =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-strong disabled:cursor-not-allowed disabled:text-ink-6 disabled:hover:bg-surface'
/** Il menu vero, trasparente sopra il testo disegnato: il tocco e il lettore di schermo trovano un menu, l'occhio il periodo. */
const overlay = 'absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0'
</script>

<template>
  <!--
    Un solo posto per il periodo, con l'anno dentro: il menu elenca tutti i periodi raggruppati per anno ("Tutto il 2026",
    poi i mesi). ‹ › cambiano mese, o anno quando si guarda l'anno intero; "Oggi" compare solo fuori dal mese di oggi.
    iPhone: il titolo (o un testo nella tinta) è il menu, frecce tonde accanto. Android: ‹ · chip con il menu · ›.
    PC: frecce e menu in un solo controllo. Ovunque restano i tasti ← →.
  -->
  <div v-if="appearance.platform === 'ios'" class="flex w-full min-w-0 items-center gap-1.5">
    <div class="relative flex min-w-0 flex-1 items-center">
      <h2 v-if="heading" class="flex min-w-0 items-center gap-2 leading-tight font-bold tracking-tight text-ink" :class="headingSize">
        <span class="truncate">{{ heading }}</span>
        <i class="fa-solid fa-chevron-down shrink-0 text-base text-accent" aria-hidden="true"></i>
      </h2>
      <span v-else class="flex min-w-0 items-center gap-1.5 text-[17px] font-semibold text-accent" aria-hidden="true">
        <span class="truncate">{{ periodLabel }}</span>
        <i class="fa-solid fa-chevron-down shrink-0 text-xs"></i>
      </span>
      <select ref="select" v-model="period" :class="overlay" :aria-label="t('dashboard.filterMonth')">
        <optgroup v-for="g in groups" :key="g.year" :label="String(g.year)">
          <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </optgroup>
      </select>
    </div>
    <button v-if="!onCurrentMonth" type="button" class="h-9 shrink-0 px-1.5 text-[17px] text-accent" :aria-label="t('dashboard.currentMonth')" @click="goToCurrentMonth">
      {{ t('dashboard.currentMonthShort') }}
    </button>
    <button type="button" :class="roundArrow" :disabled="!previous" :aria-label="previousLabel" @click="step(previous, $event)">
      <i class="fa-solid fa-chevron-left text-sm" aria-hidden="true"></i>
    </button>
    <button type="button" :class="roundArrow" :disabled="!next" :aria-label="nextLabel" @click="step(next, $event)">
      <i class="fa-solid fa-chevron-right text-sm" aria-hidden="true"></i>
    </button>
  </div>

  <div v-else-if="appearance.platform === 'android'" class="flex min-w-0 items-center gap-1">
    <button type="button" :class="iconArrow" :disabled="!previous" :aria-label="previousLabel" @click="step(previous, $event)">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
    </button>
    <label class="relative flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg border border-line-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2">
      <span class="truncate" aria-hidden="true">{{ periodLabel }}</span>
      <i class="fa-solid fa-caret-down ml-1.5 text-xs text-ink-3" aria-hidden="true"></i>
      <select ref="select" v-model="period" :class="overlay" :aria-label="t('dashboard.filterMonth')">
        <optgroup v-for="g in groups" :key="g.year" :label="String(g.year)">
          <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </optgroup>
      </select>
    </label>
    <button type="button" :class="iconArrow" :disabled="!next" :aria-label="nextLabel" @click="step(next, $event)">
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </button>
    <button
      v-if="!onCurrentMonth"
      type="button"
      class="ml-1 inline-flex h-8 shrink-0 items-center rounded-lg border border-line-strong px-3 text-sm font-medium text-ink-3 hover:bg-surface-2"
      :aria-label="t('dashboard.currentMonth')"
      @click="goToCurrentMonth"
    >
      {{ t('dashboard.currentMonthShort') }}
    </button>
  </div>

  <div v-else class="flex min-w-0 items-center justify-end gap-1.5">
    <!--
      Su schermi larghi il pulsante tiene sempre il suo posto, così il menu non si sposta quando compare o sparisce.
      Sul telefono lo spazio è poco: il pulsante mostra solo l'icona e, quando non serve, sparisce del tutto.
    -->
    <button
      type="button"
      class="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs md:px-3 font-semibold text-accent transition-colors hover:bg-accent-soft-2"
      :class="{ 'invisible max-md:hidden': onCurrentMonth }"
      :aria-hidden="onCurrentMonth || undefined"
      :tabindex="onCurrentMonth ? -1 : undefined"
      :title="t('dashboard.currentMonth')"
      @click="goToCurrentMonth"
    >
      <!-- md:hidden su un contenitore: sull'icona perderebbe contro il display di Font Awesome. -->
      <span class="md:hidden" aria-hidden="true"><i class="fa-solid fa-calendar-day text-sm"></i></span>
      <span class="max-md:sr-only">{{ t('dashboard.currentMonthShort') }}</span>
    </button>

    <!-- Frecce e menu formano un solo controllo: ‹ periodo › -->
    <!-- Niente overflow-hidden: taglierebbe il contorno del focus. Gli angoli li arrotondano le frecce. -->
    <div class="flex min-w-0 items-center rounded-lg border border-line bg-surface shadow-sm">
      <button
        type="button"
        :class="[arrow, 'rounded-l-lg border-r border-line']"
        :disabled="!previous"
        :aria-label="previousLabel"
        :title="previousLabel"
        @click="step(previous, $event)"
      >
        <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
      </button>
      <!-- Il menu chiuso mostra il periodo per esteso ("Novembre 2026"): il testo è disegnato, il menu vero sta sopra. -->
      <label
        class="relative flex h-10 min-w-0 cursor-pointer items-center gap-1.5 bg-surface px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:-outline-offset-2 has-[select:focus-visible]:outline-accent"
      >
        <span class="truncate" aria-hidden="true">{{ periodLabel }}</span>
        <i class="fa-solid fa-caret-down text-xs text-ink-4" aria-hidden="true"></i>
        <select ref="select" v-model="period" :class="overlay" :aria-label="t('dashboard.filterMonth')">
          <optgroup v-for="g in groups" :key="g.year" :label="String(g.year)">
            <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </optgroup>
        </select>
      </label>
      <button
        type="button"
        :class="[arrow, 'rounded-r-lg border-l border-line']"
        :disabled="!next"
        :aria-label="nextLabel"
        :title="nextLabel"
        @click="step(next, $event)"
      >
        <i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>
