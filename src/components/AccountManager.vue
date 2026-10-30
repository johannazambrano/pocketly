<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { Account } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useFormat } from '@/i18n'
import { centsToInput, toCents } from '@/utils/money'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'
import TagBadge from './TagBadge.vue'

const finance = useFinanceStore()
const ui = useUiStore()
const { t, money, date } = useFormat()

const balanceOf = computed(() => new Map(finance.balances.map((b) => [b.id, b.balance])))
/** Per ogni metodo di pagamento, il conto a cui appartiene. */
const ownerOf = computed(() => new Map(finance.data.accounts.flatMap((a) => a.paymentMethodIds.map((p) => [p, a] as const))))

// --- modifica ---------------------------------------------------------------

const editing = ref<Account | null>(null)
const open = ref(false)
const form = reactive({ name: '', openingAmount: '', openingDate: '', paymentMethodIds: [] as string[] })
const error = ref('')

function startEdit(account: Account | null) {
  editing.value = account
  error.value = ''
  Object.assign(form, {
    name: account?.name ?? '',
    openingAmount: account ? centsToInput(account.openingAmount) : '',
    openingDate: account?.openingDate ?? finance.today,
    paymentMethodIds: [...(account?.paymentMethodIds ?? [])],
  })
  open.value = true
}

/** Nome del conto da cui il metodo verrebbe spostato salvando questo. */
function otherOwner(methodId: string): string | null {
  const owner = ownerOf.value.get(methodId)
  return owner && owner.id !== editing.value?.id ? owner.name : null
}

function submit() {
  // Il saldo di partenza può essere negativo (conto in rosso) o zero.
  const amount = toCents(form.openingAmount)
  if (amount === null) {
    error.value = t('accounts.invalidAmount')
    return
  }
  finance.saveAccount({
    id: editing.value?.id,
    name: form.name.trim(),
    openingAmount: amount,
    openingDate: form.openingDate,
    paymentMethodIds: form.paymentMethodIds,
  })
  open.value = false
}

async function askDelete(account: Account) {
  const ok = await ui.confirm({
    title: t('common.delete'),
    message: t('common.deleteQuestion', { name: account.name }),
    confirmLabel: t('common.confirmDelete'),
  })
  if (ok) finance.deleteAccount(account.id)
}
</script>

<template>
  <div class="card space-y-3">
    <h3 class="text-sm font-semibold text-slate-700"><i class="fa-solid fa-building-columns mr-1 text-blue-600"></i> {{ t('accounts.title') }}</h3>
    <p class="text-xs text-slate-500">{{ t('accounts.hint') }}</p>

    <ul v-if="finance.data.accounts.length" class="divide-y divide-slate-100 text-xs">
      <li v-for="a in finance.data.accounts" :key="a.id" class="flex items-start justify-between gap-2 px-1 py-2">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-baseline justify-between gap-2">
            <span class="truncate font-medium">{{ a.name }}</span>
            <span class="shrink-0 font-semibold" :class="(balanceOf.get(a.id) ?? 0) >= 0 ? 'text-blue-600' : 'text-rose-600'">
              {{ money(balanceOf.get(a.id) ?? 0) }}
            </span>
          </div>
          <p class="text-[11px] text-slate-400">{{ t('accounts.opening', { amount: money(a.openingAmount), date: date(a.openingDate) }) }}</p>
          <div class="flex flex-wrap gap-1">
            <TagBadge v-for="p in a.paymentMethodIds" :key="p" kind="paymentMethods" :id="p" />
            <span v-if="!a.paymentMethodIds.length" class="text-[11px] text-amber-700">{{ t('accounts.noMethods') }}</span>
          </div>
        </div>
        <div class="flex shrink-0 items-center">
          <button type="button" class="icon-btn text-xs text-indigo-600" :aria-label="t('common.edit')" @click="startEdit(a)">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="icon-btn text-xs text-rose-500" :aria-label="t('common.delete')" @click="askDelete(a)">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      </li>
    </ul>

    <button type="button" class="min-h-10 w-full rounded-lg bg-slate-800 px-4 text-sm text-white hover:bg-slate-700" @click="startEdit(null)">
      {{ t('accounts.new') }}
    </button>

    <BaseModal :open="open" :title="t(editing ? 'accounts.edit' : 'accounts.new')" @close="open = false">
      <form class="space-y-3" @submit.prevent="submit">
        <label class="block">
          <span class="field-label">{{ t('common.name') }}</span>
          <input v-model="form.name" required maxlength="40" class="field" :placeholder="t('accounts.namePlaceholder')" />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="field-label">{{ t('accounts.openingAmount') }}</span>
            <input v-model="form.openingAmount" required inputmode="decimal" class="field" placeholder="0,00" />
          </label>
          <label class="block">
            <span class="field-label">{{ t('accounts.openingDate') }}</span>
            <input v-model="form.openingDate" type="date" required class="field" />
          </label>
        </div>
        <p class="text-[11px] text-slate-500">{{ t('accounts.openingHint') }}</p>
        <fieldset class="space-y-1">
          <legend class="field-label">{{ t('accounts.methods') }}</legend>
          <label v-for="p in finance.data.paymentMethods" :key="p.id" class="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input v-model="form.paymentMethodIds" type="checkbox" :value="p.id" class="h-4 w-4 accent-emerald-600" />
            <span>{{ p.name }}</span>
            <span v-if="otherOwner(p.id)" class="text-[11px] text-slate-400">{{ t('accounts.inOther', { name: otherOwner(p.id) }) }}</span>
          </label>
        </fieldset>
        <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>
        <div class="pt-2"><SubmitButton :label="t('common.save')" /></div>
      </form>
    </BaseModal>
  </div>
</template>
