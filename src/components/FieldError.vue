<script setup lang="ts">
/**
 * Il messaggio d'errore di un campo, subito sotto di esso. `role="alert"`: il lettore di schermo lo legge appena
 * compare, anche se il cursore è altrove.
 */
defineProps<{ id: string; message?: string }>()
</script>

<template>
  <p v-if="message" :id="id" role="alert" class="mt-1 flex items-start gap-1.5 text-sm font-medium text-negative">
    <i class="fa-solid fa-circle-exclamation mt-[0.2rem] text-xs" aria-hidden="true"></i>{{ message }}
  </p>
</template>
