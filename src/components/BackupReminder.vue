<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useBackupStore } from '@/stores/backup'

const { t } = useI18n()
const backup = useBackupStore()
</script>

<template>
  <div v-if="backup.reminderDue" role="status" class="mb-4 rounded-xl border border-caution-line-strong bg-caution-soft p-3 text-sm text-caution-stronger md:mb-4">
    <p>
      <i class="fa-solid fa-triangle-exclamation mr-1"></i>
      {{ backup.lastBackupAt ? t('settings.reminderStale', { days: backup.daysOverdue }) : t('settings.reminderNever') }}
    </p>
    <div class="mt-2 flex gap-2">
      <RouterLink
        to="/impostazioni"
        class="inline-flex min-h-10 items-center rounded-lg bg-caution-icon px-4 text-sm font-medium text-on-color hover:bg-caution-bright"
      >
        {{ t('settings.reminderAction') }}
      </RouterLink>
      <button type="button" class="min-h-10 rounded-lg px-3 text-sm font-medium text-caution-strong hover:bg-caution-soft-2" @click="backup.snooze()">
        {{ t('settings.reminderLater') }}
      </button>
    </div>
  </div>
</template>
