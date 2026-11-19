<script setup lang="ts">
/** Modulo per creare o modificare un inserimento rapido (`QuickExpense`). */
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { QuickExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useDirty } from '@/composables/useDirty'
import BaseModal from './BaseModal.vue'
import TagSelect from './TagSelect.vue'
import TagInput from './TagInput.vue'
import SubmitButton from './SubmitButton.vue'
import FieldError from './FieldError.vue'
import { useFormErrors } from '@/composables/useFormErrors'

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
/** Come negli altri moduli: errori sotto il campo, letti dal lettore di schermo, cursore sul primo da sistemare. */
const fe = useFormErrors(form)
const formEl = ref<HTMLFormElement | null>(null)
const amountHintId = useId()

const title = computed(() => t(props.item ? 'quickExpenses.edit' : 'quickExpenses.new'))
const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const q = props.item
    fe.clear()
    const last = finance.lastUsedTags('oneTime')
    Object.assign(form, {
      name: q?.name ?? '',
      amount: q?.amount ? amountInput(q.amount) : '',
      // Come nel modulo spesa: un rapido nuovo parte da categoria e metodo dell'ultima spesa variabile.
      categoryId: (q?.categoryId && finance.tag('categories', q.categoryId)?.id) || last.categoryId,
      paymentMethodId: (q?.paymentMethodId && finance.tag('paymentMethods', q.paymentMethodId)?.id) || last.paymentMethodId,
      notes: q?.notes ?? '',
      tagIds: q?.tagIds ? [...q.tagIds] : [],
    })
    resetDirty()
  },
  { immediate: true },
)

function submit() {
  fe.clear()
  fe.required('name', form.name, t('form.nameEmpty'))
  // L'importo è facoltativo (vuoto = si scrive ogni volta); se c'è, deve essere un importo valido.
  const amount = form.amount.trim() ? (fe.amount('amount', form.amount) ?? undefined) : undefined
  if (fe.hasErrors()) {
    fe.focusFirst(formEl.value)
    return
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
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="title" :initial-focus="item ? undefined : '[data-field=name]'" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <!-- Qui il nome viene per primo: è ciò che si vede sul pulsante del rapido, e l'importo è facoltativo. -->
    <form v-else :id="formId" ref="formEl" novalidate class="space-y-3" @submit.prevent="submit">
      <label class="block">
        <span class="field-label">{{ t('common.name') }}</span>
        <input v-model="form.name" v-bind="fe.attrs('name')" maxlength="80" :placeholder="t('quickExpenses.namePlaceholder')" class="field" />
        <FieldError :id="fe.errorId('name')" :message="fe.errors.name" />
      </label>
      <label class="block">
        <span class="field-label">{{ t('quickExpenses.amountOptional') }}</span>
        <input
          v-model="form.amount"
          v-bind="fe.attrs('amount')"
          :aria-describedby="fe.errors.amount ? `${fe.errorId('amount')} ${amountHintId}` : amountHintId"
          inputmode="decimal"
          autocomplete="off"
          :placeholder="t('quickExpenses.amountPlaceholder')"
          class="field"
        />
        <FieldError :id="fe.errorId('amount')" :message="fe.errors.amount" />
        <p :id="amountHintId" class="mt-1 text-xs text-ink-4">{{ t('quickExpenses.amountHint') }}</p>
      </label>
      <div class="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <TagSelect v-model="form.categoryId" kind="categories" :label="t('common.category')" />
        <TagSelect v-model="form.paymentMethodId" kind="paymentMethods" :label="t('common.paymentMethod')" />
      </div>
      <label class="block">
        <span class="field-label">{{ t('common.notes') }}</span>
        <input v-model="form.notes" maxlength="200" class="field" />
      </label>
      <TagInput v-model="form.tagIds" />
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
