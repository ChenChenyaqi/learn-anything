<script setup lang="ts">
import { useI18n } from '../../composables/useI18n';
import type { QuizResults, QuizAnswer } from '../../composables/useQuiz';

const props = defineProps<{
  results: QuizResults;
  queueContext?: {
    currentGroup: number;
    totalGroups: number;
    isLast: boolean;
  };
}>();

const emit = defineEmits<{
  retry: [];
  close: [];
  'next-group': [];
}>();

const { t } = useI18n();

function formatAnswer(answer: QuizAnswer): string {
  if (answer === true) return t('quiz.true');
  if (answer === false) return t('quiz.false');
  if (answer === null || answer === '') return '—';
  return String(answer);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Score header -->
    <div class="border-b border-(--color-divider) px-6 py-6 text-center">
      <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-3">
        {{ t('quiz.complete') }}
      </p>
      <p class="text-4xl font-bold text-brand-2">{{ results.score }} / {{ results.total }}</p>
      <p class="mt-1 text-lg text-text-2">{{ results.percentage }}%</p>
    </div>

    <!-- Per-question results -->
    <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      <div
        v-for="result in results.results"
        :key="result.question.id"
        class="rounded-lg border px-4 py-3"
        :class="
          result.correct === null
            ? 'border-(--color-divider)'
            : result.correct
              ? 'quiz-result-correct'
              : 'quiz-result-incorrect bg-brand-soft'
        "
      >
        <!-- Question header: index + status icon -->
        <div class="mb-2 flex items-start gap-2">
          <span class="mt-0.5 shrink-0 text-sm font-bold">
            <span v-if="result.correct === true" class="text-mastered">✓</span>
            <span v-else-if="result.correct === false" class="text-brand-2">✗</span>
            <span v-else class="text-text-3">○</span>
          </span>
          <p class="flex-1 text-sm font-medium leading-relaxed text-text-1">
            {{ result.question.prompt }}
          </p>
        </div>

        <!-- Answers + explanation -->
        <div class="ml-6 space-y-1.5 text-xs">
          <!-- Correct: show user's answer -->
          <div v-if="result.correct === true" class="text-mastered">
            {{ t('quiz.correct') }}
          </div>

          <!-- Incorrect: show user's wrong answer + correct answer -->
          <template v-else-if="result.correct === false">
            <div class="text-text-2">
              <span class="text-text-3">{{ t('quiz.yourAnswer') }}:</span>
              {{ formatAnswer(result.userAnswer) }}
            </div>
            <div class="text-text-2">
              <span class="text-text-3">{{ t('quiz.correctAnswer') }}:</span>
              {{ formatAnswer(result.question.answer) }}
            </div>
          </template>

          <!-- ai_only: show user's answer as reference -->
          <template v-else>
            <div v-if="result.userAnswer !== null && result.userAnswer !== ''" class="text-text-2">
              <span class="text-text-3">{{ t('quiz.yourAnswer') }}:</span>
              {{ formatAnswer(result.userAnswer) }}
            </div>
            <div class="text-text-2">
              <span class="text-text-3">{{ t('quiz.referenceAnswer') }}:</span>
              {{ formatAnswer(result.question.answer) }}
            </div>
            <p class="text-text-3 italic">{{ t('quiz.manualEvaluation') }}</p>
          </template>

          <!-- Explanation (all types) -->
          <div v-if="result.question.explanation" class="pt-1 text-text-3">
            {{ result.question.explanation }}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer (queue: multi-group mode) -->
    <div
      v-if="props.queueContext"
      class="flex items-center justify-between border-t border-(--color-divider) px-6 py-3"
    >
      <button
        class="px-4 py-2 text-sm text-text-2 hover:text-brand-2 transition-colors cursor-pointer"
        @click="emit('retry')"
      >
        {{ t('quiz.retryGroup') }}
      </button>
      <button
        v-if="!props.queueContext.isLast"
        class="px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
        @click="emit('next-group')"
      >
        {{ t('quiz.nextGroup') }} →
      </button>
      <button
        v-else
        class="px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
        @click="emit('next-group')"
      >
        {{ t('quiz.viewSummary') }} →
      </button>
    </div>

    <!-- Footer (single-deck mode) -->
    <div
      v-else
      class="flex items-center justify-between border-t border-(--color-divider) px-6 py-3"
    >
      <button
        class="px-4 py-2 text-sm text-text-2 hover:text-brand-2 transition-colors cursor-pointer"
        @click="emit('close')"
      >
        {{ t('quiz.backToList') }}
      </button>
      <button
        class="px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
        @click="emit('retry')"
      >
        {{ t('quiz.retry') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.quiz-result-correct {
  border-color: rgb(var(--color-mastered-rgb) / 0.3);
  background-color: rgb(var(--color-mastered-rgb) / 0.05);
}

.quiz-result-incorrect {
  border-color: rgb(var(--color-brand-2-rgb) / 0.3);
}
</style>
