<script setup lang="ts">
/**
 * Scelta dei tag nei moduli (`TransactionForm`, `QuickExpenseForm`), `PKT-21`: un solo campo che cerca e crea.
 * Sotto il campo si apre l'elenco dei tag proposti (`suggestTags`): a campo vuoto i più usati, scrivendo quelli che
 * corrispondono, e in fondo «Crea #nome» se il nome non esiste. L'elenco sta dentro il modulo (non sopra), così sul
 * telefono non finisce sotto la tastiera e non viene tagliato dal bordo del foglio. I tag scelti sono pillole con la ✕.
 * Accessibilità: schema combobox con `listbox` (frecce, Invio, Esc), come da ARIA Authoring Practices.
 */
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { badgeColors } from '@/utils/colors'
import { normalizeTagSearch, suggestTags } from '@/domain/tags'
import type { Tag } from '@/types/models'

const model = defineModel<string[]>({ default: () => [] })
const finance = useFinanceStore()
const { t } = useI18n()

const MAX_NAME = 30

const listId = useId()
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const query = ref('')
const open = ref(false)
const activeIndex = ref(-1)

/** Il testo scritto senza il «#» iniziale, che molti scrivono per abitudine. */
const typedName = computed(() => query.value.trim().replace(/^#+/, '').trim())

const selectedTags = computed(() =>
  model.value.map((id) => finance.tag('tags', id)).filter((tag): tag is Tag => !!tag),
)

const suggestions = computed(() =>
  suggestTags(finance.sortedTags.tags, finance.tagUsageCounts.tags, {
    query: typedName.value,
    excludeIds: model.value,
  }),
)

type Option = { kind: 'tag'; tag: Tag; uses: number } | { kind: 'create'; name: string }

const options = computed<Option[]>(() => {
  const items: Option[] = suggestions.value.items.map((tag) => ({
    kind: 'tag',
    tag,
    uses: finance.tagUsageCounts.tags.get(tag.id) ?? 0,
  }))
  const name = typedName.value
  if (name && !suggestions.value.exact && name.length <= MAX_NAME) items.push({ kind: 'create', name })
  return items
})

/** Il nome scritto è già un tag scelto: lo si dice invece di proporre un doppione. */
const alreadySelected = computed(() => {
  const exact = suggestions.value.exact
  return exact && model.value.includes(exact.id) ? exact : null
})

const listVisible = computed(() => open.value && options.value.length > 0)
const hint = computed(() => {
  if (!open.value) return ''
  if (alreadySelected.value) return t('tagInput.alreadySelected', { name: alreadySelected.value.name })
  if (!options.value.length && !typedName.value && finance.data.tags.length === 0) return t('tagInput.none')
  return ''
})

const optionId = (i: number) => `${listId}-${i}`
const activeDescendant = computed(() =>
  listVisible.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined,
)

// Scrivendo si evidenzia la prima proposta, così Invio la sceglie; a campo vuoto nessuna, finché non si usano le frecce.
watch([typedName, () => options.value.length], () => {
  activeIndex.value = typedName.value && options.value.length ? 0 : -1
})

// Quando l'elenco si apre lo si porta in vista (sul telefono la tastiera occupa metà schermo).
watch(listVisible, async (visible) => {
  if (!visible) return
  await nextTick()
  list.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

function selectTag(id: string) {
  if (!model.value.includes(id)) model.value = [...model.value, id]
}

function removeTag(id: string) {
  model.value = model.value.filter((x) => x !== id)
}

function createTag(name: string) {
  if (!finance.addTag('tags', name)) return
  const key = normalizeTagSearch(name)
  const created = finance.data.tags.find((tag) => normalizeTagSearch(tag.name) === key)
  if (created) selectTag(created.id)
}

/** Dopo la scelta il campo si svuota e resta attivo: si può aggiungere subito un altro tag. */
function choose(option: Option) {
  if (option.kind === 'tag') selectTag(option.tag.id)
  else createTag(option.name)
  query.value = ''
  activeIndex.value = -1
  open.value = true
  input.value?.focus()
}

function move(step: 1 | -1) {
  open.value = true
  const count = options.value.length
  if (!count) return
  activeIndex.value = activeIndex.value < 0 ? (step === 1 ? 0 : count - 1) : (activeIndex.value + step + count) % count
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      move(-1)
      break
    case 'Enter': {
      // Invio non invia il modulo da qui: sceglie la proposta evidenziata.
      e.preventDefault()
      const option = options.value[activeIndex.value]
      if (listVisible.value && option) choose(option)
      break
    }
    case 'Escape':
      // Con l'elenco aperto Esc chiude solo l'elenco, non il foglio del modulo.
      if (listVisible.value || query.value) {
        e.stopPropagation()
        open.value = false
        activeIndex.value = -1
      }
      break
    case 'Tab':
      open.value = false
      break
  }
}

function usageLabel(uses: number) {
  return t('tagInput.usage', { n: uses }, uses)
}
</script>

<template>
  <div class="space-y-2">
    <label class="block">
      <span class="field-label">{{ t('common.tags') }}</span>
      <input
        ref="input"
        v-model="query"
        type="text"
        role="combobox"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="done"
        :maxlength="MAX_NAME + 1"
        :placeholder="t('tagInput.placeholder')"
        :aria-expanded="listVisible"
        :aria-controls="listId"
        :aria-activedescendant="activeDescendant"
        aria-autocomplete="list"
        class="field"
        @focus="open = true"
        @click="open = true"
        @input="open = true"
        @blur="open = false"
        @keydown="onKeydown"
      />
    </label>

    <!-- Proposte: dentro il modulo, sotto il campo. mousedown.prevent tiene il focus nel campo durante il tocco. -->
    <ul
      v-show="listVisible"
      :id="listId"
      ref="list"
      role="listbox"
      :aria-label="t('tagInput.suggestionsLabel')"
      class="overflow-hidden rounded-lg border border-line bg-surface shadow-sm divide-y divide-line-soft"
    >
      <li
        v-for="(option, i) in options"
        :id="optionId(i)"
        :key="option.kind === 'tag' ? option.tag.id : 'create'"
        role="option"
        :aria-selected="i === activeIndex"
        class="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 text-sm transition-colors"
        :class="i === activeIndex ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2'"
        @mousedown.prevent
        @mousemove="activeIndex = i"
        @click="choose(option)"
      >
        <template v-if="option.kind === 'tag'">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: option.tag.color }" aria-hidden="true"></span>
          <span class="min-w-0 flex-1 truncate font-medium">#{{ option.tag.name }}</span>
          <span class="shrink-0 text-xs tabular-nums" :class="i === activeIndex ? 'text-accent' : 'text-ink-4'">
            {{ usageLabel(option.uses) }}
          </span>
        </template>
        <template v-else>
          <i class="fa-solid fa-plus w-2.5 shrink-0 text-center text-xs" aria-hidden="true"></i>
          <span class="min-w-0 flex-1 truncate font-medium">{{ t('tagInput.create', { name: option.name }) }}</span>
        </template>
      </li>
    </ul>
    <p v-if="hint" class="px-1 text-xs text-ink-4" aria-live="polite">{{ hint }}</p>

    <!-- Tag scelti -->
    <ul v-if="selectedTags.length > 0" class="flex flex-wrap gap-1.5" :aria-label="t('tagInput.selectedLabel')">
      <li
        v-for="tag in selectedTags"
        :key="tag.id"
        class="inline-flex items-center gap-1 rounded-full py-0.5 pr-0.5 pl-2.5 text-xs font-medium shadow-2xs"
        :style="{ backgroundColor: badgeColors(tag.color).background, color: badgeColors(tag.color).color }"
      >
        <span>#{{ tag.name }}</span>
        <button
          type="button"
          class="inline-flex h-6 w-6 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-black/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-current"
          :aria-label="t('tagInput.remove', { name: tag.name })"
          @click="removeTag(tag.id)"
        >
          <i class="fa-solid fa-xmark text-[10px]" aria-hidden="true"></i>
        </button>
      </li>
    </ul>
  </div>
</template>
