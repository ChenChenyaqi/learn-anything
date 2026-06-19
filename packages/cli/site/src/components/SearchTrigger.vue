<script setup lang="ts">
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

defineEmits<{ open: [] }>();
</script>

<template>
  <button
    class="flex w-full items-center gap-2 rounded-lg border border-(--color-divider) bg-(--color-bg-soft) px-3 py-1.5 text-sm text-text-3 transition-colors hover:border-border hover:text-text-2 cursor-pointer"
    :aria-label="t('search.open')"
    @click="$emit('open')"
  >
    <svg
      class="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
    <span class="flex-1 text-left">{{ t('search.placeholder') }}</span>
    <kbd
      class="shrink-0 rounded border border-(--color-divider) bg-(--color-bg) px-1.5 py-0.5 font-mono text-xs text-text-3"
    >
      {{ isMac ? t('search.shortcutMac') : t('search.shortcutNonMac') }}
    </kbd>
  </button>
</template>
