<script setup lang="ts">
import { ref } from 'vue'
import type { Loan } from '@/types/models'
import { loanStatus } from '@/domain/calculations'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import PageHeader from '@/components/PageHeader.vue'
import LoanForm from '@/components/LoanForm.vue'
import RepaymentForm from '@/components/RepaymentForm.vue'

const finance = useFinanceStore()
const ui = useUiStore()
const { t, money, date } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<Loan | null>(null)
const repayingLoan = ref<Loan | null>(null)
const repaymentOpen = ref(false)

function open(item: Loan | null) {
  editing.value = item
  formOpen.value = true
}

function openRepayment(loan: Loan) {
  repayingLoan.value = loan
  repaymentOpen.value = true
}

async function removeRepayment(loan: Loan, repaymentId: string) {
  const ok = await ui.confirm({
    title: t('common.delete'),
    message: t('loans.deleteRepayment'),
    confirmLabel: t('common.confirmDelete'),
  })
  if (ok) finance.deleteRepayment(loan.id, repaymentId)
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('loans.title')" add-label="" @add="open(null)" />

    <div v-for="loan in finance.loans" :key="loan.id" class="card space-y-2 text-xs">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-sm font-bold text-slate-800">{{ loan.name }}</div>
          <div class="text-[11px] text-slate-400">{{ date(loan.date) }}<template v-if="loan.notes"> · {{ loan.notes }}</template></div>
        </div>
        <span
          class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
          :class="loan.type === 'given' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'"
        >
          {{ loan.type === 'given' ? t('loans.givenShort') : t('loans.receivedShort') }}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center">
        <div>
          <p class="text-[10px] text-slate-500 uppercase">{{ t('common.total') }}</p>
          <p class="font-bold text-slate-800">{{ money(loan.amount) }}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500 uppercase">{{ t('loans.repaid') }}</p>
          <p class="font-bold text-emerald-600">{{ money(loanStatus(loan).repaid) }}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500 uppercase">{{ t('loans.remaining') }}</p>
          <p v-if="loanStatus(loan).remaining > 0" class="font-bold text-rose-600">{{ money(loanStatus(loan).remaining) }}</p>
          <p v-else class="font-bold text-slate-400"><i class="fa-solid fa-check mr-1"></i>{{ t('loans.settled') }}</p>
        </div>
      </div>

      <div v-if="loan.repayments.length" class="space-y-1 pt-1">
        <div
          v-for="r in loan.repayments"
          :key="r.id"
          class="my-1 flex items-center justify-between border-l-2 border-emerald-400 pl-2 text-[11px] text-slate-500"
        >
          <span>{{ t('loans.repaymentOn', { date: date(r.date) }) }}</span>
          <span class="flex items-center gap-1">
            <span class="font-semibold text-emerald-600">+{{ money(r.amount) }}</span>
            <button type="button" class="p-1 text-slate-300 hover:text-rose-500" :aria-label="t('common.delete')" @click="removeRepayment(loan, r.id)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </span>
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-slate-200 pt-1">
        <button
          type="button"
          class="rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100"
          @click="openRepayment(loan)"
        >
          <i class="fa-solid fa-plus mr-1"></i> {{ t('loans.addRepayment') }}
        </button>
        <div class="flex">
          <button type="button" class="icon-btn text-indigo-600" :aria-label="t('common.edit')" @click="open(loan)">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="icon-btn text-rose-500" :aria-label="t('common.delete')" @click="confirmDelete(loan.name, () => finance.deleteLoan(loan.id))">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <p v-if="!finance.loans.length" class="py-6 text-center text-xs text-slate-400">{{ t('loans.empty') }}</p>

    <LoanForm :open="formOpen" :item="editing" @close="formOpen = false" />
    <RepaymentForm :open="repaymentOpen" :loan="repayingLoan" @close="repaymentOpen = false" />
  </section>
</template>
