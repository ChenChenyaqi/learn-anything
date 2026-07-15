import { computed, onMounted, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { type SiteTopicSummary, siteTopicSummaries } from '@/lib/commands';

// Overview landing data: topic summaries + derived overall mastery.
//
// Loads via `site_topic_summaries` and live-reloads whenever the backend's
// filesystem watcher emits `site://reload` (debounced 200 ms in Rust, so a
// burst of writes coalesces into one refetch). The working folder is reactive:
// pass a ref or a getter that reads reactive state (e.g. `() => props.folder`)
// and the view re-fetches when it changes; a plain value is read once and never
// re-tracked.
//
// `overall` aggregates the rows into the header line ("N topics · M concepts ·
// K mastered · overall P%") with mastery weighted by concept count, matching
// the design mockup.
//
// A monotonic `loadSeq` token guards against stale overwrites: if the folder
// changes while a request is in flight, the slower response is discarded so the
// UI never shows rows from the previous folder.
export function useTopicsOverview(workingFolder: MaybeRefOrGetter<string | null | undefined>) {
  const summaries = ref<SiteTopicSummary[]>([]);
  const loading = ref(true);
  const error = ref('');

  let unlisten: UnlistenFn | null = null;
  let disposed = false;
  let loadSeq = 0;

  async function load() {
    const wf = toValue(workingFolder);
    const seq = ++loadSeq;
    if (!wf) {
      summaries.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    error.value = '';
    try {
      const rows = await siteTopicSummaries(wf);
      if (seq !== loadSeq) return; // a newer load superseded this one
      summaries.value = rows;
    } catch (e) {
      if (seq !== loadSeq) return;
      error.value = String(e);
    } finally {
      if (seq === loadSeq) loading.value = false;
    }
  }

  /** Aggregate stats for the overview header + overall mastery bar. */
  const overall = computed(() => {
    const topics = summaries.value.length;
    const totalConcepts = summaries.value.reduce((n, t) => n + t.totalConcepts, 0);
    const mastered = summaries.value.reduce((n, t) => n + t.masteredCount, 0);
    const percentage = totalConcepts > 0 ? Math.round((mastered * 100) / totalConcepts) : 0;
    return { topics, totalConcepts, mastered, percentage };
  });

  onMounted(async () => {
    await load();
    const stop = await listen('site://reload', load);
    // If the component unmounted before `listen` resolved, tear it down now so
    // we don't leak a listener with no one to receive it.
    if (disposed) stop();
    else unlisten = stop;
  });

  // Re-fetch when the working folder changes (e.g. user picked a new one).
  // Watching `() => toValue(...)` tracks whatever reactive source the caller
  // passed (ref or getter); a plain value simply never changes.
  watch(() => toValue(workingFolder), load);

  onUnmounted(() => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  });

  return { summaries, loading, error, overall, reload: load };
}
