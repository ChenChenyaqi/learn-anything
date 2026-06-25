<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { QuizQuestion } from '../../composables/useQuiz';

const props = defineProps<{
  question: QuizQuestion;
  modelValue: string | boolean | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | boolean | null];
}>();

const { t } = useI18n();

const typeLabel = computed(() => {
  switch (props.question.type) {
    case 'multiple_choice':
      return t('quiz.typeMultipleChoice');
    case 'true_false':
      return t('quiz.typeTrueFalse');
    case 'fill_in_blank':
      return t('quiz.typeFillBlank');
    case 'error_correction':
      return t('quiz.typeErrorCorrection');
    default:
      return '';
  }
});

/* ---- multiple choice helpers ---- */

const options = computed(() => props.question.options ?? []);

const optionKeys = computed(() => options.value.map((_, i) => String.fromCharCode(65 + i)));

function selectOption(option: string) {
  emit('update:modelValue', option);
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
    <p class="mb-3 text-xs font-medium uppercase tracking-wide text-brand-2">
      {{ typeLabel }}
    </p>

    <!-- Question prompt -->
    <p class="mb-8 text-lg leading-relaxed font-medium text-text-1">
      {{ question.prompt }}
    </p>

    <!-- ── Multiple choice ─────────────────────────────── -->
    <div v-if="question.type === 'multiple_choice'" class="space-y-2.5">
      <button
        v-for="(option, i) in options"
        :key="i"
        class="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all cursor-pointer"
        :class="
          modelValue === option
            ? 'border-brand-2 bg-brand-soft text-text-1'
            : 'border-(--color-divider) text-text-2 hover:border-brand-3 hover:bg-(--color-bg-soft)'
        "
        @click="selectOption(option)"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors"
          :class="
            modelValue === option
              ? 'border-brand-2 bg-brand-2 text-white'
              : 'border-border text-text-3'
          "
        >
          {{ optionKeys[i] ?? i + 1 }}
        </span>
        <span class="text-sm leading-relaxed">{{ option }}</span>
      </button>
    </div>

    <!-- ── True / False ────────────────────────────────── -->
    <div v-else-if="question.type === 'true_false'" class="flex gap-4">
      <button
        class="flex-1 rounded-lg border-2 px-6 py-5 text-base font-medium transition-all cursor-pointer"
        :class="
          modelValue === true
            ? 'border-brand-2 bg-brand-soft text-brand-2'
            : 'border-(--color-divider) text-text-2 hover:border-brand-3 hover:text-text-1'
        "
        @click="selectBool(true)"
      >
        {{ t('quiz.true') }}
      </button>
      <button
        class="flex-1 rounded-lg border-2 px-6 py-5 text-base font-medium transition-all cursor-pointer"
        :class="
          modelValue === false
            ? 'border-brand-2 bg-brand-soft text-brand-2'
            : 'border-(--color-divider) text-text-2 hover:border-brand-3 hover:text-text-1'
        "
        @click="selectBool(false)"
      >
        {{ t('quiz.false') }}
      </button>
    </div>

    <!-- ── Fill in the blank ───────────────────────────── -->
    <input
      v-else-if="question.type === 'fill_in_blank'"
      :value="modelValue as string"
      type="text"
      class="w-full rounded-lg border border-(--color-divider) bg-(--color-bg) px-4 py-3 text-sm text-text-1 transition-colors outline-none focus:border-brand-2 placeholder-text-3"
      :placeholder="t('quiz.typeAnswer')"
      @input="onTextInput"
    />

    <!-- ── Error correction ────────────────────────────── -->
    <textarea
      v-else-if="question.type === 'error_correction'"
      :value="modelValue as string"
      rows="5"
      class="w-full resize-y rounded-lg border border-(--color-divider) bg-(--color-bg) px-4 py-3 text-sm text-text-1 transition-colors outline-none focus:border-brand-2 placeholder-text-3"
      :placeholder="t('quiz.fixError')"
      @input="onTextInput"
    />
  </div>
</template>
