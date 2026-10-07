<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import BaseModal from './BaseModal.vue'

const ui = useUiStore()
const { t } = useI18n()
</script>

<template>
  <BaseModal :open="!!ui.confirmRequest" :title="ui.confirmRequest?.title ?? ''" @close="ui.answerConfirm(false)">
    <p class="text-sm text-slate-600">{{ ui.confirmRequest?.message }}</p>
    <div class="mt-5 flex gap-2">
      <button type="button" class="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium" @click="ui.answerConfirm(false)">
        {{ t('common.cancel') }}
      </button>
      <button
        type="button"
        class="flex-1 rounded-xl py-2.5 text-sm font-bold text-white"
        :class="ui.confirmRequest?.danger ? 'bg-rose-600' : 'bg-emerald-600'"
        @click="ui.answerConfirm(true)"
      >
        {{ ui.confirmRequest?.confirmLabel }}
      </button>
    </div>
  </BaseModal>
</template>
