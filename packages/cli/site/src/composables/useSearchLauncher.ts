import { onMounted, onUnmounted, ref } from 'vue';
import type { ComputedRef } from 'vue';
import { useRouter } from 'vue-router';
import type { SearchEntry } from '@/components/search/useSearch';
import { headingSlug } from '@/utils/slug';
import type { SelectedFilePayload, OmitQuizSourceType } from '@/composables/topicDataTypes';

interface SearchLauncherOptions {
  currentTopicSlug: ComputedRef<string | undefined>;
  inferTabFromPath: (filePath: string | undefined) => OmitQuizSourceType;
  selectFile: (
    path: string,
    type: SelectedFilePayload['type'],
    sourceTab: NonNullable<SelectedFilePayload['sourceTab']>,
    syncUrl?: boolean,
  ) => void;
  resetLoader: () => void;
}

/**
 * Owns the ⌘K / Ctrl-K global hotkey and the search-modal open state, plus the
 * router/file-navigation wiring performed when a search result is picked.
 */
export function useSearchLauncher(opts: SearchLauncherOptions) {
  const router = useRouter();
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
      opts.resetLoader();
      router.push({ path: `/topics/${entry.topicSlug}`, hash });
      return;
    }

    const sourceTab = opts.inferTabFromPath(entry.path);

    if (opts.currentTopicSlug.value === entry.topicSlug) {
      router.replace({ query: { file: entry.path }, hash });
      opts.selectFile(entry.path, 'markdown', sourceTab, false);
    } else {
      router.push({
        path: `/topics/${entry.topicSlug}`,
        query: { file: entry.path },
        hash,
      });
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onGlobalKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onGlobalKeydown);
  });

  return { searchOpen, onSearchSelect };
}
