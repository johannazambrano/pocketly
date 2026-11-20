<script setup lang="ts">
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import type { Tag } from '@/types/models'
import { filterAndSortTags, groupTagsByLetter, type TagKind, type TagSortMode, type TagUsageFilter } from '@/domain/tags'
import { useFormat } from '@/i18n'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useDirty } from '@/composables/useDirty'
import { useFormErrors } from '@/composables/useFormErrors'
import { badgeColors, OTHER_COLOR, PALETTE, randomUniqueColor, readableTextColor } from '@/utils/colors'
import BaseModal from './BaseModal.vue'
import FieldError from './FieldError.vue'
import SubmitButton from './SubmitButton.vue'

const LETTER_GROUP_THRESHOLD = 15
const SWATCHES = [...PALETTE, OTHER_COLOR] as const

const props = defineProps<{ kind: TagKind; title: string; placeholder: string }>()
const { t, locale } = useFormat()
const finance = useFinanceStore()
const ui = useUiStore()

const tags = computed(() => finance.sortedTags[props.kind])
const usageMap = computed(() => finance.tagUsageCounts[props.kind])

const addInput = ref<HTMLInputElement | null>(null)
const newName = ref('')

// --- ricerca, filtro e ordinamento ----------------------------------------

const searchQuery = ref('')
const usageFilter = ref<TagUsageFilter>('all')
const sortMode = ref<TagSortMode>('name')

const usedCount = computed(() => tags.value.filter((item) => (usageMap.value.get(item.id) ?? 0) > 0).length)
const unusedCount = computed(() => tags.value.length - usedCount.value)
const showUsageFilters = computed(() => tags.value.length > 0 && unusedCount.value > 0 && usedCount.value > 0)

// Se lo stato dati cambia e non ci sono più voci non usate (es. dopo pulizia), torna a "Tutte".
watch(showUsageFilters, (shown) => {
  if (!shown && usageFilter.value !== 'all') usageFilter.value = 'all'
})

const visibleTags = computed(() =>
  filterAndSortTags(tags.value, usageMap.value, {
    query: searchQuery.value,
    filter: usageFilter.value,
    sort: sortMode.value,
    locale: locale.value,
  }),
)

const showLetterGroups = computed(() => sortMode.value === 'name' && visibleTags.value.length >= LETTER_GROUP_THRESHOLD)
const letterGroups = computed(() => (showLetterGroups.value ? groupTagsByLetter(visibleTags.value) : []))

function usageOf(id: string): number {
  return usageMap.value.get(id) ?? 0
}

function usageLabel(count: number): string {
  if (count === 0) return t('settings.tagManager.usageNone')
  if (count === 1) return t('settings.tagManager.usageOne')
  return t('settings.tagManager.usageMany', { count })
}

function jumpToLetter(letter: string) {
  const id = `tag-group-${props.kind}-${letter === '#' ? 'num' : letter}`
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function add() {
  if (finance.addTag(props.kind, newName.value)) newName.value = ''
  else ui.toast(t('settings.duplicateName'), 'error')
}

async function focusAdd() {
  await nextTick()
  addInput.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  addInput.value?.focus()
}

defineExpose({ focusAdd })

// --- modale / foglio di modifica ------------------------------------------

const editFormId = useId()
const editFormEl = ref<HTMLFormElement | null>(null)
const editing = ref<Tag | null>(null)
const editForm = reactive({ name: '', color: OTHER_COLOR })
const { dirty, reset: resetDirty } = useDirty(editForm, () => !!editing.value)
const formErrors = useFormErrors(editForm)

const editingUsage = computed(() => (editing.value ? usageOf(editing.value.id) : 0))
const previewBadge = computed(() => badgeColors(editForm.color))

function openEdit(tag: Tag) {
  editing.value = tag
  editForm.name = tag.name
  editForm.color = tag.color
  formErrors.clear()
  resetDirty()
}

function closeEdit() {
  editing.value = null
  formErrors.clear()
}

function pickRandomColor() {
  const existing = [...finance.data.categories, ...finance.data.paymentMethods, ...finance.data.tags].map((x) => x.color)
  editForm.color = randomUniqueColor([...existing, editForm.color])
}

async function saveEdit() {
  const tag = editing.value
  if (!tag) return
  formErrors.clear()

  const trimmed = editForm.name.trim()
  if (!formErrors.required('name', trimmed, t('settings.duplicateName'))) {
    await formErrors.focusFirst(editFormEl.value)
    return
  }

  if (trimmed !== tag.name) {
    const ok = finance.renameTag(props.kind, tag.id, trimmed)
    if (!ok) {
      formErrors.set('name', t('settings.duplicateName'))
      await formErrors.focusFirst(editFormEl.value)
      return
    }
  }

  if (editForm.color.toLowerCase() !== tag.color.toLowerCase()) {
    finance.setTagColor(props.kind, tag.id, editForm.color)
  }

  editing.value = null
  ui.toast(t('settings.tagManager.saved'))
}

// --- eliminazione con riassegnazione --------------------------------------

const deleting = ref<Tag | null>(null)
const reassignTo = ref('')
const deletingUsage = computed(() => (deleting.value ? usageOf(deleting.value.id) : 0))
const alternatives = computed(() => tags.value.filter((x) => x.id !== deleting.value?.id))

function askDelete(tag: Tag) {
  deleting.value = tag
  reassignTo.value = props.kind === 'tags' ? '' : (tags.value.find((x) => x.id !== tag.id)?.id ?? '')
}

function startDeleteFromEdit() {
  const tag = editing.value
  if (!tag) return
  editing.value = null
  askDelete(tag)
}

function confirmDelete() {
  if (!deleting.value) return
  const reassign = props.kind === 'tags' ? (reassignTo.value || undefined) : (deletingUsage.value ? reassignTo.value : undefined)
  finance.deleteTag(props.kind, deleting.value.id, reassign)
  deleting.value = null
}

// Cambio sezione (categorie / metodi / tag): pulisci ricerca, filtri e modali aperti.
watch(
  () => props.kind,
  () => {
    searchQuery.value = ''
    usageFilter.value = 'all'
    sortMode.value = 'name'
    newName.value = ''
    editing.value = null
    deleting.value = null
  },
)
</script>

<template>
  <div class="card space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-ink-2">{{ title }}</h3>
      <span class="text-xs text-ink-4 tabular-nums">{{ tags.length }}</span>
    </div>

    <!-- Aggiungi in cima (form inline rapido) -->
    <form class="flex gap-2" @submit.prevent="add">
      <input
        ref="addInput"
        v-model="newName"
        maxlength="40"
        :placeholder="placeholder"
        :aria-label="placeholder"
        class="field flex-grow"
      />
      <button type="submit" class="min-h-10 shrink-0 rounded-lg bg-chrome-2 px-4 text-sm font-medium whitespace-nowrap text-on-color hover:bg-chrome-3">
        {{ t('app.add') }}
      </button>
    </form>

    <!-- Campo di ricerca sempre visibile -->
    <div class="relative">
      <i class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-ink-4" aria-hidden="true"></i>
      <input
        v-model="searchQuery"
        type="search"
        class="field pl-9 pr-9"
        :placeholder="t('settings.tagManager.searchPlaceholder')"
        :aria-label="t('settings.tagManager.searchPlaceholder')"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-4 hover:bg-surface-2 hover:text-ink-2"
        :aria-label="t('settings.tagManager.clearSearch')"
        @click="searchQuery = ''"
      >
        <i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Barra filtri utilizzo + ordinamento -->
    <div v-if="showUsageFilters || tags.length > 1" class="flex flex-wrap items-center justify-between gap-2">
      <div v-if="showUsageFilters" class="flex flex-wrap gap-1.5" role="group" :aria-label="title">
        <button
          v-for="opt in [
            { value: 'all' as const, label: t('settings.tagManager.filterAll', { count: tags.length }) },
            { value: 'used' as const, label: t('settings.tagManager.filterUsed', { count: usedCount }) },
            { value: 'unused' as const, label: t('settings.tagManager.filterUnused', { count: unusedCount }) },
          ]"
          :key="opt.value"
          type="button"
          class="min-h-8 rounded-full border px-2.5 text-xs font-medium transition-colors"
          :class="
            usageFilter === opt.value
              ? 'border-accent-icon bg-accent-soft text-accent'
              : 'border-line bg-surface-2 text-ink-3 hover:bg-surface-3'
          "
          :aria-pressed="usageFilter === opt.value"
          @click="usageFilter = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
      <span v-else></span>

      <div v-if="tags.length > 1" class="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" role="group" :aria-label="t('settings.tagManager.sortLabel')">
        <button
          type="button"
          class="min-h-7 rounded-md px-2.5 text-xs font-medium transition-colors"
          :class="sortMode === 'name' ? 'seg-on bg-surface text-ink shadow-2xs' : 'text-ink-4 hover:text-ink-2'"
          :aria-pressed="sortMode === 'name'"
          @click="sortMode = 'name'"
        >
          {{ t('settings.tagManager.sortName') }}
        </button>
        <button
          type="button"
          class="min-h-7 rounded-md px-2.5 text-xs font-medium transition-colors"
          :class="sortMode === 'usage' ? 'seg-on bg-surface text-ink shadow-2xs' : 'text-ink-4 hover:text-ink-2'"
          :aria-pressed="sortMode === 'usage'"
          @click="sortMode = 'usage'"
        >
          {{ t('settings.tagManager.sortUsage') }}
        </button>
      </div>
    </div>

    <!-- Barra di salto alfabetico quando l'elenco ordinato A-Z è lungo -->
    <div v-if="showLetterGroups" class="flex flex-wrap gap-1 pt-0.5">
      <button
        v-for="group in letterGroups"
        :key="group.letter"
        type="button"
        class="flex h-7 min-w-7 items-center justify-center rounded-md bg-surface-2 px-1.5 text-xs font-semibold text-ink-3 transition-colors hover:bg-accent-soft hover:text-accent"
        :aria-label="t('settings.tagManager.jumpToLetter', { letter: group.letter })"
        @click="jumpToLetter(group.letter)"
      >
        {{ group.letter }}
      </button>
    </div>

    <!-- Stati vuoti -->
    <p v-if="!tags.length" class="py-4 text-center text-sm text-ink-4">
      {{ t('settings.tagManager.emptyList') }}
    </p>
    <p v-else-if="!visibleTags.length" class="py-4 text-center text-sm text-ink-4">
      <template v-if="searchQuery.trim()">{{ t('settings.tagManager.noResults', { query: searchQuery.trim() }) }}</template>
      <template v-else-if="usageFilter === 'unused'">{{ t('settings.tagManager.emptyUnused') }}</template>
      <template v-else>{{ t('settings.tagManager.emptyUsed') }}</template>
    </p>

    <!-- Elenco raggruppato per iniziale (>= 15 voci in ordine A-Z) -->
    <div v-else-if="showLetterGroups" class="space-y-4">
      <section
        v-for="group in letterGroups"
        :id="`tag-group-${kind}-${group.letter === '#' ? 'num' : group.letter}`"
        :key="group.letter"
        class="space-y-1.5"
      >
        <h4 class="px-1 text-xs font-semibold text-ink-4">{{ group.letter }}</h4>
        <ul class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <li v-for="tag in group.items" :key="tag.id">
            <button
              type="button"
              class="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line-soft bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-icon"
              :aria-label="t('settings.tagManager.editRowLabel', { name: tag.name, usage: usageLabel(usageOf(tag.id)) })"
              @click="openEdit(tag)"
            >
              <span class="flex min-w-0 flex-1 items-center gap-2.5">
                <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: tag.color }" aria-hidden="true"></span>
                <span class="truncate text-sm font-medium text-ink">{{ tag.name }}</span>
              </span>
              <span class="flex shrink-0 items-center gap-2">
                <span class="text-xs text-ink-4 tabular-nums">{{ usageLabel(usageOf(tag.id)) }}</span>
                <i class="fa-solid fa-chevron-right text-[11px] text-ink-5" aria-hidden="true"></i>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <!-- Elenco piatto (griglia 2 colonne su schermi larghi) -->
    <ul v-else class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      <li v-for="tag in visibleTags" :key="tag.id">
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line-soft bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-icon"
          :aria-label="t('settings.tagManager.editRowLabel', { name: tag.name, usage: usageLabel(usageOf(tag.id)) })"
          @click="openEdit(tag)"
        >
          <span class="flex min-w-0 flex-1 items-center gap-2.5">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: tag.color }" aria-hidden="true"></span>
            <span class="truncate text-sm font-medium text-ink">{{ tag.name }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-2">
            <span class="text-xs text-ink-4 tabular-nums">{{ usageLabel(usageOf(tag.id)) }}</span>
            <i class="fa-solid fa-chevron-right text-[11px] text-ink-5" aria-hidden="true"></i>
          </span>
        </button>
      </li>
    </ul>

    <!-- Modale / foglio di modifica (nome, colore, conteggio usi, elimina) -->
    <BaseModal
      :open="!!editing"
      :title="editing?.name ?? t('settings.tagManager.editTitle')"
      :dirty="dirty"
      :form-id="editFormId"
      @close="closeEdit"
    >
      <form v-if="editing" :id="editFormId" ref="editFormEl" novalidate class="space-y-4" @submit.prevent="saveEdit">
        <!-- Anteprima live dell'etichetta -->
        <div class="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
          <span class="text-xs text-ink-4">{{ t('settings.tagManager.preview') }}</span>
          <span
            class="inline-flex max-w-[65%] items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium"
            :style="{ backgroundColor: previewBadge.background, color: previewBadge.color }"
          >
            {{ editForm.name.trim() || editing.name }}
          </span>
        </div>

        <!-- Nome -->
        <label class="block">
          <span class="field-label">{{ t('settings.tagManager.nameLabel') }}</span>
          <input
            v-model="editForm.name"
            type="text"
            maxlength="40"
            class="field"
            v-bind="formErrors.attrs('name')"
          />
          <FieldError :id="formErrors.errorId('name')" :message="formErrors.errors.name" />
        </label>

        <!-- Colore: tavolozza armoniosa + picker libero + casuale -->
        <div class="space-y-2">
          <span class="field-label">{{ t('settings.tagManager.colorLabel') }}</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="swatch in SWATCHES"
              :key="swatch"
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-full border transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-icon"
              :class="editForm.color.toLowerCase() === swatch.toLowerCase() ? 'border-ink ring-2 ring-accent-icon ring-offset-2 ring-offset-surface' : 'border-line'"
              :style="{ backgroundColor: swatch, color: readableTextColor(swatch) }"
              :aria-label="t('settings.tagManager.paletteColor', { color: swatch })"
              :aria-pressed="editForm.color.toLowerCase() === swatch.toLowerCase()"
              @click="editForm.color = swatch"
            >
              <i v-if="editForm.color.toLowerCase() === swatch.toLowerCase()" class="fa-solid fa-check text-xs" aria-hidden="true"></i>
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <label class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2">
              <input
                v-model="editForm.color"
                type="color"
                :aria-label="t('settings.pickColor')"
                class="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <span>{{ t('settings.tagManager.customColor') }}</span>
            </label>
            <button
              type="button"
              class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2"
              @click="pickRandomColor"
            >
              <i class="fa-solid fa-wand-magic-sparkles text-accent-icon" aria-hidden="true"></i>
              {{ t('settings.randomColor') }}
            </button>
          </div>
        </div>

        <!-- Riepilogo utilizzi -->
        <p class="text-xs text-ink-4">
          {{ editingUsage ? t('settings.inUse', { count: editingUsage }) : t('settings.deleteTagUnused') }}
        </p>

        <SubmitButton
          :label="t('common.save')"
          :cancel-label="t('common.cancel')"
          :delete-label="t('common.delete')"
          @cancel="closeEdit"
          @delete="startDeleteFromEdit"
        />
      </form>
    </BaseModal>

    <!-- Modale eliminazione con riassegnazione -->
    <BaseModal
      :open="!!deleting"
      :title="t('settings.deleteTagTitle', { name: deleting?.name ?? '' })"
      @close="deleting = null"
    >
      <div class="space-y-3 text-sm text-ink-3">
        <p v-if="!deletingUsage">{{ t('settings.deleteTagUnused') }}</p>
        <template v-else-if="kind === 'tags'">
          <p>{{ t('settings.deleteTagUntagOrReassign', { count: deletingUsage }) }}</p>
          <select v-model="reassignTo" class="field">
            <option value="">{{ t('settings.removeTagOnly') }}</option>
            <option v-for="alt in alternatives" :key="alt.id" :value="alt.id">{{ alt.name }}</option>
          </select>
        </template>
        <p v-else-if="!alternatives.length">{{ t('settings.deleteTagLast', { count: deletingUsage }) }}</p>
        <template v-else>
          <p>{{ t('settings.deleteTagReassign', { count: deletingUsage }) }}</p>
          <select v-model="reassignTo" class="field">
            <option v-for="alt in alternatives" :key="alt.id" :value="alt.id">{{ alt.name }}</option>
          </select>
        </template>
      </div>
      <div class="mt-5 flex gap-2">
        <button type="button" class="flex-1 rounded-xl border border-line-strong py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2" @click="deleting = null">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-negative-fill py-2.5 text-sm font-bold text-on-color disabled:opacity-40"
          :disabled="kind !== 'tags' && deletingUsage > 0 && !alternatives.length"
          @click="confirmDelete"
        >
          {{ t('common.delete') }}
        </button>
      </div>
    </BaseModal>
  </div>
</template>
