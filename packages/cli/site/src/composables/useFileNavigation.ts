import { computed, nextTick, ref, watch, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { SelectedFilePayload } from './useTopicData';
import { loadFileContent } from './useTopicData';
import { useContentLoader } from './useContentLoader';
import { OmitQuizSourceType } from './topicDataTypes';

export function useFileNavigation() {
  const route = useRoute();
  const router = useRouter();

  const topicSelectedFile = ref<SelectedFilePayload | null>(null);
  provide('topicSelectedFile', topicSelectedFile);

  const selectedFilePath = computed(() => topicSelectedFile.value?.path ?? null);

  const currentTopicSlug = computed(() => route.params.slug as string | undefined);

  function inferTabFromPath(filePath: string | undefined): OmitQuizSourceType {
    const p = filePath ?? '';
    if (/^\/topics\/[^/]+\/exercises\//.test(p)) return 'exercises';
    if (/^\/topics\/[^/]+\/sessions\//.test(p)) return 'topics';
    return 'topics';
  }

  const initialTab = computed<OmitQuizSourceType>(() =>
    inferTabFromPath(route.query.file as string | undefined),
  );

  const { isLoading: contentLoading, load: loadContent, reset: resetLoader } = useContentLoader();

  function selectFile(
    path: string,
    type: SelectedFilePayload['type'],
    sourceTab: NonNullable<SelectedFilePayload['sourceTab']>,
    syncUrl = true,
  ) {
    // Selection is synchronous → first render already shows the file view,
    // never the knowledge map. Content is filled back in asynchronously.
    topicSelectedFile.value = {
      path,
      type,
      sourceTab,
    };
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
      selectFile(filePath, filePath.endsWith('.md') ? 'markdown' : 'code', sourceTab, false);
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

  /** Silent refresh of the currently selected file (used by SSE reload). */
  async function refreshCurrentFile() {
    if (!topicSelectedFile.value) return;
    const path = topicSelectedFile.value.path;
    const content = await loadFileContent(path);
    if (topicSelectedFile.value?.path === path && content !== null) {
      topicSelectedFile.value = { ...topicSelectedFile.value, content };
    }
  }

  return {
    topicSelectedFile,
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
  };
}
