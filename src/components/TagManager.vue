<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Tag } from '@/types/models'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ kind: TagKind; title: string; placeholder: string }>()
const { t } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()

const tags = computed(() => finance.data[props.kind])
const newName = ref('')

function add() {
  if (finance.addTag(props.kind, newName.value)) newName.value = ''
  else ui.toast(t('settings.duplicateName'), 'error')
}

// --- rinomina in linea --------------------------------------------------
const editingId = ref<string | null>(null)
const editingName = ref('')
const editInput = ref<HTMLInputElement[]>([])

async function startRename(tag: Tag) {
  editingId.value = tag.id
  editingName.value = tag.name
  await nextTick()
  editInput.value[0]?.select()
}

function commitRename() {
  if (!editingId.value) return
  const tag = finance.tag(props.kind, editingId.value)
  if (tag && editingName.value.trim() !== tag.name && !finance.renameTag(props.kind, tag.id, editingName.value)) {
    ui.toast(t('settings.duplicateName'), 'error')
  }
  editingId.value = null
}

// --- eliminazione con riassegnazione -------------------------------------
const deleting = ref<Tag | null>(null)
const reassignTo = ref('')
const deletingUsage = computed(() => (deleting.value ? finance.tagUsage(props.kind, deleting.value.id) : 0))
const alternatives = computed(() => tags.value.filter((x) => x.id !== deleting.value?.id))

function askDelete(tag: Tag) {
  deleting.value = tag
  reassignTo.value = tags.value.find((x) => x.id !== tag.id)?.id ?? ''
}

function confirmDelete() {
  if (!deleting.value) return
  finance.deleteTag(props.kind, deleting.value.id, deletingUsage.value ? reassignTo.value : undefined)
  deleting.value = null
}
</script>

<template>
  <div class="card space-y-3">
    <h3 class="text-sm font-semibold text-slate-700">{{ title }}</h3>
    <form class="flex gap-2" @submit.prevent="add">
      <input v-model="newName" maxlength="40" :placeholder="placeholder" class="field flex-grow !py-1.5 !text-xs" />
      <button type="submit" class="rounded bg-slate-800 px-3 py-1.5 text-xs whitespace-nowrap text-white">{{ t('app.add') }}</button>
    </form>
    <ul class="divide-y divide-slate-100 text-xs">
      <li v-for="tag in tags" :key="tag.id" class="flex items-center justify-between gap-2 px-1 py-2">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="color"
            :value="tag.color"
            :aria-label="t('settings.pickColor')"
            class="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
            @change="finance.setTagColor(kind, tag.id, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="shrink-0 p-1 text-slate-500 hover:text-emerald-600"
            :title="t('settings.randomColor')"
            :aria-label="t('settings.randomColor')"
            @click="finance.randomizeTagColor(kind, tag.id)"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </button>
          <input
            v-if="editingId === tag.id"
            ref="editInput"
            v-model="editingName"
            maxlength="40"
            class="field !py-1 !text-xs"
            @keydown.enter.prevent="commitRename"
            @keydown.esc="editingId = null"
            @blur="commitRename"
          />
          <span v-else class="truncate font-medium">{{ tag.name }}</span>
        </div>
        <div class="flex shrink-0 items-center">
          <button type="button" class="icon-btn text-xs text-indigo-600" :aria-label="t('settings.rename')" @click="startRename(tag)">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="icon-btn text-xs text-rose-500" :aria-label="t('common.delete')" @click="askDelete(tag)">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      </li>
    </ul>

    <BaseModal
      :open="!!deleting"
      :title="t('settings.deleteTagTitle', { name: deleting?.name ?? '' })"
      @close="deleting = null"
    >
      <div class="space-y-3 text-sm text-slate-600">
        <p v-if="!deletingUsage">{{ t('settings.deleteTagUnused') }}</p>
        <p v-else-if="!alternatives.length">{{ t('settings.deleteTagLast', { count: deletingUsage }) }}</p>
        <template v-else>
          <p>{{ t('settings.deleteTagReassign', { count: deletingUsage }) }}</p>
          <select v-model="reassignTo" class="field">
            <option v-for="alt in alternatives" :key="alt.id" :value="alt.id">{{ alt.name }}</option>
          </select>
        </template>
      </div>
      <div class="mt-5 flex gap-2">
        <button type="button" class="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium" @click="deleting = null">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          :disabled="deletingUsage > 0 && !alternatives.length"
          @click="confirmDelete"
        >
          {{ t('common.delete') }}
        </button>
      </div>
    </BaseModal>
  </div>
</template>
