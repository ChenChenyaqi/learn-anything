<script setup lang="ts">
import { inject, ref, type Ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ViewMode } from '@/composables/useViewMode';

const { t } = useI18n();

const viewMode = inject<Ref<ViewMode>>('viewMode', ref<ViewMode>('map'));
const setViewMode = inject<(m: ViewMode) => void>('setViewMode', () => {});

const options: { value: ViewMode; label: 'topic.view.map' | 'topic.view.progress'; d: string }[] = [
  {
    value: 'map',
    label: 'topic.view.map',
    d: 'M14 3v4a1 1 0 0 0 1 1h4 M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M9 13h6 M9 17h4',
  },
  {
    value: 'progress',
    label: 'topic.view.progress',
    d: 'M4 4v16h16 M9 16v-4 M13 16V8 M17 16v-6',
  },
];
</script>

<template>
  <div
    class="inline-flex items-center gap-0.5 rounded-lg border border-(--color-divider) bg-(--color-bg-soft) p-0.5"
    role="group"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
      :class="
        viewMode === opt.value
          ? 'bg-(--color-bg) text-brand-2 shadow-sm'
          : 'text-text-3 hover:text-text-1'
      "
      :aria-pressed="viewMode === opt.value"
      @click="setViewMode(opt.value)"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="opt.d" />
      </svg>
      {{ t(opt.label) }}
    </button>
  </div>
</template>
