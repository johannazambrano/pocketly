<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Frequency, RecurringExpense } from '@/types/models'
import { FREQUENCIES } from '@/domain/recurrence'
import { useFinanceStore } from '@/stores/finance'
import { centsToInput, toCents } from '@/utils/money'
import { toIsoDate } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import TagSelect from './TagSelect.vue'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; item?: RecurringExpense | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const finance = useFinanceStore()

const form = reactive({
  name: '',
  amount: '',
  frequency: 'monthly' as Frequency,
  startDate: '',
  endDate: '',
  categoryId: '',
  paymentMethodId: '',
})
const error = ref('')
const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    error.value = ''
    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? centsToInput(i.amount) : '',
      frequency: i?.frequency ?? 'monthly',
      // Di default la ricorrenza parte da gennaio dell'anno selezionato.
      startDate: i?.startDate ?? toIsoDate(finance.selectedYear, 0, 1),
      endDate: i?.endDate ?? '',
      categoryId: i?.categoryId ?? finance.data.categories[0]?.id ?? '',
      paymentMethodId: i?.paymentMethodId ?? finance.data.paymentMethods[0]?.id ?? '',
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
  })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :title="t(item ? 'recurring.edit' : 'recurring.new')" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{{ t('common.noTags') }}</p>
    <form v-else class="space-y-3" @submit.prevent="submit">
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
      <div class="grid grid-cols-2 gap-2">
        <TagSelect v-model="form.categoryId" kind="categories" :label="t('common.category')" />
        <TagSelect v-model="form.paymentMethodId" kind="paymentMethods" :label="t('common.paymentMethod')" />
      </div>
      <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>
      <div class="pt-2"><SubmitButton :label="t('common.save')" /></div>
    </form>
  </BaseModal>
</template>
