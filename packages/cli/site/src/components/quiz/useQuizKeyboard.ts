/* ================================================================== */
/*  useQuizKeyboard — pure quiz modal keyboard shortcut resolver       */
/*                                                                     */
/*  Maps a KeyboardEvent + current quiz context to a single high-level */
/*  action (answer / prev / next / submit), or null when the key is    */
/*  irrelevant. Escape, plain Enter, and state guards (isComplete,     */
/*  non-quiz phase) are handled by the caller (onModalKeydown) before  */
/*  this function is reached. The component dispatches the returned    */
/*  action to the right handler.                                       */
/* ================================================================== */

import type { QuizQuestion } from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ResolveQuizKeyCtx {
  /** Current question, or null when no active session. */
  question: QuizQuestion | null;
  /** True on the final question (disables ArrowRight). */
  isLast: boolean;
  /** `event.target.tagName` (upper-cased by the DOM). */
  targetTag: string;
}

export type QuizKeyAction =
  | { type: 'answer'; value: string | boolean }
  | { type: 'prev' }
  | { type: 'next' }
  | { type: 'submit' };

/* ------------------------------------------------------------------ */
/*  Resolver                                                           */
/* ------------------------------------------------------------------ */

/**
 * Resolve a keyboard event into a quiz action.
 *
 * Handles only quiz-phase shortcuts: answer selection, navigation,
 * and ⌘/Ctrl+Enter submit. Escape and plain Enter are handled by the
 * caller (`onModalKeydown`) before this function is reached. The caller
 * is also responsible for guarding against `isComplete` and non-quiz
 * phases — this function assumes those checks have already passed.
 *
 * Every non-null result implies the caller should `preventDefault()`;
 * `null` means "ignore the key entirely" (no preventDefault).
 */
export function resolveQuizKey(e: KeyboardEvent, ctx: ResolveQuizKeyCtx): QuizKeyAction | null {
  const { key, metaKey, ctrlKey } = e;

  const isText = ctx.targetTag === 'INPUT' || ctx.targetTag === 'TEXTAREA';
  const q = ctx.question;

  /* 1 — answer shortcuts (ignored while typing in a text field) */
  if (q && !isText) {
    if (q.type === 'true_false' && (key === '1' || key === '2')) {
      return { type: 'answer', value: key === '1' };
    }

    if (q.type === 'multiple_choice') {
      const opts = q.options ?? [];
      if (opts.length > 0 && key.length === 1) {
        let idx = -1;
        const letter = key.toUpperCase();
        if (letter >= 'A' && letter <= 'Z') idx = letter.charCodeAt(0) - 65;
        if (key >= '1' && key <= '9') idx = parseInt(key, 10) - 1;
        if (idx >= 0 && idx < opts.length) {
          return { type: 'answer', value: opts[idx]! };
        }
      }
    }
  }

  /* 2 — navigation (ignored while typing) */
  if (key === 'ArrowLeft') {
    return isText ? null : { type: 'prev' };
  }
  if (key === 'ArrowRight') {
    if (isText) return null;
    if (ctx.isLast) return null;
    return { type: 'next' };
  }

  /* 3 — submit */
  if (key === 'Enter' && (metaKey || ctrlKey)) {
    return { type: 'submit' };
  }

  return null;
}
