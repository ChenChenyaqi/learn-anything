<script setup lang="ts">
import { shallowRef, watch, computed, ref, nextTick } from 'vue';
import { useQuizSession } from './useQuizSession';
import { useQuizQueue } from './useQuizQueue';
import type { QuizDeck, QuizResults as QuizResultsData, QueueItem } from './types';
import { useModalA11y } from '@/composables/useModalA11y';
import { resolveQuizKey } from './useQuizKeyboard';
import { useQuizProgress, type ProgressSession, type ProgressQueue } from './useQuizProgress';
import QuizResults from './results/QuizResults.vue';
import QuizSummary from './QuizSummary.vue';
import QuizDialogShell from './QuizDialogShell.vue';
import QuizLoadingView from './QuizLoadingView.vue';
import QuizPlayView from './QuizPlayView.vue';

const props = defineProps<{
  open: boolean;
  quizDeck: QuizDeck | null;
  quizQueue: { items: QueueItem[]; mode: 'sequential' | 'random' } | null;
  topicSlug: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

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

/* Single ref shared across the mutually-exclusive dialog views. Each view's
   root (QuizDialogShell or the *View wrappers) exposes `dialogEl`, so this
   always points at the one currently-mounted dialog. */
const viewRef = ref<{ dialogEl: HTMLElement | null } | null>(null);

/* ---- Modal a11y ---- */

const isOpen = computed(() => props.open);

function onModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  const isText =
    (e.target as HTMLElement)?.tagName === 'INPUT' ||
    (e.target as HTMLElement)?.tagName === 'TEXTAREA';
  // prevent space keydown, it can refresh quiz cards
  if (e.code === 'Space' && !isText) {
    e.preventDefault();
    return;
  }

  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
    const anyDialog = viewRef.value?.dialogEl ?? null;
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
  viewRef.value?.dialogEl?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center px-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <!-- Loading / error -->
      <QuizLoadingView
        v-if="queue?.phase.value === 'loading' || queue?.phase.value === 'error'"
        ref="viewRef"
        :phase="queue?.phase.value === 'error' ? 'error' : 'loading'"
        @close="close"
        @retry="queue?.loadCurrent()"
      />

      <!-- Quiz (queue or single-deck) -->
      <QuizPlayView
        v-else-if="session"
        ref="viewRef"
        :session="session"
        :progress-text="progressText"
        :group-progress-text="groupProgressText"
        :current-group-label="currentGroupLabel"
        :has-queue="!!queue"
        @close="close"
        @prev="onPrev"
        @next="onNext"
        @submit="onSubmit"
        @retry="onRetry"
      />

      <!-- Queue per-group results -->
      <QuizDialogShell
        v-else-if="queue?.phase.value === 'results' && activeResults"
        ref="viewRef"
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
        ref="viewRef"
        layout-class="grid grid-rows-[minmax(0,1fr)]"
        closeable
        @close="close"
      >
        <QuizSummary :summary="queue.summary.value" @close="close" />
      </QuizDialogShell>
    </div>
  </Teleport>
</template>
