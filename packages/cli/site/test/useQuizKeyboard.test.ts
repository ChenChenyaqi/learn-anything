import { describe, it, expect } from 'vitest';
import type { QuizQuestion } from '@/components/quiz/types';
import { resolveQuizKey, type ResolveQuizKeyCtx } from '@/components/quiz/useQuizKeyboard';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: 'q1',
    type: 'multiple_choice',
    gradeable: 'exact',
    prompt: 'Sample prompt',
    explanation: 'Sample explanation',
    options: ['A', 'B', 'C'],
    answer: 'A',
    ...overrides,
  };
}

function mcQuestion(options = ['A', 'B', 'C']): QuizQuestion {
  return makeQuestion({ type: 'multiple_choice', options });
}

function tfQuestion(): QuizQuestion {
  return makeQuestion({ id: 'tf', type: 'true_false', answer: true, options: undefined });
}

/** Minimal KeyboardEvent stub — resolver only reads key/metaKey/ctrlKey. */
function key(k: string, opts: { metaKey?: boolean; ctrlKey?: boolean } = {}): KeyboardEvent {
  return { key: k, metaKey: !!opts.metaKey, ctrlKey: !!opts.ctrlKey } as KeyboardEvent;
}

function ctx(overrides: Partial<ResolveQuizKeyCtx> = {}): ResolveQuizKeyCtx {
  return {
    question: mcQuestion(),
    isLast: false,
    targetTag: 'BUTTON',
    ...overrides,
  };
}

/* ================================================================== */
/*  Submit                                                             */
/* ================================================================== */

describe('resolveQuizKey — submit', () => {
  it('submits on ⌘ + Enter', () => {
    expect(resolveQuizKey(key('Enter', { metaKey: true }), ctx())).toEqual({ type: 'submit' });
  });

  it('submits on Ctrl + Enter', () => {
    expect(resolveQuizKey(key('Enter', { ctrlKey: true }), ctx())).toEqual({ type: 'submit' });
  });
});

/* ================================================================== */
/*  Answer shortcuts — true / false                                    */
/* ================================================================== */

describe('resolveQuizKey — true/false shortcuts', () => {
  it('"1" answers true', () => {
    expect(resolveQuizKey(key('1'), ctx({ question: tfQuestion() }))).toEqual({
      type: 'answer',
      value: true,
    });
  });

  it('"2" answers false', () => {
    expect(resolveQuizKey(key('2'), ctx({ question: tfQuestion() }))).toEqual({
      type: 'answer',
      value: false,
    });
  });

  it('is ignored while typing in an INPUT', () => {
    expect(
      resolveQuizKey(key('1'), ctx({ question: tfQuestion(), targetTag: 'INPUT' })),
    ).toBeNull();
  });
});

/* ================================================================== */
/*  Answer shortcuts — multiple choice                                 */
/* ================================================================== */

describe('resolveQuizKey — multiple-choice shortcuts', () => {
  const q = mcQuestion(['A', 'B', 'C']);

  it('maps uppercase letters A–C to their options', () => {
    expect(resolveQuizKey(key('A'), ctx({ question: q }))).toEqual({ type: 'answer', value: 'A' });
    expect(resolveQuizKey(key('C'), ctx({ question: q }))).toEqual({ type: 'answer', value: 'C' });
  });

  it('maps lowercase letters', () => {
    expect(resolveQuizKey(key('a'), ctx({ question: q }))).toEqual({ type: 'answer', value: 'A' });
  });

  it('maps digits 1–9 to their options', () => {
    expect(resolveQuizKey(key('1'), ctx({ question: q }))).toEqual({ type: 'answer', value: 'A' });
    expect(resolveQuizKey(key('3'), ctx({ question: q }))).toEqual({ type: 'answer', value: 'C' });
  });

  it('returns null for a letter beyond the options', () => {
    expect(resolveQuizKey(key('D'), ctx({ question: q }))).toBeNull();
    expect(resolveQuizKey(key('Z'), ctx({ question: q }))).toBeNull();
  });

  it('returns null for a digit beyond the options', () => {
    expect(resolveQuizKey(key('4'), ctx({ question: q }))).toBeNull();
    expect(resolveQuizKey(key('9'), ctx({ question: q }))).toBeNull();
  });

  it('is ignored while typing in a TEXTAREA', () => {
    expect(resolveQuizKey(key('A'), ctx({ question: q, targetTag: 'TEXTAREA' }))).toBeNull();
  });

  it('letters do nothing on a true/false question', () => {
    expect(resolveQuizKey(key('A'), ctx({ question: tfQuestion() }))).toBeNull();
  });
});

/* ================================================================== */
/*  Navigation                                                         */
/* ================================================================== */

describe('resolveQuizKey — navigation', () => {
  it('ArrowLeft goes to the previous question', () => {
    expect(resolveQuizKey(key('ArrowLeft'), ctx())).toEqual({ type: 'prev' });
  });

  it('ArrowRight goes to the next question when not last', () => {
    expect(resolveQuizKey(key('ArrowRight'), ctx({ isLast: false }))).toEqual({ type: 'next' });
  });

  it('ArrowRight does nothing on the last question', () => {
    expect(resolveQuizKey(key('ArrowRight'), ctx({ isLast: true }))).toBeNull();
  });

  it('navigation is ignored while typing in an INPUT', () => {
    expect(resolveQuizKey(key('ArrowLeft'), ctx({ targetTag: 'INPUT' }))).toBeNull();
  });

  it('navigation is ignored while typing in a TEXTAREA', () => {
    expect(resolveQuizKey(key('ArrowRight'), ctx({ targetTag: 'TEXTAREA' }))).toBeNull();
  });

  it('navigation works even when there is no current question', () => {
    expect(resolveQuizKey(key('ArrowLeft'), ctx({ question: null }))).toEqual({ type: 'prev' });
  });
});

/* ================================================================== */
/*  Irrelevant keys                                                    */
/* ================================================================== */

describe('resolveQuizKey — irrelevant keys', () => {
  it('returns null for keys that do nothing', () => {
    for (const k of ['Shift', 'Backspace', 'Tab', ' ', 'F5', 'Escape', 'Enter']) {
      expect(resolveQuizKey(key(k), ctx())).toBeNull();
    }
  });
});
