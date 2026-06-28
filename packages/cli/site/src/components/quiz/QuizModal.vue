<script setup lang="ts">
import { shallowRef, watch, computed, ref, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import {
  useQuizSession,
  useQuizQueue,
  type QuizDeck,
  type QuizResults as QuizResultsData,
  type QueueItem,
} from './useQuiz';
import { useModalA11y } from '@/composables/useModalA11y';
import { resolveQuizKey } from './useQuizKeyboard';
import {
  useQuizProgress,
  type ProgressSession,
  type ProgressQueue,
} from './useQuizProgress';
import QuizCard from './QuizCard.vue';
import QuizResults from './results/QuizResults.vue';
import QuizSummary from './QuizSummary.vue';
import QuizHeader from './header/QuizHeader.vue';
import QuizFooter from './QuizFooter.vue';
import QuizDialogShell from './QuizDialogShell.vue';

const props = defineProps<{
  open: boolean;
  quizDeck: QuizDeck | null;
  quizQueue: { items: QueueItem[]; mode: 'sequential' | 'random' } | null;
  topicSlug: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

/* ---- Session / queue ---- */

const queue = shallowRef<ReturnType<typeof useQuizQueue> | null>(null);
const session = shallowRef<ReturnType<typeof useQuizSession> | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.quizQueue) {
      queue.value = useQuizQueue(props.topicSlug, props.quizQueue.items, props.quizQueue.mode);
      queue.value.loadCurrent();
    } else if (isOpen && props.quizDeck) {
      session.value = useQuizSession(props.quizDeck);
    } else if (!isOpen) {
      queue.value = null;
      session.value = null;
    }
  },
  { immediate: true },
);

watch(
  () => queue.value?.phase.value,
  (phase) => {
    if (phase === 'quiz' && queue.value?.currentDeck.value) {
      session.value = useQuizSession(queue.value.currentDeck.value);
    } else if (phase !== 'quiz') {
      session.value = null;
    }
  },
);

/* ---- Progress ---- */

const progressSession = computed<ProgressSession | null>(() => {
  const s = session.value;
  if (!s) return null;
  return { currentIndex: s.currentIndex, total: s.total };
});

const progressQueue = computed<ProgressQueue | null>(() => {
  const q = queue.value;
  if (!q) return null;
  return {
    currentIndex: q.currentIndex,
    totalGroups: q.totalGroups,
    currentItem: q.currentItem,
  };
});

const { progressText, groupProgressText, currentGroupLabel } = useQuizProgress(
  progressSession,
  progressQueue,
);

/* ---- Active results (for queue results phase) ---- */

const activeResults = computed<QuizResultsData | null>(() => {
  if (queue.value?.phase.value === 'results') {
    const cr = queue.value.completedResults.value;
    return cr.length > 0 ? cr[cr.length - 1].results : null;
  }
  return null;
});

/* ---- Actions ---- */

function close() {
  emit('close');
}

function onPrev() {
  session.value?.goPrev();
}

function onNext() {
  const s = session.value;
  if (!s || s.isLast.value) return;
  s.goNext();
}

function onSubmit() {
  const s = session.value;
  if (!s) return;
  s.submitAll();
  nextTick(() => {
    const r = s.results.value;
    if (!r) return;
    if (queue.value) {
      queue.value.onGroupComplete(r);
    }
  });
}

function onRetry() {
  session.value?.reset();
}

function onRetryGroup() {
  queue.value?.retryGroup();
}

async function onNextGroup() {
  await queue.value?.nextGroup();
}

/* ---- Template refs ---- */

const loadingShellRef = ref<InstanceType<typeof QuizDialogShell> | null>(null);
const quizShellRef = ref<InstanceType<typeof QuizDialogShell> | null>(null);
const resultsShellRef = ref<InstanceType<typeof QuizDialogShell> | null>(null);
const summaryShellRef = ref<InstanceType<typeof QuizDialogShell> | null>(null);

/* ---- Modal a11y ---- */

const isOpen = computed(() => props.open);

function onModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }

  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
    const anyDialog =
      loadingShellRef.value?.dialogEl ??
      quizShellRef.value?.dialogEl ??
      resultsShellRef.value?.dialogEl ??
      summaryShellRef.value?.dialogEl;
    if (anyDialog && !anyDialog.contains(e.target as Node)) {
      e.preventDefault();
    }
    return;
  }

  const s = session.value;
  if (!s || s.isComplete.value) return;
  if (queue.value && queue.value.phase.value !== 'quiz') return;

  const action = resolveQuizKey(e, {
    question: s.currentQuestion.value,
    isLast: s.isLast.value,
    targetTag: (e.target as HTMLElement)?.tagName ?? '',
  });

  if (!action) return;
  e.preventDefault();

  switch (action.type) {
    case 'answer':
      s.setAnswer(s.currentQuestion.value.id, action.value);
      break;
    case 'prev':
      onPrev();
      break;
    case 'next':
      onNext();
      break;
    case 'submit':
      onSubmit();
      break;
  }
}

useModalA11y(isOpen, { onKeydown: onModalKeydown });

/* ---- Auto-focus dialog on open ---- */

watch(isOpen, async (open) => {
  if (!open) return;
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  (
    loadingShellRef.value?.dialogEl ??
    quizShellRef.value?.dialogEl ??
    resultsShellRef.value?.dialogEl ??
    summaryShellRef.value?.dialogEl
  )?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center px-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <!-- Loading / error -->
      <QuizDialogShell
        v-if="queue?.phase.value === 'loading' || queue?.phase.value === 'error'"
        ref="loadingShellRef"
        layout-class="flex flex-col min-h-50 items-center justify-center"
        closeable
        @close="close"
      >
        <template v-if="queue?.phase.value === 'loading'">
          <p class="text-sm text-text-3">...</p>
        </template>
        <template v-else>
          <p class="text-sm text-text-3 mb-4">{{ t('quiz.loadError') }}</p>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
            @click="queue?.loadCurrent()"
          >
            {{ t('quiz.retry') }}
          </button>
        </template>
      </QuizDialogShell>

      <!-- Quiz (queue or single-deck) -->
      <QuizDialogShell
        v-else-if="session"
        ref="quizShellRef"
        layout-class="grid grid-rows-[auto_1fr_auto]"
      >
        <QuizHeader
          v-if="!session.isComplete.value"
          :progress-text="progressText"
          :group-progress-text="groupProgressText"
          :current-group-label="currentGroupLabel"
          @close="close"
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
            v-else-if="session.results.value && !queue"
            :results="session.results.value"
            @retry="onRetry"
            @close="close"
          />
        </div>
        <QuizFooter
          v-if="!session.isComplete.value"
          :is-first="session.isFirst.value"
          :is-last="session.isLast.value"
          @prev="onPrev"
          @next="onNext"
          @submit="onSubmit"
        />
      </QuizDialogShell>

      <!-- Queue per-group results -->
      <QuizDialogShell
        v-else-if="queue?.phase.value === 'results' && activeResults"
        ref="resultsShellRef"
        layout-class="grid grid-rows-[minmax(0,1fr)]"
        closeable
        @close="close"
      >
        <QuizResults
          :results="activeResults"
          :queue-context="{
            currentGroup: queue!.currentIndex.value,
            totalGroups: queue!.totalGroups,
            isLast: queue!.isLastGroup.value,
          }"
          @retry="onRetryGroup"
          @next-group="onNextGroup"
          @close="close"
        />
      </QuizDialogShell>

      <!-- Queue summary -->
      <QuizDialogShell
        v-else-if="queue?.phase.value === 'summary' && queue.summary.value"
        ref="summaryShellRef"
        layout-class="grid grid-rows-[minmax(0,1fr)]"
        closeable
        @close="close"
      >
        <QuizSummary :summary="queue.summary.value" @close="close" />
      </QuizDialogShell>
    </div>
  </Teleport>
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
