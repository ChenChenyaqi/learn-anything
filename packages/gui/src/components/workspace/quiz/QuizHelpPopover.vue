<script setup lang="ts">
// "?" shortcut-hints popover for the quiz viewer header. Click to toggle a
// small panel listing the keyboard shortcuts (optional Phase 9 polish).

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const open = ref(false);

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.platform);

// Computed so the hints (and the ⌘/Ctrl interpolation) re-resolve if the
// UI language is switched while the popover data is alive.
const hints = computed(() => [
  t('quiz.hintChoice'),
  t('quiz.hintMultiSelect'),
  t('quiz.hintTrueFalse'),
  t('quiz.hintNav'),
  t('quiz.hintSubmit', { key: isMac ? '⌘' : 'Ctrl' }),
]);
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex h-5 w-5 items-center justify-center rounded font-mono text-xs text-(--color-pencil) transition-colors hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
      :title="t('quiz.helpShortcuts')"
      @click="open = !open"
    >
      ?
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full z-10 mt-1 w-60 rounded-lg border border-(--color-rule) bg-(--color-surface) p-3 shadow-lg"
    >
      <p class="mb-2 text-xs font-semibold text-(--color-ink)">{{ t('quiz.helpTitle') }}</p>
      <ul class="space-y-1">
        <li v-for="(h, i) in hints" :key="i" class="text-xs text-(--color-pencil)">{{ h }}</li>
      </ul>
    </div>
  </div>
</template>
