import { watch, type WatchSource } from 'vue';
import { useTreeExpansion } from './useTreeExpansion';

/**
 * Auto-expands the first node when the topic changes and restores any
 * persisted expansion state from sessionStorage.
 *
 * @param treeType      – 'topics' | 'exercises' | 'quizzes'
 * @param getTopicSlug  – returns the current topic slug
 * @param getFirstKey   – returns the first group key to default-expand
 * @param trigger       – optional alternative watch source (e.g. async `groups`
 *                        ref for the quiz tree whose data loads after topicSlug)
 */
export function useAutoExpand(
  treeType: string,
  getTopicSlug: () => string | undefined,
  getFirstKey: () => string | undefined,
  trigger?: WatchSource,
) {
  const { expanded, load, toggle, add } = useTreeExpansion(treeType);

  watch(
    trigger ?? getTopicSlug,
    () => {
      const slug = getTopicSlug();
      if (!slug) {
        expanded.value = new Set();
        return;
      }
      const first = getFirstKey();
      load(slug, first ? [first] : []);
    },
    { immediate: true },
  );

  return { expanded, load, toggle, add };
}
