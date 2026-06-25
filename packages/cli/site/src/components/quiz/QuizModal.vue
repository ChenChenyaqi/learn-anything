<script setup lang="ts">
import { shallowRef, watch, computed, onBeforeUnmount, reactive, ref, nextTick } from 'vue';
import { useI18n } from '../../composables/useI18n';
import {
  useQuizSession,
  useQuizQueue,
  type QuizDeck,
  type QuizAnswer,
  type QuizAnswers,
  type QuizQuestion,
  type QuizResults as QuizResultsData,
  type QueueItem,
} from '../../composables/useQuiz';
import QuizCard from './QuizCard.vue';
import QuizResults from './QuizResults.vue';
import QuizSummary from './QuizSummary.vue';

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

const queue = shallowRef<ReturnType<typeof useQuizQueue> | null>(null);
const session = shallowRef<{
  currentIndex: number;
  currentQuestion: QuizQuestion;
  isFirst: boolean;
  isLast: boolean;
  isComplete: boolean;
  direction: 'forward' | 'backward';
  total: number;
  answers: QuizAnswers;
  results: QuizResultsData | null;
  setAnswer: (id: string, answer: QuizAnswer) => void;
  getAnswer: (id: string) => QuizAnswer;
  goNext: () => void;
  goPrev: () => void;
  submitAll: () => void;
  reset: () => void;
} | null>(null);

function startSession(deck: QuizDeck) {
  session.value = reactive(useQuizSession(deck)) as typeof session.value;
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.quizQueue) {
      queue.value = useQuizQueue(
        props.topicSlug,
        props.quizQueue.items,
        props.quizQueue.mode,
      ) as typeof queue.value;
      queue.value!.loadCurrent();
    } else if (isOpen && props.quizDeck) {
      session.value = reactive(useQuizSession(props.quizDeck)) as typeof session.value;
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
      startSession(queue.value.currentDeck.value);
    } else if (phase !== 'quiz') {
      session.value = null;
    }
  },
);

/* ---- Focus management ---- */

const dialogEl = ref<HTMLElement | null>(null);
let savedFocus: HTMLElement | null = null;

watch(
  () => props.open,
  async (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      savedFocus = document.activeElement as HTMLElement | null;
      await nextTick();
      // Teleported content may need an extra frame before it can receive focus
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      dialogEl.value?.focus();
    }
    if (!isOpen && wasOpen && savedFocus) {
      nextTick(() => savedFocus?.focus());
    }
  },
);

/* ---- Progress text ---- */

const progressText = computed(() => {
  if (!session.value) return '';
  return t('quiz.questionProgress')
    .replace('{current}', String(session.value.currentIndex + 1))
    .replace('{total}', String(session.value.total));
});

const groupProgressText = computed(() => {
  if (!queue.value || queue.value.totalGroups <= 1) return '';
  return t('quiz.groupProgress')
    .replace('{current}', String(queue.value.currentIndex.value + 1))
    .replace('{total}', String(queue.value.totalGroups));
});

const currentGroupLabel = computed(() => {
  if (!queue.value) return '';
  const ci = queue.value.currentItem.value;
  return ci ? ci.concept_name : '';
});

/* ---- Navigation ---- */

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function onPrev() {
  session.value?.goPrev();
}

function onNext() {
  if (!session.value) return;
  if (!session.value.isLast) {
    session.value.goNext();
  }
}

function onSubmit() {
  const s = session.value;
  if (!s) return;
  s.submitAll();
  nextTick(() => {
    if (!s.results) return;
    if (queue.value) {
      queue.value.onGroupComplete(s.results);
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

/* ---- Help popover ---- */

const showHelp = ref(false);

function onDocClickCloseHelp() {
  showHelp.value = false;
}

watch(showHelp, (on) => {
  if (on) document.addEventListener('click', onDocClickCloseHelp);
  else document.removeEventListener('click', onDocClickCloseHelp);
});

/* ---- Keyboard ---- */

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }

  // Block plain Enter from reaching focused sidebar buttons that
  // would re-trigger the quiz and reset progress to question 1.
  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
    if (!dialogEl.value?.contains(e.target as Node)) {
      e.preventDefault();
    }
    return;
  }

  const tag = (e.target as HTMLElement)?.tagName;
  if (session.value?.isComplete) return;
  if (queue.value && queue.value.phase.value !== 'quiz') return;

  const s = session.value;
  if (s && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    const q = s.currentQuestion;

    if (q.type === 'true_false' && (e.key === '1' || e.key === '2')) {
      e.preventDefault();
      s.setAnswer(q.id, e.key === '1');
      return;
    }

    const opts = q.type === 'multiple_choice' ? q.options : undefined;
    if (opts && opts.length && e.key.length === 1) {
      let idx = -1;
      const letter = e.key.toUpperCase();
      if (letter >= 'A' && letter <= 'Z') idx = letter.charCodeAt(0) - 65;
      if (e.key >= '1' && e.key <= '9') idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < opts.length) {
        e.preventDefault();
        s.setAnswer(q.id, opts[idx]);
        return;
      }
    }
  }

  if (e.key === 'ArrowLeft') {
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    onPrev();
  } else if (e.key === 'ArrowRight') {
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (session.value?.isLast) return;
    e.preventDefault();
    onNext();
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    onSubmit();
  }
}

function close() {
  emit('close');
}

/* ---- Active results (for queue results phase) ---- */

const activeResults = computed<QuizResultsData | null>(() => {
  if (queue.value?.phase.value === 'results') {
    const cr = queue.value.completedResults.value;
    return cr.length > 0 ? cr[cr.length - 1].results : null;
  }
  return null;
});

/* ---- Body scroll lock + global keyboard ---- */

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen) {
      document.addEventListener('keydown', onKeydown);
    } else {
      document.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('click', onDocClickCloseHelp);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center px-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <!-- Dialog (phase: loading / error) -->
      <div
        v-if="queue?.phase.value === 'loading' || queue?.phase.value === 'error'"
        ref="dialogEl"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-(--color-divider) bg-(--color-bg-elv) shadow-2xl outline-none min-h-50 items-center justify-center"
      >
        <button
          class="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-text-3 hover:text-text-1 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
          aria-label="Close"
          @click="close"
        >
          ✕
        </button>
        <template v-if="queue?.phase.value === 'loading'">
          <p class="text-sm text-text-3">…</p>
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
      </div>

      <!-- Dialog (phase: quiz — single-deck or queue) -->
      <div
        v-else-if="session && queue?.phase.value === 'quiz'"
        ref="dialogEl"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-(--color-divider) bg-(--color-bg-elv) shadow-2xl outline-none"
      >
        <!-- Header -->
        <div
          class="flex shrink-0 items-center justify-between border-b border-(--color-divider) px-6 py-3"
        >
          <button
            class="text-xs text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
            @click="close"
          >
            ← {{ t('quiz.backToList') }}
          </button>
          <div class="flex items-center gap-3">
            <span v-if="groupProgressText" class="text-xs text-text-3">
              {{ groupProgressText
              }}<span v-if="currentGroupLabel" class="ml-1 text-text-2"
                >· {{ currentGroupLabel }}</span
              >
            </span>
            <span v-else class="text-xs text-text-3 font-mono">
              {{ progressText }}
            </span>
            <div class="relative">
              <button
                class="flex h-5 w-5 items-center justify-center rounded-full border border-(--color-divider) text-xs text-text-3 hover:text-brand-2 hover:border-brand-3 transition-colors cursor-pointer"
                :aria-label="t('quiz.helpTitle')"
                @click.stop="showHelp = !showHelp"
              >
                ?
              </button>
              <div
                v-if="showHelp"
                class="absolute right-0 top-full mt-2 z-20 w-60 rounded-lg border border-(--color-divider) bg-(--color-bg-elv) shadow-xl p-3 space-y-1.5"
                @click.stop
              >
                <p class="text-xs font-medium text-text-2">{{ t('quiz.helpTitle') }}</p>
                <p class="text-xs text-text-3">{{ t('quiz.hintChoice') }}</p>
                <p class="text-xs text-text-3">{{ t('quiz.hintTrueFalse') }}</p>
                <p class="text-xs text-text-3">{{ t('quiz.hintNav') }}</p>
                <p class="text-xs text-text-3">
                  {{ t('quiz.hintSubmit').replace('{key}', isMac ? '⌘' : 'Ctrl') }}
                </p>
              </div>
            </div>
            <button
              class="flex h-6 w-6 items-center justify-center rounded-full text-text-3 hover:text-text-1 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
              aria-label="Close"
              @click="close"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Quiz card area -->
        <div class="min-h-0 overflow-y-auto">
          <div
            v-if="!session.isComplete"
            class="px-6 py-8 min-h-75 flex items-center perspective-[1000px]"
          >
            <Transition
              :name="session.direction === 'backward' ? 'slide-backward' : 'slide-forward'"
              mode="out-in"
            >
              <div :key="session.currentIndex" class="w-full">
                <QuizCard
                  :question="session.currentQuestion"
                  :model-value="session.getAnswer(session.currentQuestion.id)"
                  @update:model-value="session.setAnswer(session.currentQuestion.id, $event)"
                />
              </div>
            </Transition>
          </div>

          <!-- Footer navigation -->
          <div
            v-if="!session.isComplete"
            class="flex shrink-0 items-center justify-between border-t border-(--color-divider) px-6 py-3"
          >
            <button
              class="flex items-center gap-1.5 px-4 py-2 text-sm text-text-2 hover:text-text-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              :disabled="session.isFirst"
              @click="onPrev"
            >
              <kbd
                class="rounded border border-(--color-divider) px-1.5 py-0.5 font-mono text-xs text-text-3"
                >←</kbd
              >
              {{ t('quiz.previous') }}
            </button>
            <button
              v-if="session.isLast"
              class="flex items-center gap-1.5 px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
              @click="onSubmit"
            >
              {{ t('quiz.submit') }}
              <kbd
                class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
                >{{ isMac ? '⌘' : 'Ctrl' }} ↵</kbd
              >
            </button>
            <button
              v-else
              class="flex items-center gap-1.5 px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
              @click="onNext"
            >
              {{ t('quiz.next') }}
              <kbd
                class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
                >→</kbd
              >
            </button>
          </div>
        </div>
      </div>

      <!-- Dialog (phase: quiz, single-deck mode — no queue) -->
      <div
        v-else-if="session && !queue"
        ref="dialogEl"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-(--color-divider) bg-(--color-bg-elv) shadow-2xl outline-none"
      >
        <div
          v-if="!session.isComplete"
          class="flex shrink-0 items-center justify-between border-b border-(--color-divider) px-6 py-3"
        >
          <button
            class="text-xs text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
            @click="close"
          >
            ← {{ t('quiz.backToList') }}
          </button>
          <div class="flex items-center gap-3">
            <span class="text-xs text-text-3 font-mono">
              {{ progressText }}
            </span>
            <div class="relative">
              <button
                class="flex h-5 w-5 items-center justify-center rounded-full border border-(--color-divider) text-xs text-text-3 hover:text-brand-2 hover:border-brand-3 transition-colors cursor-pointer"
                :aria-label="t('quiz.helpTitle')"
                @click.stop="showHelp = !showHelp"
              >
                ?
              </button>
              <div
                v-if="showHelp"
                class="absolute right-0 top-full mt-2 z-20 w-60 rounded-lg border border-(--color-divider) bg-(--color-bg-elv) shadow-xl p-3 space-y-1.5"
                @click.stop
              >
                <p class="text-xs font-medium text-text-2">{{ t('quiz.helpTitle') }}</p>
                <p class="text-xs text-text-3">{{ t('quiz.hintChoice') }}</p>
                <p class="text-xs text-text-3">{{ t('quiz.hintTrueFalse') }}</p>
                <p class="text-xs text-text-3">{{ t('quiz.hintNav') }}</p>
                <p class="text-xs text-text-3">
                  {{ t('quiz.hintSubmit').replace('{key}', isMac ? '⌘' : 'Ctrl') }}
                </p>
              </div>
            </div>
            <button
              class="flex h-6 w-6 items-center justify-center rounded-full text-text-3 hover:text-text-1 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
              aria-label="Close"
              @click="close"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="min-h-0 overflow-y-auto">
          <div
            v-if="!session.isComplete"
            class="px-6 py-8 min-h-75 flex items-center perspective-[1000px]"
          >
            <Transition
              :name="session.direction === 'backward' ? 'slide-backward' : 'slide-forward'"
              mode="out-in"
            >
              <div :key="session.currentIndex" class="w-full">
                <QuizCard
                  :question="session.currentQuestion"
                  :model-value="session.getAnswer(session.currentQuestion.id)"
                  @update:model-value="session.setAnswer(session.currentQuestion.id, $event)"
                />
              </div>
            </Transition>
          </div>

          <QuizResults
            v-else-if="session.results"
            :results="session.results"
            @retry="onRetry"
            @close="close"
          />

          <div
            v-if="!session.isComplete"
            class="flex shrink-0 items-center justify-between border-t border-(--color-divider) px-6 py-3"
          >
            <button
              class="flex items-center gap-1.5 px-4 py-2 text-sm text-text-2 hover:text-text-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              :disabled="session.isFirst"
              @click="onPrev"
            >
              <kbd
                class="rounded border border-(--color-divider) px-1.5 py-0.5 font-mono text-xs text-text-3"
                >←</kbd
              >
              {{ t('quiz.previous') }}
            </button>
            <button
              v-if="session.isLast"
              class="flex items-center gap-1.5 px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
              @click="onSubmit"
            >
              {{ t('quiz.submit') }}
              <kbd
                class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
                >{{ isMac ? '⌘' : 'Ctrl' }} ↵</kbd
              >
            </button>
            <button
              v-else
              class="flex items-center gap-1.5 px-6 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
              @click="onNext"
            >
              {{ t('quiz.next') }}
              <kbd
                class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
                >→</kbd
              >
            </button>
          </div>
        </div>
      </div>

      <!-- Dialog (phase: results — queue per-group results) -->
      <div
        v-else-if="queue?.phase.value === 'results' && activeResults"
        ref="dialogEl"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-(--color-divider) bg-(--color-bg-elv) shadow-2xl outline-none"
      >
        <button
          class="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-text-3 hover:text-text-1 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
          aria-label="Close"
          @click="close"
        >
          ✕
        </button>
        <QuizResults
          :results="activeResults"
          :queue-context="{
            currentGroup: queue.currentIndex.value,
            totalGroups: queue.totalGroups,
            isLast: queue.isLastGroup.value,
          }"
          @retry="onRetryGroup"
          @next-group="onNextGroup"
          @close="close"
        />
      </div>

      <!-- Dialog (phase: summary) -->
      <div
        v-else-if="queue?.phase.value === 'summary' && queue.summary.value"
        :key="'summary'"
        ref="dialogEl"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-(--color-divider) bg-(--color-bg-elv) shadow-2xl outline-none"
      >
        <button
          class="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-text-3 hover:text-text-1 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
          aria-label="Close"
          @click="close"
        >
          ✕
        </button>
        <QuizSummary :summary="queue.summary.value" @close="close" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ---- Card slide transitions ---- */

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
