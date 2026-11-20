<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFormat } from '@/i18n'
import { usePageAction } from '@/composables/usePageAction'
import {
  DEFAULT_DESKTOP_SECTION,
  getSettingsSection,
  isSettingsSection,
  type SettingsSectionId,
} from '@/utils/settingsSections'
import PageHeader from '@/components/PageHeader.vue'
import SyncSettings from '@/components/SyncSettings.vue'
import NotificationSettings from '@/components/NotificationSettings.vue'
import TagManager from '@/components/TagManager.vue'
import QuickExpenseManager from '@/components/QuickExpenseManager.vue'
import SettingsIndex from '@/components/settings/SettingsIndex.vue'
import SettingsDataSection from '@/components/settings/SettingsDataSection.vue'
import SettingsAppearanceSection from '@/components/settings/SettingsAppearanceSection.vue'
import SettingsAboutSection from '@/components/settings/SettingsAboutSection.vue'

const route = useRoute()
const router = useRouter()
const { t } = useFormat()

/** Sezione scelta nell'URL (`/impostazioni/:section`), oppure `null` sull'indice `/impostazioni`. */
const routeSection = computed<SettingsSectionId | null>(() =>
  isSettingsSection(route.params.section) ? route.params.section : null,
)

/** Larghezza `lg` di Tailwind (1024px), da cui l'indice e la sezione stanno affiancati. */
const wideQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 1024px)') : null
const isWide = ref(wideQuery?.matches ?? false)
const onWideChange = (e: MediaQueryListEvent) => {
  isWide.value = e.matches
}
wideQuery?.addEventListener('change', onWideChange)

/** Su PC (`>= lg`) `/impostazioni` mostra già la prima sezione a destra senza fare redirect. */
const displayedSection = computed<SettingsSectionId>(() => routeSection.value ?? DEFAULT_DESKTOP_SECTION)
/** Sull'indice da telefono la colonna della sezione è nascosta: non la si monta, così non carica «Dati e backup» per niente. */
const showDetail = computed(() => routeSection.value !== null || isWide.value)
const sectionMeta = computed(() => getSettingsSection(displayedSection.value))

const sectionHeading = ref<HTMLElement | null>(null)
const tagManagerRef = ref<InstanceType<typeof TagManager> | null>(null)
const quickExpenseRef = ref<InstanceType<typeof QuickExpenseManager> | null>(null)

const tagSectionProps = computed(() => {
  switch (displayedSection.value) {
    case 'categorie':
      return { kind: 'categories' as const, title: t('settings.categories'), placeholder: t('settings.newCategory') }
    case 'metodi':
      return { kind: 'paymentMethods' as const, title: t('settings.paymentMethods'), placeholder: t('settings.newPayment') }
    case 'tag':
      return { kind: 'tags' as const, title: t('settings.tags'), placeholder: t('settings.newTag') }
    default:
      return null
  }
})

/**
 * Azione «+» contestuale della barra inferiore (PKT-20): sulle pagine anagrafiche e sugli inserimenti rapidi
 * apre/mette a fuoco la creazione della voce; altrove lascia la «Nuova spesa» di serie.
 */
usePageAction(() => {
  switch (routeSection.value) {
    case 'categorie':
      return { label: t('settings.tagManager.addCategoryAction'), run: () => void tagManagerRef.value?.focusAdd() }
    case 'metodi':
      return { label: t('settings.tagManager.addPaymentAction'), run: () => void tagManagerRef.value?.focusAdd() }
    case 'tag':
      return { label: t('settings.tagManager.addTagAction'), run: () => void tagManagerRef.value?.focusAdd() }
    case 'inserimenti-rapidi':
      return { label: t('quickExpenses.new'), run: () => quickExpenseRef.value?.openCreate() }
    default:
      return null
  }
})

/**
 * Titolo della scheda del browser e focus all'apertura di una pagina figlia su schermi stretti:
 * se c'è un'ancora (es. `#backup`) il focus resta a quel riquadro.
 */
const previousTitle = document.title
watch(
  routeSection,
  async (section) => {
    document.title = section ? `${t(getSettingsSection(section).titleKey)} · ${__APP_NAME__}` : previousTitle
    if (!section || route.hash) return
    await nextTick()
    if (sectionHeading.value && sectionHeading.value.offsetParent !== null) {
      sectionHeading.value.focus()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  document.title = previousTitle
  wideQuery?.removeEventListener('change', onWideChange)
})

/**
 * «← Impostazioni»: se si arriva dall'indice usa la cronologia (ripristina lo scorrimento);
 * aprendo un collegamento diretto (es. dall'avviso del backup) porta all'indice.
 */
function goBack(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  if (router.options.history.state.back === '/impostazioni') router.back()
  else void router.push({ name: 'settings' })
}
</script>

<template>
  <section class="space-y-4">
    <!-- Intestazione principale: sull'indice su tutti gli schermi, su PC sempre visibile. -->
    <div :class="routeSection ? 'hidden lg:block' : 'block'">
      <PageHeader :title="t('settings.title')" />
    </div>

    <!-- Intestazione pagina figlia su telefono e tablet (< lg), con ritorno all'indice come in BreakdownDetailView. -->
    <div v-if="routeSection" class="space-y-1 lg:hidden">
      <a
        href="/impostazioni"
        class="-ml-1 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-medium text-accent hover:text-accent-strong"
        @click="goBack"
      >
        <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>{{ t('settings.back') }}
      </a>
      <h2 ref="sectionHeading" tabindex="-1" class="text-xl font-bold tracking-tight text-ink focus:outline-none">
        {{ t(sectionMeta.titleKey) }}
      </h2>
    </div>

    <!-- Master-detail: su < lg mostra o l'indice o la sezione; su >= lg indice sticky a sinistra e sezione a destra. -->
    <div class="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div
        class="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto lg:pr-1"
        :class="routeSection ? 'hidden lg:block' : 'block'"
      >
        <SettingsIndex :active-section="displayedSection" :current-section="routeSection" />
      </div>

      <div v-if="showDetail" class="min-w-0 space-y-4" :class="routeSection ? 'block' : 'hidden lg:block'">
        <h2 class="hidden text-lg font-bold tracking-tight text-ink lg:block">
          {{ t(sectionMeta.titleKey) }}
        </h2>

        <SettingsDataSection v-if="displayedSection === 'dati'" />
        <SyncSettings v-else-if="displayedSection === 'sincronizzazione'" />
        <NotificationSettings v-else-if="displayedSection === 'notifiche'" />
        <TagManager
          v-else-if="tagSectionProps"
          ref="tagManagerRef"
          :kind="tagSectionProps.kind"
          :title="tagSectionProps.title"
          :placeholder="tagSectionProps.placeholder"
        />
        <QuickExpenseManager v-else-if="displayedSection === 'inserimenti-rapidi'" ref="quickExpenseRef" />
        <SettingsAppearanceSection v-else-if="displayedSection === 'aspetto'" />
        <SettingsAboutSection v-else-if="displayedSection === 'informazioni'" />
      </div>
    </div>
  </section>
</template>
