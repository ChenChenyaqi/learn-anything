<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

const { toggleLocale, t } = useI18n();
</script>

<template>
  <button
    class="text-xs font-medium text-text-2 hover:text-text-1 transition-colors cursor-pointer"
    @click="toggleLocale"
  >
    {{ t('lang.switch') }}
  </button>
</template>
