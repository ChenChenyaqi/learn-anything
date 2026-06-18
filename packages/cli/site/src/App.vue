<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSidebar from './components/AppSidebar.vue';
import type { SelectedFilePayload } from './composables/useTopicData';
import { listenForChanges, loadFileContent } from './composables/useTopicData';

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

function onFileSelected(payload: SelectedFilePayload | null) {
  topicSelectedFile.value = payload;
  if (payload) {
    const tab = payload.sourceTab ?? 'topics';
    router.replace({ query: { file: payload.path, tab } });
  } else {
    router.replace({ query: {} });
  }
}

function onTopicSelected(slug: string) {
  topicSelectedFile.value = null;
  router.push(`/topics/${slug}`);
}

function onBackToDashboard() {
  router.push('/');
}

function onTabChanged(tab: 'topics' | 'exercises') {
  if (topicSelectedFile.value) {
    router.replace({ query: { file: topicSelectedFile.value.path, tab } });
  }
}

watch(
  () => route.params.slug,
  async (newSlug) => {
    topicSelectedFile.value = null;
    if (newSlug && typeof newSlug === 'string') {
      const filePath = route.query.file as string | undefined;
      if (filePath) {
        const content = await loadFileContent(filePath);
        if (content) {
          topicSelectedFile.value = {
            path: filePath,
            content,
            type: filePath.endsWith('.md') ? 'markdown' : 'code',
            sourceTab: (route.query.tab as 'topics' | 'exercises' | undefined) || 'topics',
          };
        }
      }
    }
  },
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
      const content = await loadFileContent(topicSelectedFile.value.path);
      if (content !== null) {
        topicSelectedFile.value = { ...topicSelectedFile.value, content };
      } else {
        topicSelectedFile.value = null;
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
  </div>
</template>
