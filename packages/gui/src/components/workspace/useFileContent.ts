import { onMounted, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { siteFileContent } from '@/lib/commands';

// Single-file content loader for the note/code viewers. Takes an API path
// (e.g. `/topics/rust/sessions/basics/lifetimes.md` — built by the caller from
// the topic slug + the file tree's relative path) plus the working folder.
//
// Mirrors `useTopicData` / `useTopicsOverview`: live-reloads on `site://reload`
// (so an agent edit to the open note is reflected immediately), reactive to
// both the path and the folder, with a monotonic `loadSeq` token that discards
// stale responses when the user switches files mid-flight.
export function useFileContent(
  apiPath: MaybeRefOrGetter<string | null | undefined>,
  workingFolder: MaybeRefOrGetter<string | null | undefined>,
) {
  const content = ref<string | null>(null);
  const loading = ref(true);
  const error = ref('');

  let unlisten: UnlistenFn | null = null;
  let disposed = false;
  let loadSeq = 0;

  async function load() {
    const p = toValue(apiPath);
    const wf = toValue(workingFolder);
    const seq = ++loadSeq;
    if (!p || !wf) {
      content.value = null;
      loading.value = false;
      return;
    }
    loading.value = true;
    error.value = '';
    try {
      const text = await siteFileContent(p, wf);
      if (seq !== loadSeq) return; // a newer load superseded this one
      content.value = text;
    } catch (e) {
      if (seq !== loadSeq) return;
      error.value = String(e);
    } finally {
      if (seq === loadSeq) loading.value = false;
    }
  }

  onMounted(async () => {
    await load();
    const stop = await listen('site://reload', load);
    if (disposed) stop();
    else unlisten = stop;
  });

  watch([() => toValue(apiPath), () => toValue(workingFolder)], load);

  onUnmounted(() => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  });

  return { content, loading, error, reload: load };
}
