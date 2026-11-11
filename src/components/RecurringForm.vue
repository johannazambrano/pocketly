<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Frequency, NotificationRule, RecurringExpense } from '@/types/models'
import { FREQUENCIES } from '@/domain/recurrence'
import { useFinanceStore } from '@/stores/finance'
import { useNotificationsStore } from '@/stores/notifications'
import { toCents } from '@/utils/money'
import { toIsoDate } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import TagSelect from './TagSelect.vue'
import NotificationRulesEditor from './NotificationRulesEditor.vue'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; item?: RecurringExpense | null }>()
const emit = defineEmits<{ close: [] }>()
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
const error = ref('')
const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    error.value = ''
    const initialNotifications = i
      ? (i.notifications ? [...i.notifications] : [])
      : notificationsStore.defaultRules.map((r) => ({ ...r }))

    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? amountInput(i.amount) : '',
      frequency: i?.frequency ?? 'monthly',
      // Di default la ricorrenza parte da gennaio dell'anno selezionato.
      startDate: i?.startDate ?? toIsoDate(finance.selectedYear, 0, 1),
      endDate: i?.endDate ?? '',
      categoryId: i?.categoryId ?? finance.data.categories[0]?.id ?? '',
      paymentMethodId: i?.paymentMethodId ?? finance.data.paymentMethods[0]?.id ?? '',
      notifications: initialNotifications,
    })
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
  finance.saveRecurring({
    id: props.item?.id,
    name: form.name.trim(),
    amount,
    frequency: form.frequency,
    startDate: form.startDate,
    endDate: form.endDate || null,
    categoryId: form.categoryId,
    paymentMethodId: form.paymentMethodId,
    notifications: form.notifications,
  })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :title="t(item ? 'recurring.edit' : 'recurring.new')" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{{ t('common.noTags') }}</p>
    <form v-else class="space-y-3" @submit.prevent="submit">
      <!--
        Modificando una spesa ricorrente si cambia tutta la serie, non solo l'addebito da cui si è arrivati (per esempio
        una riga di "Prossimi addebiti"): lo si dice prima dei campi.
      -->
      <p v-if="item" class="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-snug text-slate-700">
        <i class="fa-solid fa-circle-info mt-0.5 text-slate-500" aria-hidden="true"></i>
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
          <input v-model="form.startDate" type="date" required class="field" />
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
      <div class="space-y-1 border-t border-slate-100 pt-3">
        <NotificationRulesEditor
          v-model="form.notifications"
          :show-toggle="true"
          :toggle-label="t('notifications.settingsTitle')"
          :default-fallback-rules="notificationsStore.defaultRules"
        />
      </div>
      <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>
      <div class="pt-2"><SubmitButton :label="t('common.save')" :cancel-label="t('common.cancel')" @cancel="emit('close')" /></div>
    </form>
  </BaseModal>
</template>
