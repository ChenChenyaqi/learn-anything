<script setup lang="ts">
import { useI18n } from '../../composables/useI18n';
import type { QuizSummary as QuizSummaryData } from '../../composables/useQuiz';

defineProps<{
  summary: QuizSummaryData;
}>();

defineEmits<{
  close: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Score header -->
    <div class="border-b border-(--color-divider) px-6 py-6 text-center">
      <p class="mb-1 text-xs font-medium uppercase tracking-wide text-brand-2">
        {{ t('quiz.allComplete') }}
      </p>
      <p class="text-4xl font-bold text-text-1">
        {{ summary.totalScore }} / {{ summary.totalQuestions }}
      </p>
      <p class="mt-1 text-lg text-text-2">{{ summary.percentage }}%</p>
    </div>

    <!-- Per-group breakdown -->
    <div class="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      <div
        v-for="(dr, i) in summary.deckResults"
        :key="i"
        class="rounded-lg border border-(--color-divider) px-4 py-3"
      >
        <div class="flex items-center justify-between mb-1.5">
          <p class="text-sm font-medium text-text-1 truncate mr-3">{{ dr.concept_name }}</p>
          <p class="text-xs font-mono text-text-2 shrink-0">
            {{ dr.results.score }}/{{ dr.results.total }}
          </p>
        </div>
        <div class="h-1.5 w-full rounded-full bg-(--color-bg-soft) overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="
              dr.results.percentage >= 80
                ? 'bg-mastered'
                : dr.results.percentage >= 50
                  ? 'bg-progress'
                  : 'bg-brand-2'
            "
            :style="{ width: `${dr.results.percentage}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-center border-t border-(--color-divider) px-6 py-3">
      <button
        class="px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
        @click="$emit('close')"
      >
        {{ t('quiz.backToList') }}
      </button>
    </div>
  </div>
</template>
