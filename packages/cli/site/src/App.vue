<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSidebar from './components/sidebar/AppSidebar.vue';
import LoadingOverlay from './components/LoadingOverlay.vue';
import SearchModal from './components/SearchModal.vue';
import QuizModal from './components/quiz/QuizModal.vue';
import type { SearchEntry } from './composables/useSearch';
import { listenForChanges } from './composables/useTopicData';
import { headingSlug } from './utils/markdown';
import { useFileNavigation } from './composables/useFileNavigation';
import { useQuizLauncher } from './composables/useQuizLauncher';
import { useDarkMode } from './composables/useDarkMode';

const route = useRoute();
const router = useRouter();

useDarkMode();

const {
  selectedFilePath,
  currentTopicSlug,
  initialTab,
  contentLoading,
  selectFile,
  inferTabFromPath,
  resetLoader,
  onFileSelected,
  onTopicSelected,
  onBackToDashboard,
  refreshCurrentFile,
} = useFileNavigation();

const sidebarContext = computed<'dashboard' | 'topic'>(() => {
  return route.name === 'topic' ? 'topic' : 'dashboard';
});

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

const { quizOpen, quizDeck, quizQueue, quizSessionKey, onQuizSelected, onQuizBatchSelected } =
  useQuizLauncher(currentTopicSlug);

/* ------------------------------------------------------------------ */
/*  SSE reload                                                          */
/* ------------------------------------------------------------------ */

let stopReloadListener: (() => void) | null = null;

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
  stopReloadListener = listenForChanges(async () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    await refreshCurrentFile();
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
