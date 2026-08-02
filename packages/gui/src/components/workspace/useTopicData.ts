import { computed, onMounted, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { type TopicData, siteTopicData } from '@/lib/commands';

// Per-topic workspace data: the full payload returned by `site_topic_data`
// (`StateV1` + `knowledgeMap` + the three recursive file axes). This is the
// data backbone for the whole WorkspaceView — the knowledge map renders from
// `state.domains`, the sidebar file trees from `files.{sessions,exercises,
// quizzes}` (fed to `buildFileTree`), and note/code bodies (Phase 2) from
// `siteFileContent`.
//
// Behaviour mirrors `useTopicsOverview`:
// - Live-reloads whenever the backend fs watcher emits `site://reload`
//   (debounced 200 ms in Rust, so a burst of writes coalesces into one refetch).
// - The slug AND the working folder are reactive: pass refs or getters and the
//   view re-fetches when either changes; plain values are read once.
// - A monotonic `loadSeq` token discards stale responses: if the slug or folder
//   changes while a request is in flight, the slower response is thrown away so
//   the UI never shows one topic's data under another's header.
//
// `data` resolves `null` when the working folder is unset or the topic dir is
// gone (a valid "not found"), and rejects with a `"code|message"` string on a
// genuine error — surfaced via `error`.
export function useTopicData(
  slug: MaybeRefOrGetter<string | null | undefined>,
  workingFolder: MaybeRefOrGetter<string | null | undefined>,
) {
  const data = ref<TopicData | null>(null);
  const loading = ref(true);
  const error = ref('');

  let unlisten: UnlistenFn | null = null;
  let disposed = false;
  let loadSeq = 0;

  async function load() {
    const s = toValue(slug);
    const wf = toValue(workingFolder);
    const seq = ++loadSeq;
    if (!s || !wf) {
      data.value = null;
      loading.value = false;
      return;
    }
    loading.value = true;
    error.value = '';
    try {
      const payload = await siteTopicData(s, wf);
      if (seq !== loadSeq) return; // a newer load superseded this one
      data.value = payload;
    } catch (e) {
      if (seq !== loadSeq) return;
      error.value = String(e);
    } finally {
      if (seq === loadSeq) loading.value = false;
    }
  }

  /** Concept statistics for the map header line + overall mastery bar. */
  const overall = computed(() => {
    const domains = data.value?.state.domains ?? [];
    const concepts = domains.flatMap((d) => d.concepts);
    const total = concepts.length;
    const mastered = concepts.filter((c) => c.status === 'mastered').length;
    const inProgress = concepts.filter((c) => c.status === 'in_progress').length;
    const needsPractice = concepts.filter((c) => c.status === 'needs_practice').length;
    const unexplored = concepts.filter((c) => c.status === 'unexplored').length;
    const percentage = total > 0 ? Math.round((mastered * 100) / total) : 0;
    return { total, mastered, inProgress, needsPractice, unexplored, percentage };
  });

  onMounted(async () => {
    await load();
    const stop = await listen('site://reload', load);
    // If the component unmounted before `listen` resolved, tear it down now so
    // we don't leak a listener with no one to receive it.
    if (disposed) stop();
    else unlisten = stop;
  });

  // Re-fetch when the slug or working folder changes.
  watch([() => toValue(slug), () => toValue(workingFolder)], load);

  onUnmounted(() => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  });

  return { data, loading, error, overall, reload: load };
}
