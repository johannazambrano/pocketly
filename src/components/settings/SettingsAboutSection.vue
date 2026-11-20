<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import { useUiStore } from '@/stores/ui'
import { applyUpdate, checkForUpdate } from '@/composables/useAppUpdate'
import { useFormat } from '@/i18n'

const notifications = useNotificationsStore()
const ui = useUiStore()
const { t, locale } = useFormat()

const version = __APP_VERSION__
/** «del 12 nov 2026, 15:30»: su Vercel la versione resta «0.1», e la build si riconosce dalla data. */
const build = computed(() =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(__APP_BUILT_AT__)),
)

const persistent = ref<boolean | null>(null)
onMounted(async () => {
  try {
    persistent.value = (await navigator.storage?.persisted?.()) ?? false
  } catch {
    persistent.value = false
  }
})

const checkingUpdate = ref(false)

/** Cerca una versione nuova; se c'è la applica subito (questa finestra si ricarica). */
async function checkAppUpdates() {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  try {
    const result = await checkForUpdate()
    if (result === 'available') {
      ui.toast(t('settings.updateFound'))
      applyUpdate()
    } else if (result === 'offline') {
      ui.toast(t('settings.updateOffline'), 'error')
    } else if (result === 'error') {
      ui.toast(t('settings.updateCheckFailed'), 'error')
    } else {
      ui.toast(t('settings.upToDate'))
    }
  } finally {
    checkingUpdate.value = false
  }
}

/**
 * Via d'uscita se l'app resta su una versione vecchia: toglie il service worker e svuota le sue cache.
 * Togliere il worker cancella anche l'iscrizione alle notifiche push: la rifà la sincronizzazione successiva
 * (notifications.runSyncPushSchedule), e il messaggio di conferma lo dice.
 */
async function forceReloadServer() {
  const message = notifications.enabled
    ? `${t('settings.forceReloadConfirm')} ${t('settings.forceReloadNotifications')}`
    : t('settings.forceReloadConfirm')
  const confirmed = await ui.confirm({
    title: t('settings.forceReload'),
    message,
    confirmLabel: t('settings.forceReload'),
    danger: false,
  })
  if (!confirmed) return

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((reg) => reg.unregister()))
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch (error) {
    console.warn('Errore durante la pulizia delle cache PWA:', error)
  }

  window.location.reload()
}
</script>

<template>
  <div class="space-y-4">
    <div class="card space-y-3">
      <h3 class="text-sm font-semibold text-ink-2">
        <i class="fa-solid fa-arrows-rotate mr-1 text-recurring" aria-hidden="true"></i> {{ t('settings.updatesTitle') }}
      </h3>
      <p class="text-xs text-ink-4">{{ t('settings.version', { version, build }) }}</p>
      <button
        type="button"
        class="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-60"
        :disabled="checkingUpdate"
        @click="checkAppUpdates"
      >
        <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': checkingUpdate }" aria-hidden="true"></i>
        {{ checkingUpdate ? t('settings.checkingUpdates') : t('settings.checkUpdates') }}
      </button>
      <p class="text-xs text-ink-4">
        {{ t('settings.forceReloadHint') }}
        <button type="button" class="font-medium text-ink-2 underline underline-offset-2 hover:text-ink" @click="forceReloadServer">
          {{ t('settings.forceReload') }}
        </button>
      </p>
    </div>

    <div class="card space-y-2 text-xs text-ink-4">
      <h3 class="text-sm font-semibold text-ink-2">
        <i class="fa-solid fa-shield-halved mr-1 text-ink-3" aria-hidden="true"></i> {{ t('settings.privacyTitle') }}
      </h3>
      <p>{{ t('settings.privacyText') }}</p>
      <p v-if="persistent === true" class="text-accent">
        <i class="fa-solid fa-check mr-1" aria-hidden="true"></i>{{ t('settings.storagePersistent') }}
      </p>
      <p v-else-if="persistent === false" class="text-caution">
        <i class="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true"></i>{{ t('settings.storageNotPersistent') }}
      </p>
    </div>
  </div>
</template>
