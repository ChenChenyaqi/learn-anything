<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSidebar from './components/AppSidebar.vue';
import LoadingOverlay from './components/LoadingOverlay.vue';
import type { SelectedFilePayload } from './composables/useTopicData';
import { listenForChanges, loadFileContent } from './composables/useTopicData';
import { useContentLoader } from './composables/useContentLoader';

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
const initialTab = computed<'topics' | 'exercises'>(() => {
  const tab = route.query.tab as string | undefined;
  return tab === 'exercises' ? 'exercises' : 'topics';
});

/* --- Content loader: delayed loading state (150ms threshold) --- */
const { isLoading: contentLoading, load: loadContent, reset: resetLoader } = useContentLoader();

function selectFile(
  path: string,
  type: 'markdown' | 'code',
  sourceTab: 'topics' | 'exercises',
  syncUrl = true,
) {
  // Selection is synchronous → first render already shows the file view,
  // never the knowledge map. Content is filled back in asynchronously.
  topicSelectedFile.value = { path, type, sourceTab };
  if (syncUrl) router.replace({ query: { file: path, tab: sourceTab } });

  loadContent(
    path,
    (content) => {
      if (topicSelectedFile.value?.path === path) {
        topicSelectedFile.value = { ...topicSelectedFile.value, content };
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
    selectFile(
      filePath,
      filePath.endsWith('.md') ? 'markdown' : 'code',
      (route.query.tab as 'topics' | 'exercises' | undefined) ?? 'topics',
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

function onTabChanged(tab: 'topics' | 'exercises') {
  if (topicSelectedFile.value) {
    router.replace({ query: { file: topicSelectedFile.value.path, tab } });
  }
}

/* Restore the selected file from the URL on mount and whenever the topic changes.
   `immediate` runs during setup, so the selection is set synchronously and the
   very first render shows the file view instead of flashing the knowledge map. */
watch(
  () => route.params.slug,
  () => restoreFromRoute(),
  { immediate: true },
);

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
      @tab-changed="onTabChanged"
    />

    <main class="flex-1 min-w-0 lg:pl-68">
      <div class="px-6 py-10 lg:px-10">
        <router-view />
      </div>
    </main>

    <Transition name="ld-fade">
      <LoadingOverlay v-if="contentLoading" />
    </Transition>
  </div>
</template>
