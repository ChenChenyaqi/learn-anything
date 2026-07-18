/* Quiz deck fetching against /api/quizzes/:topic/:filename. */

import type { QuizDeck } from './types';

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
