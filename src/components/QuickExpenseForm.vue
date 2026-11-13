<script setup lang="ts">
/** Modulo per creare o modificare un inserimento rapido (`QuickExpense`). */
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { QuickExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { toCents } from '@/utils/money'
import { useDirty } from '@/composables/useDirty'
import BaseModal from './BaseModal.vue'
import TagSelect from './TagSelect.vue'
import TagInput from './TagInput.vue'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; item?: QuickExpense | null; deletable?: boolean }>()
const emit = defineEmits<{ close: []; delete: [] }>()

const formId = useId()
const { t, amountInput } = useFormat()
const finance = useFinanceStore()

const form = reactive({
  name: '',
  amount: '',
  categoryId: '',
  paymentMethodId: '',
  notes: '',
  tagIds: [] as string[],
})

const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const error = ref('')

const title = computed(() => t(props.item ? 'quickExpenses.edit' : 'quickExpenses.new'))
const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const q = props.item
    error.value = ''
    Object.assign(form, {
      name: q?.name ?? '',
      amount: q?.amount ? amountInput(q.amount) : '',
      categoryId: (q?.categoryId && finance.tag('categories', q.categoryId)?.id) ?? finance.data.categories[0]?.id ?? '',
      paymentMethodId: (q?.paymentMethodId && finance.tag('paymentMethods', q.paymentMethodId)?.id) ?? finance.data.paymentMethods[0]?.id ?? '',
      notes: q?.notes ?? '',
      tagIds: q?.tagIds ? [...q.tagIds] : [],
    })
    resetDirty()
  },
  { immediate: true },
)

function submit() {
  const rawAmount = form.amount.trim()
  let amount: number | undefined
  if (rawAmount) {
    const parsed = toCents(rawAmount)
    if (parsed === null || parsed <= 0) {
      error.value = t('common.invalidAmount')
      return
    }
    amount = parsed
  }

  finance.saveQuickExpense({
    id: props.item?.id,
    name: form.name.trim(),
    ...(amount !== undefined ? { amount } : {}),
    categoryId: form.categoryId,
    paymentMethodId: form.paymentMethodId,
    notes: form.notes.trim(),
    tagIds: form.tagIds,
  })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="title" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <form v-else :id="formId" class="space-y-3" @submit.prevent="submit">
      <label class="block">
        <span class="field-label">{{ t('common.name') }}</span>
        <input v-model="form.name" required maxlength="80" :placeholder="t('quickExpenses.namePlaceholder')" class="field" />
      </label>
      <div class="space-y-1">
        <label class="block">
          <span class="field-label">{{ t('quickExpenses.amountOptional') }}</span>
          <input v-model="form.amount" inputmode="decimal" :placeholder="t('quickExpenses.amountPlaceholder')" class="field" />
        </label>
        <p class="text-xs text-ink-4">{{ t('quickExpenses.amountHint') }}</p>
      </div>
      <div class="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <TagSelect v-model="form.categoryId" kind="categories" :label="t('common.category')" />
        <TagSelect v-model="form.paymentMethodId" kind="paymentMethods" :label="t('common.paymentMethod')" />
      </div>
      <label class="block">
        <span class="field-label">{{ t('common.notes') }}</span>
        <input v-model="form.notes" maxlength="200" class="field" />
      </label>
      <TagInput v-model="form.tagIds" />
      <p v-if="error" class="text-xs text-negative">{{ error }}</p>
      <div class="pt-2">
        <SubmitButton
          :label="t('common.save')"
          :cancel-label="t('common.cancel')"
          :delete-label="deletable ? t('common.delete') : undefined"
          @cancel="emit('close')"
          @delete="emit('delete')"
        />
      </div>
    </form>
  </BaseModal>
</template>
