<script setup lang="ts">
// "?" shortcut-hints popover for the quiz viewer header. Click to toggle a
// small panel listing the keyboard shortcuts (optional Phase 9 polish).

import { ref } from 'vue';
import { quizStrings, interpolate } from './strings';

const open = ref(false);

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.platform);

const hints: string[] = [
  quizStrings.hintChoice,
  quizStrings.hintMultiSelect,
  quizStrings.hintTrueFalse,
  quizStrings.hintNav,
  interpolate(quizStrings.hintSubmit, { key: isMac ? '⌘' : 'Ctrl' }),
];
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex h-5 w-5 items-center justify-center rounded font-mono text-xs text-(--color-pencil) transition-colors hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
      title="Keyboard shortcuts"
      @click="open = !open"
    >
      ?
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full z-10 mt-1 w-60 rounded-lg border border-(--color-rule) bg-(--color-surface) p-3 shadow-lg"
    >
      <p class="mb-2 text-xs font-semibold text-(--color-ink)">{{ quizStrings.helpTitle }}</p>
      <ul class="space-y-1">
        <li v-for="(h, i) in hints" :key="i" class="text-xs text-(--color-pencil)">{{ h }}</li>
      </ul>
    </div>
  </div>
</template>
