import { ref } from 'vue';
import { loadFileContent } from './useTopicData';

/* ------------------------------------------------------------------ */
/*  Content loader with delayed loading state                          */
/*                                                                     */
/*  Shows the loading overlay only when a fetch takes longer than the  */
/*  DELAY threshold, so cache hits (near-instant) never flash a modal. */
/* ------------------------------------------------------------------ */

const LOADING_DELAY = 150;

export function useContentLoader() {
  const isLoading = ref(false);
  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  /**
   * Load a file's content. Invokes `onLoaded` once the content resolves,
   * or `onMissing` when the file cannot be read. The `isLoading` flag only
   * flips on if the load outlasts the 150ms threshold.
   */
  async function load(
    path: string,
    onLoaded: (content: string) => void,
    onMissing?: () => void,
  ): Promise<void> {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    const token = ++seq;
    delayTimer = setTimeout(() => {
      if (token === seq) isLoading.value = true;
    }, LOADING_DELAY);

    const content = await loadFileContent(path);

    // Superseded by a newer load call — ignore the stale result.
    if (token !== seq) return;
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    isLoading.value = false;

    if (content !== null) onLoaded(content);
    else onMissing?.();
  }

  /** Cancel any pending load and hide the overlay immediately. */
  function reset(): void {
    seq++;
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    isLoading.value = false;
  }

  return { isLoading, load, reset };
}
