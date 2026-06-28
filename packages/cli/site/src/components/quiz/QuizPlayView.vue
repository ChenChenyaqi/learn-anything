<script setup lang="ts">
import { ref } from 'vue';
import { type useQuizSession } from './useQuizSession';
import QuizDialogShell from './QuizDialogShell.vue';
import QuizHeader from './header/QuizHeader.vue';
import QuizCard from './QuizCard.vue';
import QuizFooter from './QuizFooter.vue';
import QuizResults from './results/QuizResults.vue';

defineProps<{
  session: ReturnType<typeof useQuizSession>;
  progressText: string;
  groupProgressText: string;
  currentGroupLabel: string;
  hasQueue: boolean;
}>();

defineEmits<{
  close: [];
  prev: [];
  next: [];
  submit: [];
  retry: [];
}>();

const shellRef = ref<InstanceType<typeof QuizDialogShell> | null>(null);

defineExpose({
  get dialogEl() {
    return shellRef.value?.dialogEl ?? null;
  },
});
</script>

<template>
  <QuizDialogShell ref="shellRef" layout-class="grid grid-rows-[auto_1fr_auto]">
    <QuizHeader
      v-if="!session.isComplete.value"
      :progress-text="progressText"
      :group-progress-text="groupProgressText"
      :current-group-label="currentGroupLabel"
      @close="$emit('close')"
    />
    <div class="overflow-y-auto min-h-0">
      <div
        v-if="!session.isComplete.value"
        class="px-6 py-8 min-h-75 flex items-center perspective-[1000px]"
      >
        <Transition
          :name="session.direction.value === 'backward' ? 'slide-backward' : 'slide-forward'"
          mode="out-in"
        >
          <div :key="session.currentIndex.value" class="w-full">
            <QuizCard
              :question="session.currentQuestion.value"
              :model-value="session.getAnswer(session.currentQuestion.value.id)"
              @update:model-value="session.setAnswer(session.currentQuestion.value.id, $event)"
            />
          </div>
        </Transition>
      </div>
      <QuizResults
        v-else-if="session.results.value && !hasQueue"
        :results="session.results.value"
        @retry="$emit('retry')"
        @close="$emit('close')"
      />
    </div>
    <QuizFooter
      v-if="!session.isComplete.value"
      :is-first="session.isFirst.value"
      :is-last="session.isLast.value"
      @prev="$emit('prev')"
      @next="$emit('next')"
      @submit="$emit('submit')"
    />
  </QuizDialogShell>
</template>

<style scoped>
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-backward-enter-active,
.slide-backward-leave-active {
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.slide-forward-enter-from {
  transform: translateX(40px) scale(0.97);
  opacity: 0;
}

.slide-forward-leave-to {
  transform: translateX(-40px) scale(0.97) rotateY(5deg);
  opacity: 0;
}

.slide-backward-enter-from {
  transform: translateX(-40px) scale(0.97);
  opacity: 0;
}

.slide-backward-leave-to {
  transform: translateX(40px) scale(0.97) rotateY(-5deg);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .slide-forward-enter-active,
  .slide-forward-leave-active,
  .slide-backward-enter-active,
  .slide-backward-leave-active {
    transition: none;
  }
}
</style>
