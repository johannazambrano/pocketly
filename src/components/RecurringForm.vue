<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Frequency, NotificationRule, RecurringExpense } from '@/types/models'
import { FREQUENCIES, nextDueDate, splitRecurring } from '@/domain/recurrence'
import { useFinanceStore } from '@/stores/finance'
import { useNotificationsStore } from '@/stores/notifications'
import { toCents } from '@/utils/money'
import { toIsoDate } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import TagSelect from './TagSelect.vue'
import NotificationRulesEditor from './NotificationRulesEditor.vue'
import SubmitButton from './SubmitButton.vue'

/**
 * `occurrence` è l'addebito da cui si è aperta la modifica (una riga di "Prossimi addebiti" o del dettaglio): da lì in
 * poi si può cambiare la serie senza toccare gli addebiti prima. Senza, si usa il prossimo addebito da oggi.
 */
const props = defineProps<{ open: boolean; item?: RecurringExpense | null; occurrence?: string | null }>()
const emit = defineEmits<{ close: [] }>()
/** L'id del modulo: su iPhone "Fine" nella barra del foglio lo invia. */
const formId = useId()
const { t, amountInput, date } = useFormat()
const finance = useFinanceStore()
const notificationsStore = useNotificationsStore()

const form = reactive({
  name: '',
  amount: '',
  frequency: 'monthly' as Frequency,
  startDate: '',
  endDate: '',
  categoryId: '',
  paymentMethodId: '',
  notifications: [] as NotificationRule[],
})
/** Modifiche non salvate: la finestra le protegge da una chiusura per sbaglio. */
const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const error = ref('')

/**
 * Da quale addebito può partire una modifica "da qui in poi": quello da cui si è aperto il modulo, o il prossimo da oggi.
 * Se coincide con il primo addebito non c'è niente prima da tenere com'era, e la scelta non si mostra.
 */
const splitDate = computed(() => {
  const i = props.item
  if (!i) return null
  const d = props.occurrence ?? nextDueDate(i, finance.today)
  return d && d > i.startDate ? d : null
})
/** "from": da questo addebito in poi (di serie: i mesi passati restano com'erano); "all": tutta la serie. */
const scope = ref<'from' | 'all'>('from')
const splitting = computed(() => !!splitDate.value && scope.value === 'from')
/** Con "da questo addebito in poi" la nuova serie parte da lì: il campo lo mostra e non si cambia. */
watch(scope, (s) => {
  if (!props.item) return
  form.startDate = s === 'from' && splitDate.value ? splitDate.value : props.item.startDate
})

const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    error.value = ''
    scope.value = 'from'
    const initialNotifications = i
      ? (i.notifications ? [...i.notifications] : [])
      : notificationsStore.defaultRules.map((r) => ({ ...r }))

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
    })
    resetDirty()
  },
  { immediate: true },
)

function submit() {
  const amount = toCents(form.amount)
  if (amount === null || amount <= 0) {
    error.value = t('common.invalidAmount')
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
  const item = props.item
  if (item && splitting.value && splitDate.value) {
    // Se non è cambiato niente, dividere la serie creerebbe solo un doppione.
    const unchanged =
      values.name === item.name &&
      values.amount === item.amount &&
      values.frequency === item.frequency &&
      values.endDate === item.endDate &&
      values.categoryId === item.categoryId &&
      values.paymentMethodId === item.paymentMethodId &&
      JSON.stringify(values.notifications) === JSON.stringify(item.notifications ?? [])
    if (!unchanged) {
      const { before, after } = splitRecurring(item, splitDate.value, values)
      finance.saveRecurring(before)
      finance.saveRecurring(after)
    }
  } else {
    finance.saveRecurring({ id: item?.id, startDate: form.startDate, ...values })
  }
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="t(item ? 'recurring.edit' : 'recurring.new')" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <form v-else :id="formId" class="space-y-3" @submit.prevent="submit">
      <!--
        Modificare una spesa ricorrente non deve riscrivere i mesi già passati senza volerlo: se c'è un addebito da cui
        partire, si sceglie se la modifica vale da lì in poi (di serie) o per tutta la serie. Il caso più comune è
        "Netflix costa di più da questo mese".
      -->
      <fieldset v-if="item && splitDate" class="space-y-1 rounded-lg bg-surface-2 p-3">
        <legend class="sr-only">{{ t('recurring.scopeLegend') }}</legend>
        <p class="text-xs font-medium text-ink-2" aria-hidden="true">{{ t('recurring.scopeLegend') }}</p>
        <label class="flex min-h-10 cursor-pointer items-start gap-2 py-1">
          <input v-model="scope" type="radio" value="from" class="mt-0.5 accent-accent" />
          <span class="text-sm text-ink">
            {{ t('recurring.scopeFrom', { date: date(splitDate) }) }}
            <span class="block text-xs text-ink-3">{{ t('recurring.scopeFromHint') }}</span>
          </span>
        </label>
        <label class="flex min-h-10 cursor-pointer items-start gap-2 py-1">
          <input v-model="scope" type="radio" value="all" class="mt-0.5 accent-accent" />
          <span class="text-sm text-ink">
            {{ t('recurring.scopeAll', { date: date(item.startDate) }) }}
            <span class="block text-xs text-ink-3">{{ t('recurring.scopeAllHint') }}</span>
          </span>
        </label>
      </fieldset>
      <!-- Dal primo addebito (o a serie finita) non c'è niente da tenere: la modifica vale per tutta la serie, e lo si dice. -->
      <p v-else-if="item" class="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs leading-snug text-ink-2">
        <i class="fa-solid fa-circle-info mt-0.5 text-ink-4" aria-hidden="true"></i>
        {{ t('recurring.editSeries', { name: item.name, date: date(item.startDate) }) }}
      </p>
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
          <input v-model="form.startDate" type="date" required class="field" :readonly="splitting" :class="{ 'bg-surface-2 text-ink-3': splitting }" />
        </label>
        <label class="block">
          <span class="field-label">{{ t('recurring.endDate') }}</span>
          <input v-model="form.endDate" type="date" :min="form.startDate" class="field" />
        </label>
      </div>
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
      <p v-if="error" class="text-xs text-negative">{{ error }}</p>
      <div class="pt-2"><SubmitButton :label="t('common.save')" :cancel-label="t('common.cancel')" @cancel="emit('close')" /></div>
    </form>
  </BaseModal>
</template>
