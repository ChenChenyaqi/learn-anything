<script setup lang="ts">
// Quiz workspace viewer — single-deck + batch/queue modes.
//
// Routed to when `currentPanel.kind === 'quiz'`. A `fileId` opens a single
// deck; `mode` + `items` open a queue (sequential or random). State machine:
//   loading → play (QuizCard) → results (QuizResults) → [queue] summary
// Keyboard shortcuts (resolveQuizKey) are bound on the always-present root;
// Escape returns to the knowledge map.

import { ref, shallowRef, computed, watch, nextTick } from 'vue';
import { useWorkspaceNav, type TopicPanel } from '@/composables/useWorkspaceNav';
import { siteQuizDeck } from '@/lib/commands/site';
import { useQuizSession } from './useQuizSession';
import { useQuizQueue } from './useQuizQueue';
import { useQuizProgress, type ProgressSession, type ProgressQueue } from './useQuizProgress';
import { resolveQuizKey } from './useQuizKeyboard';
import { toggleMultiSelect } from './utils';
import { useI18n } from 'vue-i18n';
import { btnPrimary } from '@/lib/ui';
import type { QuizDeck, QuizResults as QuizResultsData } from './types';
import QuizCard from './QuizCard.vue';
import QuizFooter from './QuizFooter.vue';
import QuizResultsView from './QuizResults.vue';
import QuizSummaryView from './QuizSummary.vue';
import QuizHelpPopover from './QuizHelpPopover.vue';

const props = defineProps<{
  panel: Extract<TopicPanel, { kind: 'quiz' }>;
  slug: string | null;
  workingFolder: string | null;
}>();

const { t } = useI18n();

const { openPanel } = useWorkspaceNav();

const queue = shallowRef<ReturnType<typeof useQuizQueue> | null>(null);
const session = shallowRef<ReturnType<typeof useQuizSession> | null>(null);
const rootEl = ref<HTMLElement | null>(null);

// single-mode fetch state. `loadFailed` is a flag, not a message: the error
// copy is resolved at render time (`t('quiz.loadError')`) so it follows the
// UI language even if the locale is switched while the error is on screen.
const singleLoading = ref(false);
const loadFailed = ref(false);

async function loadSingleDeck() {
  singleLoading.value = true;
  loadFailed.value = false;
  session.value = null;
  if (!props.slug || !props.panel.fileId) {
    singleLoading.value = false;
    return;
  }
  try {
    const rest = props.panel.fileId.replace(/^quizzes\//, '');
    const raw = await siteQuizDeck(props.slug, rest, props.workingFolder);
    if (!raw) loadFailed.value = true;
    else session.value = useQuizSession(raw as QuizDeck);
  } catch {
    loadFailed.value = true;
  } finally {
    singleLoading.value = false;
  }
}

// Set up the session/queue whenever the quiz panel changes.
watch(
  () => props.panel,
  (p) => {
    queue.value = null;
    session.value = null;
    loadFailed.value = false;
    singleLoading.value = false;
    if (p.items && p.mode && props.slug) {
      queue.value = useQuizQueue(props.slug, p.items, p.mode, props.workingFolder);
      void queue.value.loadCurrent();
    } else if (p.fileId) {
      void loadSingleDeck();
    }
  },
  { immediate: true },
);

// In queue mode, (re)create the session whenever the queue phase/deck changes.
watch(
  () => queue.value?.phase.value,
  (phase) => {
    const q = queue.value;
    if (!q) return;
    if (phase === 'quiz' && q.currentDeck.value) {
      session.value = useQuizSession(q.currentDeck.value);
    } else if (phase !== 'quiz') {
      session.value = null;
    }
  },
);

// Auto-focus the viewer so keyboard shortcuts work on each (re)open.
watch(
  () => props.panel,
  async () => {
    await nextTick();
    rootEl.value?.focus();
  },
);

/* ---- derived view state ---- */

const isLoading = computed(() => {
  if (queue.value) return queue.value.phase.value === 'loading';
  return singleLoading.value;
});

const isError = computed(() => {
  if (queue.value) return queue.value.phase.value === 'error';
  return loadFailed.value;
});

// Results to show: single mode → live session results; queue mode → last
// completed deck result.
const activeResults = computed<QuizResultsData | null>(() => {
  const s = session.value;
  if (s && s.isComplete.value) return s.results.value;
  const q = queue.value;
  if (q && q.phase.value === 'results') {
    const cr = q.completedResults.value;
    return cr.length > 0 ? cr[cr.length - 1].results : null;
  }
  return null;
});

/* ---- progress text (header) ---- */

const progressSession = computed<ProgressSession | null>(() => {
  const s = session.value;
  if (!s) return null;
  return { currentIndex: s.currentIndex, total: s.total };
});

const progressQueue = computed<ProgressQueue | null>(() => {
  const q = queue.value;
  if (!q) return null;
  return { currentIndex: q.currentIndex, totalGroups: q.totalGroups, currentItem: q.currentItem };
});

const { progressText, groupProgressText, currentGroupLabel } = useQuizProgress(
  progressSession,
  progressQueue,
);

/* ---- actions ---- */

function onNext() {
  const s = session.value;
  if (!s || s.isLast.value) return;
  s.goNext();
}

function onSubmit() {
  const s = session.value;
  if (!s) return;
  s.submitAll();
  if (queue.value) {
    void nextTick(() => {
      const r = s.results.value;
      if (r) queue.value?.onGroupComplete(r);
    });
  }
}

function onRetry() {
  if (queue.value) queue.value.retryGroup();
  else session.value?.reset();
}

async function onNextGroup() {
  await queue.value?.nextGroup();
}

function backToList() {
  openPanel({ kind: 'map' });
}

function retryLoad() {
  if (queue.value) void queue.value.loadCurrent();
  else void loadSingleDeck();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    backToList();
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
    case 'toggle': {
      const qid = s.currentQuestion.value.id;
      s.setAnswer(qid, toggleMultiSelect(s.getAnswer(qid), action.option));
      break;
    }
    case 'prev':
      s.goPrev();
      break;
    case 'next':
      onNext();
      break;
    case 'submit':
      onSubmit();
      break;
  }
}
</script>

<template>
  <div ref="rootEl" tabindex="0" class="h-full outline-none" @keydown="onKeydown">
    <!-- loading -->
    <div
      v-if="isLoading"
      class="grid h-full place-items-center text-sm text-(--color-pencil)"
    >
      …
    </div>

    <!-- error -->
    <div v-else-if="isError" class="grid h-full place-items-center">
      <div
        class="max-w-md rounded-[10px] border border-(--color-accent) bg-(--color-accent-soft) p-4 text-center text-sm"
      >
        <p class="text-(--color-ink)">{{ t('quiz.loadError') }}</p>
        <button
          type="button"
          :class="[btnPrimary, 'mt-3 px-4 py-1.5 text-xs']"
          @click="retryLoad"
        >
          {{ t('quiz.retry') }}
        </button>
      </div>
    </div>

    <!-- summary (queue) -->
    <QuizSummaryView
      v-else-if="queue && queue.phase.value === 'summary' && queue.summary.value"
      :summary="queue.summary.value"
      @close="backToList"
    />

    <!-- results (single-complete or queue results phase) -->
    <QuizResultsView
      v-else-if="activeResults"
      :results="activeResults"
      :queue-context="
        queue
          ? {
              currentGroup: queue.currentIndex.value,
              totalGroups: queue.totalGroups,
              isLast: queue.isLastGroup.value,
            }
          : undefined
      "
      @retry="onRetry"
      @close="backToList"
      @next-group="onNextGroup"
    />

    <!-- play -->
    <div v-else-if="session" class="flex h-full flex-col">
      <!-- header -->
      <div class="flex items-center justify-between border-b border-(--color-rule) px-6 py-3">
        <div class="flex items-baseline gap-3">
          <span class="font-mono text-xs text-(--color-pencil)">{{ progressText }}</span>
          <span v-if="groupProgressText" class="font-mono text-xs text-(--color-pencil)">{{
            groupProgressText
          }}</span>
          <span v-if="currentGroupLabel" class="text-xs text-(--color-ink)">{{
            currentGroupLabel
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <QuizHelpPopover />
          <button
            type="button"
            class="font-mono text-xs text-(--color-pencil) transition-colors hover:text-(--color-ink)"
            @click="backToList"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- card -->
      <div class="flex min-h-0 flex-1 items-center overflow-y-auto">
        <div class="mx-auto w-full max-w-2xl px-6 py-8 perspective-[1000px]">
          <Transition
            :name="session.direction.value === 'backward' ? 'slide-backward' : 'slide-forward'"
            mode="out-in"
          >
            <div :key="session.currentIndex.value">
              <QuizCard
                :question="session.currentQuestion.value"
                :model-value="session.getAnswer(session.currentQuestion.value.id)"
                @update:model-value="session.setAnswer(session.currentQuestion.value.id, $event)"
              />
            </div>
          </Transition>
        </div>
      </div>

      <!-- footer -->
      <QuizFooter
        :is-first="session.isFirst.value"
        :is-last="session.isLast.value"
        @prev="session.goPrev()"
        @next="onNext"
        @submit="onSubmit"
      />
    </div>
  </div>
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
