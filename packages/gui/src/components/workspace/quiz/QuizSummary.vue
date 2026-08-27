<script setup lang="ts">
// Quiz queue summary: aggregate score + per-deck progress bars, with a
// "Back to list" footer. Shown when the queue reaches its summary phase.

import { quizStrings } from './strings';
import { btnPrimary } from '@/lib/ui';
import type { QuizSummary as QuizSummaryData } from './types';

defineProps<{
  summary: QuizSummaryData;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Score header -->
    <div class="border-b border-(--color-rule) px-6 py-6 text-center">
      <p class="mb-1 text-xs font-medium uppercase tracking-wide text-(--color-accent)">
        {{ quizStrings.allComplete }}
      </p>
      <p class="text-4xl font-bold text-(--color-ink)">
        {{ summary.totalScore }} / {{ summary.totalQuestions }}
      </p>
      <p class="mt-1 text-lg text-(--color-pencil)">{{ summary.percentage }}%</p>
    </div>

    <!-- Per-group breakdown -->
    <div class="flex-1 space-y-3 overflow-y-auto px-6 py-4">
      <div
        v-for="(dr, i) in summary.deckResults"
        :key="i"
        class="rounded-lg border border-(--color-rule) px-4 py-3"
      >
        <div class="mb-1.5 flex items-center justify-between">
          <p class="mr-3 truncate text-sm font-medium text-(--color-ink)">
            {{ dr.concept_name }}
          </p>
          <p class="shrink-0 font-mono text-xs text-(--color-pencil)">
            {{ dr.results.score }}/{{ dr.results.total }}
          </p>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-(--color-surface)">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="
              dr.results.percentage >= 80
                ? 'bg-mastered'
                : dr.results.percentage >= 50
                  ? 'bg-progress'
                  : 'bg-(--color-accent)'
            "
            :style="{ width: `${dr.results.percentage}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-center border-t border-(--color-rule) px-6 py-3">
      <button
        type="button"
        :class="[btnPrimary, 'px-6 py-2 text-sm font-medium']"
        @click="$emit('close')"
      >
        {{ quizStrings.backToList }}
      </button>
    </div>
  </div>
</template>
