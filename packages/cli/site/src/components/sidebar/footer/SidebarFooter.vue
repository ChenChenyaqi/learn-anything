<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import LanguageSwitch from './LanguageSwitch.vue';

const { t, isDark, toggleDarkMode } = useI18n();
</script>

<template>
  <div class="px-6 py-3 border-t border-(--color-divider) flex items-center justify-between">
    <LanguageSwitch />
    <button
      class="p-1.5 rounded-md text-text-2 hover:bg-(--color-bg-soft) hover:text-text-1 transition-colors cursor-pointer"
      :title="t('theme.switch')"
      @click="toggleDarkMode"
    >
      <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  </div>
</template>
