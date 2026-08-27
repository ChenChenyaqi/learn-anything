import { computed, readonly, ref } from 'vue';
import type { QueueItem } from '@/components/workspace/quiz/types';

/**
 * `TopicPanel` is the discriminated union for the workspace editor pane.
 * Single quiz sessions open a panel with `fileId`; batch (sequential/random)
 * sessions open one with `mode` + `items`.
 */
export type TopicPanel =
  | { kind: 'map' }
  | { kind: 'note'; fileId: string }
  | { kind: 'code'; fileId: string }
  | { kind: 'quiz'; fileId?: string; mode?: 'sequential' | 'random'; items?: QueueItem[] };

export type MainRoute = { name: 'overview' } | { name: 'topic'; slug: string; panel: TopicPanel };

const route = ref<MainRoute>({ name: 'overview' });

let singleton: ReturnType<typeof createNav> | null = null;

function createNav() {
  const isOverview = computed(() => route.value.name === 'overview');
  const currentSlug = computed(() => (route.value.name === 'topic' ? route.value.slug : null));
  const currentPanel = computed(() => (route.value.name === 'topic' ? route.value.panel : null));

  function openOverview() {
    route.value = { name: 'overview' };
  }

  function openTopic(slug: string, panel: TopicPanel = { kind: 'map' }) {
    route.value = { name: 'topic', slug, panel };
  }

  function openPanel(panel: TopicPanel) {
    if (route.value.name === 'topic') {
      route.value = { ...route.value, panel };
    }
  }

  return {
    route: readonly(route),
    isOverview,
    currentSlug,
    currentPanel,
    openOverview,
    openTopic,
    openPanel,
  };
}

export function useWorkspaceNav() {
  if (!singleton) {
    singleton = createNav();
  }
  return singleton;
}
