<script setup lang="ts">
/** Modulo per spese una tantum (`kind="expense"`) ed entrate (`kind="income"`). */
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Income, OneTimeExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import TagSelect from './TagSelect.vue'
import TagInput from './TagInput.vue'
import SubmitButton from './SubmitButton.vue'
import FieldError from './FieldError.vue'
import { useFormErrors } from '@/composables/useFormErrors'

/** `deletable`: modifica di una voce esistente da una pagina che sa eliminarla; mostra "Elimina" ed emette `delete`. */
const props = defineProps<{ open: boolean; kind: 'expense' | 'income'; item?: OneTimeExpense | Income | null; deletable?: boolean }>()
const emit = defineEmits<{ close: []; delete: [] }>()
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
/** Gli errori stanno sotto i campi; alla conferma il cursore torna sul primo da sistemare. */
const fe = useFormErrors(form)
const formEl = ref<HTMLFormElement | null>(null)

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
    fe.clear()
    const last = finance.lastUsedTags(props.kind === 'expense' ? 'oneTime' : 'income')
    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? amountInput(i.amount) : '',
      date: i?.date ?? todayIso(),
      categoryId: i?.categoryId ?? last.categoryId,
      paymentMethodId: i?.paymentMethodId ?? last.paymentMethodId,
      notes: i && 'notes' in i ? i.notes : '',
      tagIds: i && 'tagIds' in i && Array.isArray(i.tagIds) ? [...i.tagIds] : [],
    })
    resetDirty()
  },
  { immediate: true },
)

function submit() {
  fe.clear()
  const amount = fe.amount('amount', form.amount)
  fe.required('name', form.name, t('form.nameEmpty'))
  fe.required('date', form.date, t('form.dateEmpty'))
  if (amount === null || fe.hasErrors()) {
    fe.focusFirst(formEl.value)
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
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="title" :initial-focus="item ? undefined : '[data-field=amount]'" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <!--
      L'importo per primo, grande: è ciò che si scrive subito dopo aver speso. Su una voce nuova il cursore parte da lì
      (con la tastiera numerica); su una da modificare parte dal titolo, perché non si sa quale campo serve.
    -->
    <form v-else :id="formId" ref="formEl" novalidate class="space-y-3" @submit.prevent="submit">
      <label class="block">
        <span class="field-label">{{ t('common.amount') }}</span>
        <input v-model="form.amount" v-bind="fe.attrs('amount')" inputmode="decimal" autocomplete="off" class="field field-amount" placeholder="0,00" />
        <FieldError :id="fe.errorId('amount')" :message="fe.errors.amount" />
      </label>
      <label class="block">
        <span class="field-label">{{ t('common.name') }}</span>
        <input v-model="form.name" v-bind="fe.attrs('name')" maxlength="80" class="field" />
        <FieldError :id="fe.errorId('name')" :message="fe.errors.name" />
      </label>
      <label class="block">
        <span class="field-label">{{ t('common.date') }}</span>
        <input v-model="form.date" v-bind="fe.attrs('date')" type="date" class="field" />
        <FieldError :id="fe.errorId('date')" :message="fe.errors.date" />
      </label>
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
      <div class="pt-2"><SubmitButton
          :label="t('common.save')"
          :cancel-label="t('common.cancel')"
          :delete-label="deletable ? t('common.delete') : undefined"
          @cancel="emit('close')"
          @delete="emit('delete')"
        /></div>
    </form>
  </BaseModal>
</template>
