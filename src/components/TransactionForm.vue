<script setup lang="ts">
/** Modulo per spese una tantum (`kind="expense"`) ed entrate (`kind="income"`). */
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Income, OneTimeExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { toCents } from '@/utils/money'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import TagSelect from './TagSelect.vue'
import TagInput from './TagInput.vue'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; kind: 'expense' | 'income'; item?: OneTimeExpense | Income | null }>()
const emit = defineEmits<{ close: [] }>()
/** L'id del modulo: su iPhone "Fine" nella barra del foglio lo invia. */
const formId = useId()
const { t, amountInput } = useFormat()
const finance = useFinanceStore()

const form = reactive({
  name: '',
  amount: '',
  date: '',
  categoryId: '',
  paymentMethodId: '',
  notes: '',
  tagIds: [] as string[],
})
/** Modifiche non salvate: la finestra le protegge da una chiusura per sbaglio. */
const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const error = ref('')

const title = computed(() => {
  const section = props.kind === 'expense' ? 'onetime' : 'income'
  return t(`${section}.${props.item ? 'edit' : 'new'}`)
})
const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    error.value = ''
    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? amountInput(i.amount) : '',
      date: i?.date ?? todayIso(),
      categoryId: i?.categoryId ?? finance.data.categories[0]?.id ?? '',
      paymentMethodId: i?.paymentMethodId ?? finance.data.paymentMethods[0]?.id ?? '',
      notes: i && 'notes' in i ? i.notes : '',
      tagIds: i && 'tagIds' in i && Array.isArray(i.tagIds) ? [...i.tagIds] : [],
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
  const base = {
    id: props.item?.id,
    name: form.name.trim(),
    amount,
    date: form.date,
    categoryId: form.categoryId,
    paymentMethodId: form.paymentMethodId,
  }
  if (props.kind === 'expense') finance.saveOneTime({ ...base, notes: form.notes.trim(), tagIds: form.tagIds })
  else finance.saveIncome(base)
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="title" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <form v-else :id="formId" class="space-y-3" @submit.prevent="submit">
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
          <span class="field-label">{{ t('common.date') }}</span>
          <input v-model="form.date" type="date" required class="field" />
        </label>
      </div>
      <div class="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <TagSelect v-model="form.categoryId" kind="categories" :label="t('common.category')" />
        <TagSelect
          v-model="form.paymentMethodId"
          kind="paymentMethods"
          :label="kind === 'income' ? t('income.creditedTo') : t('common.paymentMethod')"
        />
      </div>
      <label v-if="kind === 'expense'" class="block">
        <span class="field-label">{{ t('common.notes') }}</span>
        <input v-model="form.notes" maxlength="200" class="field" />
      </label>
      <TagInput v-if="kind === 'expense'" v-model="form.tagIds" />
      <p v-if="error" class="text-xs text-negative">{{ error }}</p>
      <div class="pt-2"><SubmitButton :label="t('common.save')" :cancel-label="t('common.cancel')" @cancel="emit('close')" /></div>
    </form>
  </BaseModal>
</template>
