<script setup lang="ts">
/** Modulo per spese una tantum (`kind="expense"`) ed entrate (`kind="income"`). */
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Income, OneTimeExpense, QuickExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { toCents } from '@/utils/money'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import TagSelect from './TagSelect.vue'
import TagInput from './TagInput.vue'
import SubmitButton from './SubmitButton.vue'
import QuickExpenseBar from './QuickExpenseBar.vue'

/** `deletable`: modifica di una voce esistente da una pagina che sa eliminarla; mostra "Elimina" ed emette `delete`. */
const props = defineProps<{
  open: boolean
  kind: 'expense' | 'income'
  item?: OneTimeExpense | Income | null
  preset?: QuickExpense | null
  deletable?: boolean
}>()
const emit = defineEmits<{ close: []; delete: [] }>()
/** L'id del modulo: su iPhone "Fine" nella barra del foglio lo invia. */
const formId = useId()
const { t, amountInput } = useFormat()
const finance = useFinanceStore()
const ui = useUiStore()

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
const saveAsQuick = ref(false)
const quickKeepAmount = ref(true)
const appliedPreset = ref(false)
const amountEl = ref<HTMLInputElement | null>(null)

const title = computed(() => {
  const section = props.kind === 'expense' ? 'onetime' : 'income'
  return t(`${section}.${props.item ? 'edit' : 'new'}`)
})
const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)
const showQuickBar = computed(() => props.kind === 'expense' && !props.item && finance.quickExpenses.length > 0)
const showSaveAsQuick = computed(() => props.kind === 'expense' && !props.preset && !appliedPreset.value)

function resolveTag(kind: 'categories' | 'paymentMethods', id?: string): string {
  return (id && finance.tag(kind, id)?.id) ?? finance.data[kind][0]?.id ?? ''
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    const p = !i ? props.preset : null
    error.value = ''
    saveAsQuick.value = false
    quickKeepAmount.value = true
    appliedPreset.value = !!p
    Object.assign(form, {
      name: i?.name ?? p?.name ?? '',
      amount: i ? amountInput(i.amount) : p?.amount ? amountInput(p.amount) : '',
      date: i?.date ?? todayIso(),
      categoryId: resolveTag('categories', i?.categoryId ?? p?.categoryId),
      paymentMethodId: resolveTag('paymentMethods', i?.paymentMethodId ?? p?.paymentMethodId),
      notes: i && 'notes' in i ? i.notes : (p?.notes ?? ''),
      tagIds:
        i && 'tagIds' in i && Array.isArray(i.tagIds)
          ? [...i.tagIds]
          : p?.tagIds
            ? p.tagIds.filter((id) => !!finance.tag('tags', id))
            : [],
    })
    resetDirty()
  },
  { immediate: true },
)

function applyPreset(p: QuickExpense) {
  error.value = ''
  appliedPreset.value = true
  saveAsQuick.value = false
  Object.assign(form, {
    name: p.name,
    amount: p.amount ? amountInput(p.amount) : '',
    categoryId: resolveTag('categories', p.categoryId),
    paymentMethodId: resolveTag('paymentMethods', p.paymentMethodId),
    notes: p.notes,
    tagIds: (p.tagIds ?? []).filter((id) => !!finance.tag('tags', id)),
  })
  void nextTick(() => amountEl.value?.focus())
}

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
  if (props.kind === 'expense') {
    finance.saveOneTime({ ...base, notes: form.notes.trim(), tagIds: form.tagIds })
    if (showSaveAsQuick.value && saveAsQuick.value) {
      finance.saveQuickExpense({
        name: base.name,
        ...(quickKeepAmount.value ? { amount: base.amount } : {}),
        categoryId: base.categoryId,
        paymentMethodId: base.paymentMethodId,
        notes: form.notes.trim(),
        tagIds: form.tagIds,
      })
      ui.toast(t('quickExpenses.savedToast', { name: base.name }))
    }
  } else finance.saveIncome(base)
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="title" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <form v-else :id="formId" class="space-y-3" @submit.prevent="submit">
      <QuickExpenseBar v-if="showQuickBar" compact @prefill="applyPreset" @recorded="emit('close')" />
      <label class="block">
        <span class="field-label">{{ t('common.name') }}</span>
        <input v-model="form.name" required maxlength="80" class="field" />
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="field-label">{{ t('common.amount') }}</span>
          <input ref="amountEl" v-model="form.amount" required inputmode="decimal" class="field" placeholder="0,00" />
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
      <div v-if="showSaveAsQuick" class="space-y-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2">
        <label class="flex min-h-8 cursor-pointer items-center gap-2 text-xs font-medium text-ink-2">
          <input v-model="saveAsQuick" type="checkbox" class="h-4 w-4 accent-accent-icon" />
          <span>{{ t('quickExpenses.saveAsQuick') }}</span>
        </label>
        <label v-if="saveAsQuick" class="flex min-h-7 cursor-pointer items-center gap-2 pl-6 text-xs text-ink-3">
          <input v-model="quickKeepAmount" type="checkbox" class="h-4 w-4 accent-accent-icon" />
          <span>{{ t('quickExpenses.keepAmount') }}</span>
        </label>
      </div>
      <p v-if="error" class="text-xs text-negative">{{ error }}</p>
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
