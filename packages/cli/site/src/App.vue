<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSidebar from './components/AppSidebar.vue';
import ContentViewer from './components/ContentViewer.vue';
import type { SelectedFilePayload } from './composables/useTopicData';
import { listenForChanges } from './composables/useTopicData';

const route = useRoute();
const router = useRouter();

const sidebarContext = computed<'dashboard' | 'topic'>(() => {
  return route.name === 'topic' ? 'topic' : 'dashboard';
});

const currentTopicSlug = computed(() => route.params.slug as string | undefined);

/* --- Shared state: sidebar file selection → TopicPage --- */
const topicSelectedFile = ref<SelectedFilePayload | null>(null);
provide('topicSelectedFile', topicSelectedFile);

function onFileSelected(payload: SelectedFilePayload | null) {
  topicSelectedFile.value = payload;
}

function onTopicSelected(slug: string) {
  topicSelectedFile.value = null;
  router.push(`/topics/${slug}`);
}

function onBackToDashboard() {
  router.push('/');
}

// Reset file selection when route changes
watch(
  () => route.fullPath,
  () => {
    topicSelectedFile.value = null;
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
  stopReloadListener = listenForChanges(() => window.location.reload());
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
      @file-selected="onFileSelected"
      @topic-selected="onTopicSelected"
      @back-to-dashboard="onBackToDashboard"
    />

    <main class="flex-1 min-w-0 lg:pl-68">
      <div class="px-6 py-10 lg:px-10">
        <router-view />
      </div>
    </main>
  </div>
</template>
