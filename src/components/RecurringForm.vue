<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Frequency, NotificationRule, RecurringExpense } from '@/types/models'
import { FREQUENCIES, exceptionOn, moveWindow, nextDueDate, seriesKey, splitRecurring } from '@/domain/recurrence'
import { useFinanceStore } from '@/stores/finance'
import { useNotificationsStore } from '@/stores/notifications'
import { useUiStore } from '@/stores/ui'
import { toCents } from '@/utils/money'
import { lastDayOfMonth, parseIsoDate, toIsoDate } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import TagSelect from './TagSelect.vue'
import NotificationRulesEditor from './NotificationRulesEditor.vue'
import SubmitButton from './SubmitButton.vue'

/**
 * `occurrence` è l'addebito da cui si è aperta la modifica (una riga di "Prossimi addebiti" o del dettaglio), con la
 * sua data secondo la serie: allora si sceglie, come nei calendari, se la modifica vale per «Solo questo addebito»,
 * «Da questo addebito in poi» o «Tutta la spesa», ed «Elimina» offre le stesse tre scelte. Senza (dalla pagina
 * Ricorrenti) la modifica riguarda la spesa: da qui in poi (dal prossimo addebito da oggi) o tutta.
 */
/** `deletable`: modifica di una voce esistente da una pagina che sa eliminarla; mostra "Elimina" ed emette `delete`. */
const props = defineProps<{ open: boolean; item?: RecurringExpense | null; occurrence?: string | null; deletable?: boolean }>()
const emit = defineEmits<{ close: []; delete: [] }>()
/** L'id del modulo: su iPhone "Fine" nella barra del foglio lo invia. */
const formId = useId()
const { t, amountInput, date, month, money } = useFormat()
const finance = useFinanceStore()
const notificationsStore = useNotificationsStore()
const ui = useUiStore()

const form = reactive({
  name: '',
  amount: '',
  frequency: 'monthly' as Frequency,
  startDate: '',
  endDate: '',
  categoryId: '',
  paymentMethodId: '',
  notifications: [] as NotificationRule[],
  /** «Solo questo addebito»: importo e giorno di quell'addebito. */
  chargeAmount: '',
  chargeDate: '',
})
/** Modifiche non salvate: la finestra le protegge da una chiusura per sbaglio. */
const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const error = ref('')

/** Aperto da un addebito preciso: si può cambiare anche solo quello. */
const fromCharge = computed(() => !!props.item && !!props.occurrence)

/**
 * Da quale addebito può partire una modifica "da qui in poi": quello da cui si è aperto il modulo, o il prossimo da oggi.
 * Se coincide con il primo addebito non c'è niente prima da tenere com'era: la modifica vale per tutta questa parte.
 */
const splitDate = computed(() => {
  const i = props.item
  if (!i) return null
  const d = props.occurrence ?? nextDueDate(i, finance.today)
  return d && d > i.startDate ? d : null
})
/**
 * Tutte le parti della stessa spesa (cambi «da questo addebito in poi» già fatti), in ordine: la voce aperta è una
 * di queste. Una spesa mai divisa ha una parte sola.
 */
const seriesParts = computed(() => {
  const i = props.item
  if (!i) return []
  const key = seriesKey(i)
  return finance.data.recurringExpenses.filter((r) => seriesKey(r) === key).sort((a, b) => a.startDate.localeCompare(b.startDate))
})
/** Primo addebito della spesa intera: da lì parte "Tutta la spesa". */
const seriesStart = computed(() => seriesParts.value[0]?.startDate ?? props.item?.startDate ?? '')
/** "Tutta la spesa" ha senso solo se prima di questo addebito ce ne sono altri. */
const canAll = computed(() => !!props.occurrence && seriesStart.value < props.occurrence)

/**
 * "one": solo questo addebito (aperto da un addebito); "from": da questo addebito in poi (i mesi passati restano
 * com'erano); "all": tutta la spesa.
 */
type Scope = 'one' | 'from' | 'all'
const scope = ref<Scope>('from')
const splitting = computed(() => !!splitDate.value && scope.value === 'from')
/** Il modulo per la scelta: con "one" solo importo e giorno, con le altre tutta la spesa. */
const onlyCharge = computed(() => fromCharge.value && scope.value === 'one')
/** Le scelte mostrate: con un addebito preciso le tre dei calendari, altrimenti "da qui in poi" e "tutta la serie". */
const showScope = computed(() => !!props.item && (fromCharge.value || !!splitDate.value))
/**
 * Con "da questo addebito in poi" la nuova serie parte da quell'addebito, ma il giorno si può spostare (es. dal 14 al
 * 15) entro questi limiti: tra l'addebito prima e quello dopo, così non se ne salta né se ne raddoppia uno.
 */
const moveRange = computed(() => (props.item && splitting.value && splitDate.value ? moveWindow(props.item, splitDate.value) : null))
watch(scope, (s) => {
  if (!props.item) return
  form.startDate = s === 'all' ? seriesStart.value : (splitDate.value ?? props.item.startDate)
})

/** «Solo questo addebito»: il giorno si sposta solo dentro il suo mese, così l'addebito resta nel suo mese. */
const chargeRange = computed(() => {
  const o = props.occurrence
  if (!o) return null
  const p = parseIsoDate(o)
  return { min: toIsoDate(p.year, p.month, 1), max: lastDayOfMonth(p.year, p.month), month: month(p.month) }
})

const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    error.value = ''
    scope.value = fromCharge.value ? 'one' : 'from'
    const initialNotifications = i
      ? (i.notifications ? [...i.notifications] : [])
      : notificationsStore.defaultRules.map((r) => ({ ...r }))
    const exception = i && props.occurrence ? exceptionOn(i, props.occurrence) : undefined

    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? amountInput(i.amount) : '',
      frequency: i?.frequency ?? 'monthly',
      // Di default la ricorrenza parte da gennaio dell'anno selezionato.
      startDate: (i && splitDate.value) || i?.startDate || toIsoDate(finance.selectedYear, 0, 1),
      endDate: i?.endDate ?? '',
      categoryId: i?.categoryId ?? finance.data.categories[0]?.id ?? '',
      paymentMethodId: i?.paymentMethodId ?? finance.data.paymentMethods[0]?.id ?? '',
      notifications: initialNotifications,
      chargeAmount: i ? amountInput(exception?.amount ?? i.amount) : '',
      chargeDate: exception?.movedTo ?? props.occurrence ?? '',
    })
    resetDirty()
  },
  { immediate: true },
)

/** «Solo questo addebito»: salva importo e giorno di quell'addebito come eccezione; gli altri restano com'erano. */
function submitCharge(item: RecurringExpense, original: string) {
  const amount = toCents(form.chargeAmount)
  if (amount === null || amount <= 0) {
    error.value = t('common.invalidAmount')
    return
  }
  const range = chargeRange.value
  if (range && (form.chargeDate < range.min || form.chargeDate > range.max)) {
    error.value = t('recurring.chargeDayOutOfRange', { month: range.month })
    return
  }
  finance.saveRecurringException(item, { date: original, amount, movedTo: form.chargeDate })
  emit('close')
}

function submit() {
  const item = props.item
  if (item && props.occurrence && onlyCharge.value) {
    submitCharge(item, props.occurrence)
    return
  }
  const amount = toCents(form.amount)
  if (amount === null || amount <= 0) {
    error.value = t('common.invalidAmount')
    return
  }
  if (moveRange.value && (form.startDate < moveRange.value.min || form.startDate > moveRange.value.max)) {
    error.value = t('recurring.moveOutOfRange', { min: date(moveRange.value.min), max: date(moveRange.value.max) })
    return
  }
  if (form.endDate && form.endDate < form.startDate) {
    error.value = t('recurring.endBeforeStart')
    return
  }
  const values = {
    name: form.name.trim(),
    amount,
    frequency: form.frequency,
    endDate: form.endDate || null,
    categoryId: form.categoryId,
    paymentMethodId: form.paymentMethodId,
    notifications: form.notifications,
  }
  if (item && splitting.value && splitDate.value) {
    // Se non è cambiato niente, dividere la serie creerebbe solo un doppione.
    const unchanged =
      form.startDate === splitDate.value &&
      values.name === item.name &&
      values.amount === item.amount &&
      values.frequency === item.frequency &&
      values.endDate === item.endDate &&
      values.categoryId === item.categoryId &&
      values.paymentMethodId === item.paymentMethodId &&
      JSON.stringify(values.notifications) === JSON.stringify(item.notifications ?? [])
    if (!unchanged) {
      const { before, after } = splitRecurring(item, splitDate.value, values, form.startDate)
      finance.saveRecurring(before)
      finance.saveRecurring(after)
    }
  } else if (item && scope.value === 'all' && seriesParts.value.length > 1) {
    // "Tutta la spesa" su una spesa già divisa: torna una serie sola, con i valori nuovi dal primo addebito.
    // Gli addebiti cambiati da soli di tutte le parti restano (valgono solo se la serie ha ancora quegli addebiti).
    const exceptions = seriesParts.value.flatMap((p) => p.exceptions ?? [])
    for (const p of seriesParts.value) if (p.id !== item.id) finance.deleteRecurring(p.id)
    finance.saveRecurring({ id: item.id, startDate: form.startDate, ...values, ...(exceptions.length ? { exceptions } : {}) })
  } else {
    // Il collegamento con le altre parti della spesa e gli addebiti cambiati da soli restano.
    finance.saveRecurring({
      id: item?.id,
      startDate: form.startDate,
      ...values,
      ...(item?.seriesId ? { seriesId: item.seriesId } : {}),
      ...(item?.exceptions?.length ? { exceptions: item.exceptions } : {}),
    })
  }
  emit('close')
}

/**
 * L'azione rossa in basso. Aperto da un addebito: con «Solo questo addebito» lo salta (si ripristina dallo Storico),
 * altrimenti chiede quali addebiti togliere. Dalla pagina Ricorrenti decide la pagina (`deletable`, evento `delete`).
 */
const deleteLabel = computed(() => {
  if (fromCharge.value) return onlyCharge.value ? t('recurring.skipCharge') : t('recurring.deleteMenu')
  return props.deletable ? t('common.delete') : undefined
})
const deleteChoiceOpen = ref(false)

function skipCharge() {
  const item = props.item
  const original = props.occurrence
  if (!item || !original) return
  finance.saveRecurringException(item, { date: original, skipped: true })
  ui.toast(t('recurring.chargeSkipped', { date: date(original) }))
  deleteChoiceOpen.value = false
  emit('close')
}

function onDelete() {
  if (!fromCharge.value) emit('delete')
  else if (onlyCharge.value) skipCharge()
  else deleteChoiceOpen.value = true
}

/** «Da questo addebito in poi»: la spesa finisce il giorno prima; le parti che partono da lì in poi spariscono. */
function deleteFrom() {
  if (props.item && props.occurrence) finance.endRecurringSeriesFrom(props.item, props.occurrence)
  deleteChoiceOpen.value = false
  emit('close')
}

function deleteAll() {
  if (props.item) finance.deleteRecurringSeries(props.item)
  deleteChoiceOpen.value = false
  emit('close')
}

/** Il nome dell'addebito nelle scelte, con il suo importo vero (quello dell'eccezione, se c'è). */
const chargeAmountLabel = computed(() => {
  const i = props.item
  if (!i || !props.occurrence) return ''
  return money(exceptionOn(i, props.occurrence)?.amount ?? i.amount)
})
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="t(item ? 'recurring.edit' : 'recurring.new')" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <form v-else :id="formId" class="space-y-3" @submit.prevent="submit">
      <!--
        Modificare una spesa ricorrente non deve riscrivere i mesi già passati senza volerlo. Aperto da un addebito, si
        sceglie come nei calendari: solo quello, da lì in poi, o tutta la spesa. Dalla pagina Ricorrenti: da qui in poi
        (di serie) o tutta la serie. I casi più comuni: "la bolletta di questo mese è più alta", "Netflix costa di più da
        questo mese".
      -->
      <fieldset v-if="item && showScope" class="space-y-1 rounded-lg bg-surface-2 p-3">
        <legend class="sr-only">{{ t('recurring.scopeLegend') }}</legend>
        <p class="text-xs font-medium text-ink-2" aria-hidden="true">{{ t('recurring.scopeLegend') }}</p>
        <label v-if="fromCharge && occurrence" class="flex min-h-10 cursor-pointer items-start gap-2 py-1">
          <input v-model="scope" type="radio" value="one" class="mt-0.5 accent-accent" />
          <span class="text-sm text-ink">
            {{ t('recurring.scopeOne', { date: date(occurrence) }) }}
            <span class="block text-xs text-ink-3">{{ t('recurring.scopeOneHint') }}</span>
          </span>
        </label>
        <label class="flex min-h-10 cursor-pointer items-start gap-2 py-1">
          <input v-model="scope" type="radio" value="from" class="mt-0.5 accent-accent" />
          <span class="text-sm text-ink">
            {{ t('recurring.scopeFrom', { date: date(splitDate ?? occurrence ?? item.startDate) }) }}
            <span class="block text-xs text-ink-3">{{ t('recurring.scopeFromHint') }}</span>
          </span>
        </label>
        <label v-if="fromCharge ? canAll : true" class="flex min-h-10 cursor-pointer items-start gap-2 py-1">
          <input v-model="scope" type="radio" value="all" class="mt-0.5 accent-accent" />
          <span class="text-sm text-ink">
            {{ t('recurring.scopeAll', { date: date(seriesStart) }) }}
            <span class="block text-xs text-ink-3">{{ t('recurring.scopeAllHint') }}</span>
          </span>
        </label>
      </fieldset>
      <!-- Dal primo addebito (o a serie finita) non c'è niente da tenere: la modifica vale per tutta la serie, e lo si dice. -->
      <p v-else-if="item" class="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs leading-snug text-ink-2">
        <i class="fa-solid fa-circle-info mt-0.5 text-ink-4" aria-hidden="true"></i>
        <template v-if="seriesParts.length > 1 && item.endDate">{{ t('recurring.editPeriod', { name: item.name, from: date(item.startDate), to: date(item.endDate) }) }}</template>
        <template v-else-if="seriesParts.length > 1">{{ t('recurring.editPeriodOpen', { name: item.name, from: date(item.startDate) }) }}</template>
        <template v-else>{{ t('recurring.editSeries', { name: item.name, date: date(item.startDate) }) }}</template>
      </p>

      <!-- «Solo questo addebito»: importo e giorno di quell'addebito; il resto vale per tutta la spesa. -->
      <template v-if="onlyCharge && chargeRange">
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="field-label">{{ t('recurring.chargeAmount') }}</span>
            <input v-model="form.chargeAmount" required inputmode="decimal" class="field" placeholder="0,00" />
          </label>
          <label class="block">
            <span class="field-label">{{ t('recurring.chargeDay') }}</span>
            <input v-model="form.chargeDate" type="date" required class="field" :min="chargeRange.min" :max="chargeRange.max" />
          </label>
        </div>
        <p class="text-xs text-ink-3">{{ t('recurring.chargeOnlyNote', { name: item?.name ?? '', month: chargeRange.month.toLocaleLowerCase() }) }}</p>
      </template>

      <template v-else>
        <label class="block">
          <span class="field-label">{{ t('common.name') }}</span>
          <input v-model="form.name" required maxlength="80" class="field" />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="field-label">{{ t('common.amount') }}</span>
            <input v-model="form.amount" required inputmode="decimal" class="field" placeholder="0,00" />
          </label>
          <label class="block">
            <span class="field-label">{{ t('recurring.frequency') }}</span>
            <select v-model="form.frequency" class="field">
              <option v-for="f in FREQUENCIES" :key="f" :value="f">{{ t(`recurring.frequencies.${f}`) }}</option>
            </select>
          </label>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="field-label">{{ t('recurring.startDate') }}</span>
            <input v-model="form.startDate" type="date" required class="field" :min="moveRange?.min" :max="moveRange?.max" :aria-describedby="moveRange ? `${formId}-move` : undefined" />
          </label>
          <label class="block">
            <span class="field-label">{{ t('recurring.endDate') }}</span>
            <input v-model="form.endDate" type="date" :min="form.startDate" class="field" />
          </label>
        </div>
        <p v-if="moveRange" :id="`${formId}-move`" class="-mt-1 text-xs text-ink-3">
          {{ t('recurring.moveHint', { min: date(moveRange.min), max: date(moveRange.max) }) }}
        </p>
        <div class="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <TagSelect v-model="form.categoryId" kind="categories" :label="t('common.category')" />
          <TagSelect v-model="form.paymentMethodId" kind="paymentMethods" :label="t('common.paymentMethod')" />
        </div>
        <div class="space-y-1 border-t border-line-soft pt-3">
          <NotificationRulesEditor
            v-model="form.notifications"
            :show-toggle="true"
            :toggle-label="t('notifications.settingsTitle')"
            :default-fallback-rules="notificationsStore.defaultRules"
          />
        </div>
      </template>
      <p v-if="error" class="text-xs text-negative" role="alert">{{ error }}</p>
      <div class="pt-2"><SubmitButton
          :label="t('common.save')"
          :cancel-label="t('common.cancel')"
          :delete-label="deleteLabel"
          @cancel="emit('close')"
          @delete="onDelete"
        /></div>
    </form>
  </BaseModal>

  <!-- «Elimina…» da un addebito: come nei calendari si sceglie quali addebiti togliere. -->
  <BaseModal :open="deleteChoiceOpen" :title="t('recurring.deleteTitle', { name: item?.name ?? '' })" @close="deleteChoiceOpen = false">
    <div v-if="item && occurrence" class="space-y-3">
      <p class="text-sm text-ink-3">{{ t('recurring.deleteHint') }}</p>
      <div class="divide-y divide-line-soft overflow-hidden rounded-lg bg-surface-2">
        <button type="button" class="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-surface-3" @click="skipCharge">
          <span>{{ t('recurring.deleteOne', { date: date(occurrence) }) }}</span>
          <span class="text-xs text-ink-3">{{ chargeAmountLabel }}</span>
        </button>
        <button type="button" class="flex min-h-12 w-full items-center px-3 py-2 text-left text-sm text-ink hover:bg-surface-3" @click="deleteFrom">
          {{ t('recurring.deleteFrom', { date: date(occurrence) }) }}
        </button>
        <button type="button" class="flex min-h-12 w-full items-center px-3 py-2 text-left text-sm font-medium text-negative hover:bg-surface-3" @click="deleteAll">
          {{ t('recurring.deleteAll') }}
        </button>
      </div>
      <button type="button" class="w-full py-2 text-sm font-medium text-ink-2" @click="deleteChoiceOpen = false">{{ t('common.cancel') }}</button>
    </div>
  </BaseModal>
</template>
