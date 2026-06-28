/* Quiz data access: list + deck fetching against /api/quizzes*. */

import { ref, type Ref } from 'vue';
import type { QuizDeck, QuizGroup, QuizListResponse } from './types';

/**
 * Fetch quiz file listings for a topic, grouped by concept.
 * Returns reactive state and auto-fetches on creation.
 */
export function fetchQuizList(topicSlug: string): {
  groups: Ref<QuizGroup[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  reload: () => Promise<void>;
} {
  const groups = ref<QuizGroup[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function reload(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const resp = await fetch(`/api/quizzes?topic=${encodeURIComponent(topicSlug)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: QuizListResponse = await resp.json();
      groups.value = data.groups ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      groups.value = [];
    } finally {
      loading.value = false;
    }
  }

  reload();

  return { groups, loading, error, reload };
}

/**
 * Fetch a single quiz deck JSON file.
 * `filename` can be either:
 *   - A restPath like `closures/quiz-2026-06-24.json`
 *   - A full API path like `/topics/javascript/quizzes/closures/quiz.json`
 */
export async function fetchQuizDeck(topicSlug: string, filename: string): Promise<QuizDeck> {
  const prefix = `/topics/${topicSlug}/quizzes/`;
  const restPath = filename.startsWith(prefix) ? filename.slice(prefix.length) : filename;
  const safeFilename = restPath.split('/').map(encodeURIComponent).join('/');
  const resp = await fetch(`/api/quizzes/${encodeURIComponent(topicSlug)}/${safeFilename}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}
