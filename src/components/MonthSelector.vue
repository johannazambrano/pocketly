<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { parseIsoDate } from '@/utils/dates'
import { useMonthStep, type MonthTarget } from '@/composables/useMonthStep'
import { useAppearanceStore } from '@/stores/appearance'

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

/** Il nome breve del mese su un segmento o una chip: "Ott", "Dic" (con l'anno se cambia). */
function shortName(target: MonthTarget | null): string {
  if (!target) return ''
  const name = month(target.month, 'short').replace('.', '')
  const cap = name.charAt(0).toLocaleUpperCase(locale.value) + name.slice(1)
  return target.year === finance.selectedYear ? cap : `${cap} ${target.year}`
}
/** Il nome intero, per le chip di Android: "Ottobre". */
function longName(target: MonthTarget | null): string {
  if (!target) return ''
  return target.year === finance.selectedYear ? month(target.month) : `${month(target.month)} ${target.year}`
}
function showYear() {
  finance.selectedMonth = 'all'
}

/** Chip di Material: contorno sottile; quella scelta piena (secondary container) con il segno di spunta. */
const chip =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2'
const chipOn = 'border-transparent bg-accent-soft text-ink'
/** Segmenti di iOS: binario grigio, il segmento scelto è una pillola bianca con un'ombra leggera. */
const seg = 'inline-flex h-8 shrink-0 items-center justify-center rounded-[7px] px-2.5 text-[13px] font-medium text-ink transition-colors'
const segOn = 'seg-on bg-surface font-semibold shadow-sm'

const arrow =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-strong disabled:cursor-not-allowed disabled:text-ink-6 disabled:hover:bg-surface'
</script>

<template>
  <!--
    Il periodo si sceglie con il controllo della piattaforma. iPhone: segmenti (‹ mese · Anno · ›) con il mese scelto
    al centro come menu. Android: chip (mese prima · mese scelto · mese dopo · tutto l'anno). PC: frecce e menu. In
    tutti i casi restano i tasti ← → e il pulsante "Questo mese".
  -->
  <div v-if="appearance.platform === 'ios'" class="flex w-full min-w-0 items-center gap-1.5">
    <button
      v-if="!onCurrentMonth"
      type="button"
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
      :aria-label="t('dashboard.currentMonth')"
      :title="t('dashboard.currentMonth')"
      @click="goToCurrentMonth"
    >
      <i class="fa-solid fa-calendar-day text-sm" aria-hidden="true"></i>
    </button>
    <div class="flex min-w-0 flex-1 items-center gap-0.5 rounded-[9px] bg-surface-3 p-0.5" role="group" :aria-label="t('dashboard.filterMonth')">
      <button type="button" :class="seg" class="disabled:text-ink-6" :disabled="!previous" :aria-label="previousLabel" @click="step(previous, $event)">
        <span aria-hidden="true">‹ {{ shortName(previous) }}</span>
      </button>
      <select
        ref="select"
        v-model="finance.selectedMonth"
        class="h-8 min-w-0 flex-1 appearance-none rounded-[7px] bg-transparent px-2 text-center text-[13px] font-medium text-ink"
        :class="{ [segOn]: !fromAll }"
        :aria-label="t('dashboard.filterMonth')"
      >
        <option value="all">{{ t('dashboard.allMonths') }}</option>
        <option v-for="m in 12" :key="m - 1" :value="m - 1">
          {{ month(m - 1) }}{{ isCurrentYear && m - 1 === currentMonth ? ` (${t('common.current')})` : '' }}
        </option>
      </select>
      <button type="button" :class="[seg, fromAll ? segOn : '']" :aria-pressed="fromAll" @click="showYear">{{ t('dashboard.yearShort') }}</button>
      <button type="button" :class="seg" class="disabled:text-ink-6" :disabled="!next" :aria-label="nextLabel" @click="step(next, $event)">
        <span aria-hidden="true">{{ shortName(next) }} ›</span>
      </button>
    </div>
  </div>

  <div v-else-if="appearance.platform === 'android'" class="no-scrollbar -mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
    <button v-if="!onCurrentMonth" type="button" :class="chip" @click="goToCurrentMonth">
      <i class="fa-solid fa-calendar-day text-xs" aria-hidden="true"></i>{{ t('dashboard.currentMonthShort') }}
    </button>
    <button v-if="previous" type="button" :class="chip" :aria-label="previousLabel" @click="step(previous, $event)">
      <span aria-hidden="true">{{ longName(previous) }}</span>
    </button>
    <label :class="[chip, !fromAll ? chipOn : '']" class="relative cursor-pointer pr-2">
      <i v-if="!fromAll" class="fa-solid fa-check text-xs" aria-hidden="true"></i>
      <select
        ref="select"
        v-model="finance.selectedMonth"
        class="h-8 min-w-0 cursor-pointer appearance-none bg-transparent pr-4 text-sm font-medium"
        :aria-label="t('dashboard.filterMonth')"
      >
        <option value="all">{{ t('dashboard.allMonths') }}</option>
        <option v-for="m in 12" :key="m - 1" :value="m - 1">
          {{ month(m - 1) }}{{ isCurrentYear && m - 1 === currentMonth ? ` (${t('common.current')})` : '' }}
        </option>
      </select>
      <i class="fa-solid fa-caret-down pointer-events-none absolute right-2 text-xs" aria-hidden="true"></i>
    </label>
    <button v-if="next" type="button" :class="chip" :aria-label="nextLabel" @click="step(next, $event)">
      <span aria-hidden="true">{{ longName(next) }}</span>
    </button>
    <button type="button" :class="[chip, fromAll ? chipOn : '']" :aria-pressed="fromAll" @click="showYear">
      <i v-if="fromAll" class="fa-solid fa-check text-xs" aria-hidden="true"></i>{{ t('dashboard.wholeYear') }}
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
        <option value="all">{{ t('dashboard.allMonths') }}</option>
        <option v-for="m in 12" :key="m - 1" :value="m - 1">
          {{ month(m - 1) }}{{ isCurrentYear && m - 1 === currentMonth ? ` (${t('common.current')})` : '' }}
        </option>
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
