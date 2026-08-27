<script setup lang="ts">
// Quiz results: score header + per-question review (status icon, your answer,
// correct/reference answer, explanation), plus a footer that switches between
// single mode (Retry / Back to list) and queue mode (Retry Group / Next Group
// → or View Summary on the last group).

import { useI18n } from 'vue-i18n';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import type { QuizAnswer, QuizResults } from './types';

const { t } = useI18n();

const props = defineProps<{
  results: QuizResults;
  /** Present only in queue mode — drives the queue footer. */
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

function formatAnswer(answer: QuizAnswer): string {
  if (answer === true) return t('quiz.true');
  if (answer === false) return t('quiz.false');
  if (answer === null || answer === '') return '—';
  if (Array.isArray(answer)) return answer.join(', ');
  return String(answer);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Score header -->
    <div class="border-b border-(--color-rule) px-6 py-6 text-center">
      <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-3">
        {{ t('quiz.complete') }}
      </p>
      <p class="text-4xl font-bold text-(--color-accent)">
        {{ results.score }} / {{ results.total }}
      </p>
      <p class="mt-1 text-lg text-(--color-pencil)">{{ results.percentage }}%</p>
    </div>

    <!-- Per-question results -->
    <div class="flex-1 space-y-4 overflow-y-auto px-6 py-4">
      <div
        v-for="result in results.results"
        :key="result.question.id"
        class="rounded-lg border px-4 py-3"
        :class="
          result.correct === null
            ? 'border-(--color-rule)'
            : result.correct
              ? 'quiz-result-correct'
              : 'quiz-result-incorrect'
        "
      >
        <!-- Question header: status icon + prompt -->
        <div class="mb-2 flex items-start gap-2">
          <span class="mt-0.5 shrink-0 text-sm font-bold">
            <span v-if="result.correct === true" class="text-mastered">✓</span>
            <span v-else-if="result.correct === false" class="text-(--color-accent)">✗</span>
            <span v-else class="text-text-3">○</span>
          </span>
          <p
            class="flex-1 whitespace-pre-wrap wrap-break-word text-sm font-medium leading-relaxed text-(--color-ink)"
          >
            {{ result.question.prompt }}
          </p>
        </div>

        <!-- Answers + explanation -->
        <div class="ml-6 space-y-1.5 text-xs">
          <!-- Correct -->
          <div v-if="result.correct === true" class="text-mastered">
            {{ t('quiz.correct') }}
          </div>

          <!-- Incorrect: your answer + correct answer -->
          <template v-else-if="result.correct === false">
            <div class="whitespace-pre-wrap wrap-break-word text-(--color-pencil)">
              <span class="text-text-3">{{ t('quiz.yourAnswer') }}:</span>
              {{ formatAnswer(result.userAnswer) }}
            </div>
            <div class="whitespace-pre-wrap wrap-break-word text-(--color-pencil)">
              <span class="text-text-3">{{ t('quiz.correctAnswer') }}:</span>
              {{ formatAnswer(result.question.answer) }}
            </div>
          </template>

          <!-- ai_only: your answer (if any) + reference -->
          <template v-else>
            <div
              v-if="result.userAnswer !== null && result.userAnswer !== ''"
              class="whitespace-pre-wrap wrap-break-word text-(--color-pencil)"
            >
              <span class="text-text-3">{{ t('quiz.yourAnswer') }}:</span>
              {{ formatAnswer(result.userAnswer) }}
            </div>
            <div class="whitespace-pre-wrap wrap-break-word text-(--color-pencil)">
              <span class="text-text-3">{{ t('quiz.referenceAnswer') }}:</span>
              {{ formatAnswer(result.question.answer) }}
            </div>
            <p class="italic text-text-3">{{ t('quiz.manualEvaluation') }}</p>
          </template>

          <!-- Explanation (all types) -->
          <div
            v-if="result.question.explanation"
            class="whitespace-pre-wrap wrap-break-word pt-1 text-text-3"
          >
            {{ result.question.explanation }}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between border-t border-(--color-rule) px-6 py-3">
      <template v-if="props.queueContext">
        <button type="button" :class="[btnSecondary, 'px-4 py-2 text-sm']" @click="emit('retry')">
          {{ t('quiz.retryGroup') }}
        </button>
        <button
          type="button"
          :class="[btnPrimary, 'px-6 py-2 text-sm font-medium']"
          @click="emit('next-group')"
        >
          {{ props.queueContext.isLast ? t('quiz.viewSummary') : t('quiz.nextGroup') }} →
        </button>
      </template>
      <template v-else>
        <button type="button" :class="[btnSecondary, 'px-4 py-2 text-sm']" @click="emit('close')">
          {{ t('quiz.backToList') }}
        </button>
        <button
          type="button"
          :class="[btnPrimary, 'px-6 py-2 text-sm font-medium']"
          @click="emit('retry')"
        >
          {{ t('quiz.retry') }}
        </button>
      </template>
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
  background-color: var(--color-accent-soft);
}
</style>
