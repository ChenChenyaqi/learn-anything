<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSidebar from './components/AppSidebar.vue';
import LoadingOverlay from './components/LoadingOverlay.vue';
import SearchModal from './components/SearchModal.vue';
import QuizModal from './components/quiz/QuizModal.vue';
import type { SelectedFilePayload } from './composables/useTopicData';
import { listenForChanges, loadFileContent } from './composables/useTopicData';
import { useContentLoader } from './composables/useContentLoader';
import { fetchQuizDeck, type QuizDeck, type QueueItem } from './composables/useQuiz';
import type { SearchEntry } from './composables/useSearch';
import { headingSlug } from './utils/markdown';

const route = useRoute();
const router = useRouter();

const sidebarContext = computed<'dashboard' | 'topic'>(() => {
  return route.name === 'topic' ? 'topic' : 'dashboard';
});

const currentTopicSlug = computed(() => route.params.slug as string | undefined);

/* --- Shared state: sidebar file selection → TopicPage --- */
const topicSelectedFile = ref<SelectedFilePayload | null>(null);
provide('topicSelectedFile', topicSelectedFile);

const selectedFilePath = computed(() => topicSelectedFile.value?.path ?? null);

function inferTabFromPath(filePath: string | undefined): 'topics' | 'exercises' {
  const p = filePath ?? '';
  if (/^\/topics\/[^/]+\/exercises\//.test(p)) return 'exercises';
  if (/^\/topics\/[^/]+\/sessions\//.test(p)) return 'topics';
  return 'topics';
}

const initialTab = computed<'topics' | 'exercises'>(() =>
  inferTabFromPath(route.query.file as string | undefined),
);

/* --- Content loader: delayed loading state (150ms threshold) --- */
const { isLoading: contentLoading, load: loadContent, reset: resetLoader } = useContentLoader();

function selectFile(
  path: string,
  type: 'markdown' | 'code',
  sourceTab: 'topics' | 'exercises' | 'quizzes',
  syncUrl = true,
) {
  // Selection is synchronous → first render already shows the file view,
  // never the knowledge map. Content is filled back in asynchronously.
  topicSelectedFile.value = { path, type, sourceTab };
  if (syncUrl) router.replace({ query: { file: path } });

  loadContent(
    path,
    (content) => {
      if (topicSelectedFile.value?.path === path) {
        topicSelectedFile.value = { ...topicSelectedFile.value, content };

        // Content was just rendered — if the URL has a hash that
        // router scrollBehavior couldn't resolve yet (element didn't
        // exist), scroll to it now.
        if (route.hash) {
          nextTick(() => {
            const el = document.querySelector(route.hash);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          });
        }
      }
    },
    () => {
      if (topicSelectedFile.value?.path === path) {
        topicSelectedFile.value = null;
        router.replace({ query: {} });
      }
    },
  );
}

function restoreFromRoute() {
  resetLoader();
  const slug = route.params.slug as string | undefined;
  const filePath = route.query.file as string | undefined;
  if (slug && filePath) {
    const sourceTab = inferTabFromPath(filePath);
    selectFile(
      filePath,
      filePath.endsWith('.md') ? 'markdown' : 'code',
      sourceTab,
      false, // URL already correct — no need to replace
    );
  } else {
    topicSelectedFile.value = null;
  }
}

function onFileSelected(payload: SelectedFilePayload | null) {
  if (!payload) {
    resetLoader();
    topicSelectedFile.value = null;
    router.replace({ query: {} });
    return;
  }
  selectFile(payload.path, payload.type, payload.sourceTab ?? 'topics');
}

function onTopicSelected(slug: string) {
  resetLoader();
  topicSelectedFile.value = null;
  router.push(`/topics/${slug}`);
}

function onBackToDashboard() {
  resetLoader();
  topicSelectedFile.value = null;
  router.push('/');
}

/* Restore the selected file from the URL on mount and whenever the topic changes.
   `immediate` runs during setup, so the selection is set synchronously and the
   very first render shows the file view instead of flashing the knowledge map. */
watch(
  () => route.params.slug,
  () => restoreFromRoute(),
  { immediate: true },
);

/* ------------------------------------------------------------------ */
/*  Search modal                                                        */
/* ------------------------------------------------------------------ */

const searchOpen = ref(false);

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    if (searchOpen.value) return;

    const el = document.activeElement;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable) {
      return;
    }

    e.preventDefault();
    searchOpen.value = true;
  }
}

function onSearchSelect(entry: SearchEntry) {
  searchOpen.value = false;
  const hash = entry.level > 0 ? `#${headingSlug(entry.title)}` : '';

  if (entry.kind === 'knowledge-map') {
    resetLoader();
    topicSelectedFile.value = null;
    router.push({ path: `/topics/${entry.topicSlug}`, hash });
    return;
  }

  const sourceTab = inferTabFromPath(entry.path);

  if (currentTopicSlug.value === entry.topicSlug) {
    router.replace({ query: { file: entry.path }, hash });
    selectFile(entry.path, 'markdown', sourceTab, false);
  } else {
    router.push({
      path: `/topics/${entry.topicSlug}`,
      query: { file: entry.path },
      hash,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Quiz modal                                                          */
/* ------------------------------------------------------------------ */

const quizOpen = ref(false);
const quizDeck = ref<QuizDeck | null>(null);
const quizQueue = ref<{ items: QueueItem[]; mode: 'sequential' | 'random' } | null>(null);
const quizSessionKey = ref(0);

async function onQuizSelected(quiz: { path: string }) {
  if (!currentTopicSlug.value) return;
  try {
    quizQueue.value = null;
    quizDeck.value = await fetchQuizDeck(currentTopicSlug.value, quiz.path);
    quizSessionKey.value++;
    quizOpen.value = true;
  } catch (e) {
    console.error('Failed to load quiz:', e);
  }
}

function onQuizBatchSelected(batch: { items: QueueItem[]; mode: 'sequential' | 'random' }) {
  if (!currentTopicSlug.value) return;
  quizDeck.value = null;
  quizQueue.value = batch;
  quizSessionKey.value++;
  quizOpen.value = true;
}

/* --- Dark mode --- */
function applyDarkMode() {
  const stored = localStorage.getItem('learn-anything-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored === 'dark' || (!stored && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
}

let stopReloadListener: (() => void) | null = null;

onMounted(() => {
  applyDarkMode();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDarkMode);
  window.addEventListener('keydown', onGlobalKeydown);
  stopReloadListener = listenForChanges(async () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;

    if (topicSelectedFile.value) {
      const path = topicSelectedFile.value.path;
      // Silent refresh: SSE reload is a background update, so it bypasses the
      // loading overlay and just re-reads the file in place.
      const content = await loadFileContent(path);
      if (topicSelectedFile.value?.path === path && content !== null) {
        topicSelectedFile.value = { ...topicSelectedFile.value, content };
      }
    }

    await nextTick();
    document.documentElement.style.scrollBehavior = 'auto';
    document.documentElement.scrollTop = scrollTop;
    document.documentElement.style.scrollBehavior = '';
  });
});

onUnmounted(() => {
  stopReloadListener?.();
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
  <div class="flex min-h-screen bg-(--color-page) text-(--color-ink)">
    <AppSidebar
      :context="sidebarContext"
      :topic-slug="currentTopicSlug"
      :initial-tab="initialTab"
      :selected-file-path="selectedFilePath"
      @file-selected="onFileSelected"
      @topic-selected="onTopicSelected"
      @back-to-dashboard="onBackToDashboard"
      @search-open="searchOpen = true"
      @quiz-selected="onQuizSelected"
      @quiz-batch-selected="onQuizBatchSelected"
    />

    <main class="flex-1 min-w-0 lg:pl-68">
      <div class="px-6 py-10 lg:px-10">
        <router-view />
      </div>
    </main>

    <Transition name="ld-fade">
      <LoadingOverlay v-if="contentLoading" />
    </Transition>

    <SearchModal :open="searchOpen" @close="searchOpen = false" @select="onSearchSelect" />

    <QuizModal
      :key="quizSessionKey"
      :open="quizOpen"
      :quiz-deck="quizDeck"
      :quiz-queue="quizQueue"
      :topic-slug="currentTopicSlug ?? ''"
      @close="quizOpen = false"
    />
  </div>
</template>
