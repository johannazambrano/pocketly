<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { parseIsoDate } from '@/utils/dates'
import { useMonthStep, type MonthTarget } from '@/composables/useMonthStep'
import { useAppearanceStore } from '@/stores/appearance'

/**
 * `heading`: su iPhone il titolo grande della pagina è il periodo stesso (la dashboard): il selettore lo disegna e lo
 * rende il menu dei mesi, come il titolo di Calendario. Senza, su iPhone il menu è un testo nella tinta.
 */
const props = defineProps<{ heading?: string }>()

const finance = useFinanceStore()
const appearance = useAppearanceStore()
const { t, month, locale } = useFormat()

const todayParts = computed(() => parseIsoDate(finance.today))
const currentMonth = computed(() => todayParts.value.month)
const isCurrentYear = computed(() => finance.selectedYear === todayParts.value.year)
const onCurrentMonth = computed(() => isCurrentYear.value && finance.selectedMonth === currentMonth.value)

/** Dopo "Questo mese" il pulsante si nasconde: il focus passa al menu, che resta dov'era, invece di perdersi. */
const select = ref<HTMLSelectElement | null>(null)
function goToCurrentMonth() {
  finance.selectedYear = todayParts.value.year
  finance.selectedMonth = currentMonth.value
  select.value?.focus()
}

const { previous, next, go } = useMonthStep()

/**
 * Tasti ← → per il mese prima e dopo, su qualunque pagina mostri questo filtro (dashboard, dettaglio, spese variabili).
 * Non agiscono mentre si scrive, quando il focus è su un menu (lì le frecce cambiano già la scelta) o con una finestra
 * aperta.
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
 * Nel nome sulla freccia l'anno compare solo quando cambia: "dicembre 2025", ma "ottobre". In una frase italiana il mese
 * va in minuscolo ("Vai a ottobre"); in inglese resta maiuscolo.
 */
function targetName(target: MonthTarget | null): string {
  if (!target) return ''
  const name = locale.value === 'it' ? month(target.month).toLocaleLowerCase('it') : month(target.month)
  return target.year === finance.selectedYear ? name : `${name} ${target.year}`
}
/** Da "Tutti i mesi" la freccia non va a un mese "precedente" ma entra in un mese: l'etichetta dice dove. */
const fromAll = computed(() => finance.selectedMonth === 'all')
const previousLabel = computed(() => {
  if (!previous.value) return t('dashboard.previousMonthNone')
  const args = { month: targetName(previous.value) }
  return fromAll.value ? t('dashboard.goToMonth', args) : t('dashboard.previousMonth', args)
})
const nextLabel = computed(() => {
  if (!next.value) return t('dashboard.nextMonthNone')
  const args = { month: targetName(next.value) }
  return fromAll.value ? t('dashboard.goToMonth', args) : t('dashboard.nextMonth', args)
})

function showYear() {
  finance.selectedMonth = 'all'
}

/** L'ultimo mese guardato: "Mese" (iPhone) dopo "Tutto l'anno" torna lì, o al mese di oggi. */
const lastMonth = ref(typeof finance.selectedMonth === 'number' ? finance.selectedMonth : isCurrentYear.value ? currentMonth.value : 0)
watch(
  () => finance.selectedMonth,
  (m) => {
    if (typeof m === 'number') lastMonth.value = m
  },
)
function showMonth() {
  finance.selectedMonth = lastMonth.value
}

/** Le voci del menu, uguali su ogni piattaforma: "Tutto l'anno" per primo, poi i mesi, quello di oggi segnato. */
const options = computed(() => [
  { value: 'all' as const, label: t('dashboard.wholeYear') },
  ...Array.from({ length: 12 }, (_, m) => ({
    value: m,
    label: isCurrentYear.value && m === currentMonth.value ? `${month(m)} · ${t('dashboard.todayMark')}` : month(m),
  })),
])
const selectedLabel = computed(() => options.value.find((o) => o.value === finance.selectedMonth)?.label ?? '')

/**
 * Il titolo grande di iPhone si stringe quando è lungo ("Settembre 2025") o lo schermo è stretto (iPhone SE, 320 px),
 * per lasciare posto a "Oggi" e alle frecce senza tagliare il nome del mese.
 */
const headingSize = computed(() =>
  (props.heading?.length ?? 0) > 10 ? 'text-[28px] max-[359px]:text-[18px]' : 'text-[34px] max-[359px]:text-[22px]',
)

/** iPhone: i segmenti scelgono solo il modo (Mese, Tutto l'anno), come in Calendario e Salute. */
const seg = 'inline-flex h-8 flex-1 items-center justify-center rounded-[7px] px-2.5 text-[13px] font-medium text-ink transition-colors'
const segOn = 'seg-on bg-surface font-semibold shadow-sm'
/** iPhone: frecce tonde nella tinta, sul fondo grigio della pagina. */
const roundArrow =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent transition-colors disabled:text-ink-6'
/** Android: frecce come icon button di Material e il periodo come chip con il menu. */
const iconArrow =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 disabled:text-ink-6 disabled:hover:bg-transparent'

const arrow =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-strong disabled:cursor-not-allowed disabled:text-ink-6 disabled:hover:bg-surface'
</script>

<template>
  <!--
    Il periodo si sceglie con il controllo della piattaforma, e la scelta dell'anno si chiama ovunque "Tutto l'anno".
    iPhone: il titolo (o un testo nella tinta) è il menu dei mesi, ‹ › accanto, "Oggi" come testo, e sotto i segmenti
    "Mese | Tutto l'anno" che scelgono solo il modo. Android: ‹ · chip con il menu · ›, più la chip "Oggi": pochi
    elementi, che stanno anche su uno schermo stretto. PC: frecce e menu. In tutti i casi restano i tasti ← →.
  -->
  <div v-if="appearance.platform === 'ios'" class="w-full min-w-0 space-y-2">
    <div class="flex min-w-0 items-center gap-1.5">
      <div class="relative flex min-w-0 flex-1 items-center">
        <h2 v-if="heading" class="flex min-w-0 items-center gap-2 leading-tight font-bold tracking-tight text-ink" :class="headingSize">
          <span class="truncate">{{ heading }}</span>
          <i class="fa-solid fa-chevron-down shrink-0 text-base text-accent" aria-hidden="true"></i>
        </h2>
        <span v-else class="flex min-w-0 items-center gap-1.5 text-[17px] font-semibold text-accent" aria-hidden="true">
          <span class="truncate">{{ selectedLabel }}</span>
          <i class="fa-solid fa-chevron-down shrink-0 text-xs"></i>
        </span>
        <!-- Il menu vero sta sopra il titolo, trasparente: il tocco e il lettore di schermo trovano un menu, l'occhio il titolo. -->
        <select
          ref="select"
          v-model="finance.selectedMonth"
          class="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          :aria-label="t('dashboard.filterMonth')"
        >
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
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
    <div class="flex gap-0.5 rounded-[9px] bg-surface-3 p-0.5" role="group" :aria-label="t('dashboard.filterMonth')">
      <button type="button" :class="[seg, !fromAll ? segOn : '']" :aria-pressed="!fromAll" @click="showMonth">{{ t('dashboard.monthMode') }}</button>
      <button type="button" :class="[seg, fromAll ? segOn : '']" :aria-pressed="fromAll" @click="showYear">{{ t('dashboard.wholeYear') }}</button>
    </div>
  </div>

  <div v-else-if="appearance.platform === 'android'" class="flex min-w-0 items-center gap-1">
    <button type="button" :class="iconArrow" :disabled="!previous" :aria-label="previousLabel" @click="step(previous, $event)">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
    </button>
    <label class="relative flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg border border-line-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2">
      <span class="truncate" aria-hidden="true">{{ selectedLabel }}</span>
      <i class="fa-solid fa-caret-down ml-1.5 text-xs text-ink-3" aria-hidden="true"></i>
      <select
        ref="select"
        v-model="finance.selectedMonth"
        class="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
        :aria-label="t('dashboard.filterMonth')"
      >
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
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

    <!-- Frecce e menu formano un solo controllo: ‹ mese › -->
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
      <select
        ref="select"
        v-model="finance.selectedMonth"
        class="h-10 min-w-0 bg-surface px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2"
        :aria-label="t('dashboard.filterMonth')"
      >
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
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
