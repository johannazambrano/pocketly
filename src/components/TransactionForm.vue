<script setup lang="ts">
/** Modulo per spese una tantum (`kind="expense"`) ed entrate (`kind="income"`). */
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Income, OneTimeExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { frequentTemplates, type FrequentTemplate } from '@/domain/calculations'
import { toCents } from '@/utils/money'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import TagSelect from './TagSelect.vue'
import TagInput from './TagInput.vue'
import SubmitButton from './SubmitButton.vue'

/** `deletable`: modifica di una voce esistente da una pagina che sa eliminarla; mostra "Elimina" ed emette `delete`. */
const props = defineProps<{ open: boolean; kind: 'expense' | 'income'; item?: OneTimeExpense | Income | null; deletable?: boolean }>()
const emit = defineEmits<{ close: []; delete: [] }>()
/** L'id del modulo: su iPhone "Fine" nella barra del foglio lo invia. */
const formId = useId()
const { t, amountInput, money } = useFormat()
const finance = useFinanceStore()

const isDuplicating = ref(false)

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

const isEdit = computed(() => !!props.item && !!props.item.id && !isDuplicating.value)

const title = computed(() => {
  const section = props.kind === 'expense' ? 'onetime' : 'income'
  return t(`${section}.${isEdit.value ? 'edit' : 'new'}`)
})
const hasTags = computed(() => finance.data.categories.length > 0 && finance.data.paymentMethods.length > 0)

const frequentList = computed(() => {
  if (props.item || isDuplicating.value) return []
  const items = props.kind === 'expense' ? finance.data.oneTimeExpenses : finance.data.incomes
  return frequentTemplates(items, 5).filter(
    (tpl) =>
      finance.data.categories.some((c) => c.id === tpl.categoryId) &&
      finance.data.paymentMethods.some((p) => p.id === tpl.paymentMethodId),
  )
})

function applyTemplate(tpl: FrequentTemplate) {
  form.name = tpl.name
  form.amount = amountInput(tpl.amount)
  const catExists = finance.data.categories.some((c) => c.id === tpl.categoryId)
  form.categoryId = catExists ? tpl.categoryId : (finance.data.categories[0]?.id ?? '')
  const payExists = finance.data.paymentMethods.some((p) => p.id === tpl.paymentMethodId)
  form.paymentMethodId = payExists ? tpl.paymentMethodId : (finance.data.paymentMethods[0]?.id ?? '')
  form.tagIds = tpl.tagIds ? tpl.tagIds.filter((id) => finance.data.tags.some((t) => t.id === id)) : []
  form.notes = tpl.notes ?? ''
  form.date = todayIso()
}

function duplicateAsNew() {
  isDuplicating.value = true
  form.date = todayIso()
  resetDirty()
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    isDuplicating.value = false
    const i = props.item
    error.value = ''
    const catExists = finance.data.categories.some((c) => c.id === i?.categoryId)
    const payExists = finance.data.paymentMethods.some((p) => p.id === i?.paymentMethodId)
    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? amountInput(i.amount) : '',
      date: i?.date ?? todayIso(),
      categoryId: catExists ? i!.categoryId : (finance.data.categories[0]?.id ?? ''),
      paymentMethodId: payExists ? i!.paymentMethodId : (finance.data.paymentMethods[0]?.id ?? ''),
      notes: i && 'notes' in i && typeof i.notes === 'string' ? i.notes : '',
      tagIds: i && 'tagIds' in i && Array.isArray(i.tagIds)
        ? i.tagIds.filter((id) => finance.data.tags.some((t) => t.id === id))
        : [],
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
    id: isEdit.value ? props.item?.id : undefined,
    name: form.name.trim(),
    amount,
    date: form.date,
    categoryId: form.categoryId,
    paymentMethodId: form.paymentMethodId,
  }
  if (props.kind === 'expense') finance.saveOneTime({ ...base, notes: form.notes.trim(), tagIds: form.tagIds })
  else finance.saveIncome({ ...base, notes: form.notes.trim(), tagIds: form.tagIds })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="hasTags ? formId : undefined" :title="title" @close="emit('close')">
    <p v-if="!hasTags" class="rounded-lg bg-caution-soft p-3 text-xs text-caution-strong">{{ t('common.noTags') }}</p>
    <form v-else :id="formId" class="space-y-3" @submit.prevent="submit">
      <!-- Chip Template Spese Frequenti -->
      <div v-if="!isEdit && frequentList.length > 0" class="space-y-1 pb-1">
        <span class="text-[11px] font-medium text-ink-4 flex items-center gap-1">
          <i class="fa-solid fa-bolt text-accent-icon text-[10px]"></i> {{ t('common.frequent') }}
        </span>
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            v-for="tpl in frequentList"
            :key="tpl.name"
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 shadow-2xs hover:bg-surface-2 active:bg-surface-3 transition-colors"
            @click="applyTemplate(tpl)"
          >
            <span class="truncate max-w-[120px]">{{ tpl.name }}</span>
            <span class="font-bold text-accent">{{ money(tpl.amount) }}</span>
          </button>
        </div>
      </div>

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
      <label class="block">
        <span class="field-label">{{ t('common.notes') }}</span>
        <input v-model="form.notes" maxlength="200" class="field" />
      </label>
      <TagInput v-model="form.tagIds" />
      <p v-if="error" class="text-xs text-negative">{{ error }}</p>

      <!-- Azione secondaria: Duplica come nuova voce -->
      <div v-if="isEdit" class="pt-1">
        <button
          type="button"
          class="w-full flex items-center justify-center gap-1.5 rounded-xl border border-accent-line bg-accent-soft/60 py-2.5 text-xs font-semibold text-accent-strongest hover:bg-accent-soft transition-colors"
          @click="duplicateAsNew"
        >
          <i class="fa-solid fa-copy"></i>
          {{ kind === 'expense' ? t('onetime.duplicateAsNew') : t('income.duplicateAsNew') }}
        </button>
      </div>

      <div class="pt-2"><SubmitButton
          :label="t('common.save')"
          :cancel-label="t('common.cancel')"
          :delete-label="isEdit && deletable ? t('common.delete') : undefined"
          @cancel="emit('close')"
          @delete="emit('delete')"
        /></div>
    </form>
  </BaseModal>
</template>
