/* Shared pure helpers for quiz answer manipulation (no Vue, no I/O). */

import type { QuizAnswer } from './types';

/**
 * Toggle a single option in/out of a multi-select answer array.
 * Returns `null` when the resulting array is empty (no selection).
 */
export function toggleMultiSelect(current: QuizAnswer, option: string): string[] | null {
  const arr = Array.isArray(current) ? current : [];
  const next = arr.includes(option) ? arr.filter((o) => o !== option) : [...arr, option];
  return next.length > 0 ? next : null;
}
