<script setup lang="ts">
// Quiz card — renders one question and its answer input.
//
// One branch per `QuestionType`:
//   multiple_choice  → A/B/C/D badge buttons → single option string
//   multi_select     → checkable badges → string[] (via toggleMultiSelect)
//   true_false       → two large buttons → boolean
//   fill_in_blank    → <input> → string
//   error_correction → <textarea> → string

import { computed } from 'vue';
import { quizStrings } from './strings';
import { toggleMultiSelect } from './utils';
import type { QuizAnswer, QuizQuestion } from './types';

const props = defineProps<{
  question: QuizQuestion;
  modelValue: QuizAnswer;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: QuizAnswer];
}>();

/** Human-readable label for the current question type. */
const typeLabel = computed(() => {
  switch (props.question.type) {
    case 'multiple_choice':
      return quizStrings.typeMultipleChoice;
    case 'multi_select':
      return quizStrings.typeMultiSelect;
    case 'true_false':
      return quizStrings.typeTrueFalse;
    case 'fill_in_blank':
      return quizStrings.typeFillBlank;
    case 'error_correction':
      return quizStrings.typeErrorCorrection;
    default:
      return '';
  }
});

/* ---- multiple choice / multi select helpers ---- */

const options = computed(() => props.question.options ?? []);

const optionKeys = computed(() => options.value.map((_, i) => String.fromCharCode(65 + i)));

function selectOption(option: string) {
  emit('update:modelValue', option);
}

function isOptionSelected(option: string): boolean {
  return Array.isArray(props.modelValue) && props.modelValue.includes(option);
}

function toggleOption(option: string) {
  emit('update:modelValue', toggleMultiSelect(props.modelValue, option));
}

/* ---- true / false helpers ---- */

function selectBool(value: boolean) {
  emit('update:modelValue', value);
}

/* ---- text input helpers ---- */

function onTextInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="w-full">
    <!-- Type label -->
    <p class="mb-3 text-xs font-medium uppercase tracking-wide text-(--color-accent)">
      {{ typeLabel }}
    </p>

    <!-- Question prompt -->
    <p
      class="mb-8 whitespace-pre-wrap wrap-break-word text-lg font-medium leading-relaxed text-(--color-ink)"
    >
      {{ question.prompt }}
    </p>

    <!-- ── Multiple choice ─────────────────────────────── -->
    <div v-if="question.type === 'multiple_choice'" class="space-y-2.5">
      <button
        v-for="(option, i) in options"
        :key="i"
        class="flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all"
        :class="
          modelValue === option
            ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-ink)'
            : 'border-(--color-rule) text-(--color-pencil) hover:border-brand-3 hover:bg-(--color-surface)'
        "
        @click="selectOption(option)"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors"
          :class="
            modelValue === option
              ? 'border-(--color-accent) bg-(--color-accent) text-white'
              : 'border-border text-text-3'
          "
        >
          {{ optionKeys[i] ?? i + 1 }}
        </span>
        <span class="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">{{
          option
        }}</span>
      </button>
    </div>

    <!-- ── Multi select ────────────────────────────────── -->
    <div v-else-if="question.type === 'multi_select'" class="space-y-2.5">
      <button
        v-for="(option, i) in options"
        :key="i"
        class="flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all"
        :class="
          isOptionSelected(option)
            ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-ink)'
            : 'border-(--color-rule) text-(--color-pencil) hover:border-brand-3 hover:bg-(--color-surface)'
        "
        @click="toggleOption(option)"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-semibold transition-colors"
          :class="
            isOptionSelected(option)
              ? 'border-(--color-accent) bg-(--color-accent) text-white'
              : 'border-border text-text-3'
          "
        >
          <svg
            v-if="isOptionSelected(option)"
            class="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 8l3.5 3.5L13 4.5" />
          </svg>
          <template v-else>{{ optionKeys[i] ?? i + 1 }}</template>
        </span>
        <span class="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">{{
          option
        }}</span>
      </button>
    </div>

    <!-- ── True / False ────────────────────────────────── -->
    <div v-else-if="question.type === 'true_false'" class="flex gap-4">
      <button
        class="flex-1 cursor-pointer rounded-lg border-2 px-6 py-5 text-base font-medium transition-all"
        :class="
          modelValue === true
            ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-accent)'
            : 'border-(--color-rule) text-(--color-pencil) hover:border-brand-3 hover:text-(--color-ink)'
        "
        @click="selectBool(true)"
      >
        {{ quizStrings.true }}
      </button>
      <button
        class="flex-1 cursor-pointer rounded-lg border-2 px-6 py-5 text-base font-medium transition-all"
        :class="
          modelValue === false
            ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-accent)'
            : 'border-(--color-rule) text-(--color-pencil) hover:border-brand-3 hover:text-(--color-ink)'
        "
        @click="selectBool(false)"
      >
        {{ quizStrings.false }}
      </button>
    </div>

    <!-- ── Fill in the blank ───────────────────────────── -->
    <input
      v-else-if="question.type === 'fill_in_blank'"
      :value="modelValue as string"
      type="text"
      class="w-full rounded-lg border border-(--color-rule) bg-(--color-surface) px-4 py-3 text-sm text-(--color-ink) outline-none transition-colors placeholder:text-text-3 focus:border-(--color-accent)"
      :placeholder="quizStrings.typeAnswer"
      @input="onTextInput"
    />

    <!-- ── Error correction ────────────────────────────── -->
    <textarea
      v-else-if="question.type === 'error_correction'"
      :value="modelValue as string"
      rows="5"
      class="w-full resize-y rounded-lg border border-(--color-rule) bg-(--color-surface) px-4 py-3 text-sm text-(--color-ink) outline-none transition-colors placeholder:text-text-3 focus:border-(--color-accent)"
      :placeholder="quizStrings.fixError"
      @input="onTextInput"
    />
  </div>
</template>
