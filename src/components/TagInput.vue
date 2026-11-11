<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { readableTextColor } from '@/utils/colors'

const model = defineModel<string[]>({ default: () => [] })
const finance = useFinanceStore()
const { t } = useI18n()

const newTagName = ref('')

const allTags = computed(() => finance.data.tags)

const selectedTags = computed(() => {
  return model.value
    .map((id) => finance.tag('tags', id))
    .filter((tag): tag is NonNullable<typeof tag> => !!tag)
})

const unselectedTags = computed(() => {
  const currentSet = new Set(model.value)
  return allTags.value.filter((tag) => !currentSet.has(tag.id))
})

function selectTag(id: string) {
  if (!model.value.includes(id)) {
    model.value = [...model.value, id]
  }
}

function removeTag(id: string) {
  model.value = model.value.filter((t) => t !== id)
}

function handleAddNew() {
  const name = newTagName.value.trim()
  if (!name) return

  const existing = allTags.value.find((t) => t.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (existing) {
    selectTag(existing.id)
    newTagName.value = ''
    return
  }

  if (finance.addTag('tags', name)) {
    const created = allTags.value.find((t) => t.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (created) {
      selectTag(created.id)
    }
    newTagName.value = ''
  }
}
</script>

<template>
  <div class="space-y-2">
    <span class="field-label">{{ t('common.tags') }}</span>

    <!-- Tag selezionati -->
    <div v-if="selectedTags.length > 0" class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in selectedTags"
        :key="tag.id"
        class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shadow-2xs"
        :style="{ backgroundColor: tag.color, color: readableTextColor(tag.color) }"
      >
        <span>#{{ tag.name }}</span>
        <button
          type="button"
          class="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-black/15 hover:opacity-100"
          :aria-label="t('common.delete')"
          @click="removeTag(tag.id)"
        >
          <i class="fa-solid fa-xmark text-[10px]"></i>
        </button>
      </span>
    </div>

    <!-- Tag disponibili da selezionare al volo -->
    <div v-if="unselectedTags.length > 0" class="flex flex-wrap items-center gap-1.5 pt-0.5">
      <button
        v-for="tag in unselectedTags"
        :key="tag.id"
        type="button"
        class="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-3 transition-colors hover:border-line-strong hover:bg-surface-3"
        @click="selectTag(tag.id)"
      >
        <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: tag.color }"></span>
        <span>#{{ tag.name }}</span>
        <i class="fa-solid fa-plus text-[9px] text-ink-5"></i>
      </button>
    </div>

    <!-- Campo per creare un nuovo tag al volo -->
    <div class="flex gap-1.5">
      <div class="relative flex-1">
        <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs text-ink-4">#</span>
        <input
          v-model="newTagName"
          type="text"
          maxlength="30"
          :placeholder="t('onetime.newTagPlaceholder')"
          class="field field-compact h-9 min-h-9 pl-6 text-xs"
          @keydown.enter.prevent="handleAddNew"
        />
      </div>
      <button
        type="button"
        class="h-9 min-h-9 shrink-0 rounded-lg border border-line-strong bg-surface-3 px-3 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-4 disabled:opacity-50"
        :disabled="!newTagName.trim()"
        @click="handleAddNew"
      >
        <i class="fa-solid fa-plus mr-1"></i> {{ t('app.add') }}
      </button>
    </div>
  </div>
</template>
