// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import {
  gradeQuestion,
  computeResults,
  useQuizSession,
  fetchQuizList,
  fetchQuizDeck,
  type QuizDeck,
  type QuizQuestion,
  type QuizAnswers,
} from '../../site/src/composables/useQuiz';

/* ------------------------------------------------------------------ */
/*  Helpers — run composable inside a real component lifecycle        */
/* ------------------------------------------------------------------ */

interface Scope<T> {
  result: T;
  unmount: () => void;
}

function withScope<T>(fn: () => T): Scope<T> {
  let result!: T;
  const Wrapper = defineComponent({
    setup() {
      result = fn();
      return () => h('div');
    },
  });
  const app = createApp(Wrapper);
  const host = document.createElement('div');
  app.mount(host);
  return { result, unmount: () => app.unmount() };
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function makeQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: 'q1',
    type: 'multiple_choice',
    gradeable: 'exact',
    prompt: 'Sample prompt',
    explanation: 'Sample explanation',
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    ...overrides,
  };
}

function makeDeck(questions: QuizQuestion[] = []): QuizDeck {
  return {
    version: 1,
    topic: 'JavaScript',
    topic_slug: 'javascript',
    concept_slug: 'scope-closures',
    concept_name: 'Scope & Closures',
    created: '2026-06-24 10:30:00',
    questions,
  };
}

/** A deck with one question of each type/gradeable combination. */
function mixedDeck(): QuizDeck {
  return makeDeck([
    makeQuestion({
      id: 'mc',
      type: 'multiple_choice',
      gradeable: 'exact',
      prompt: 'Pick A',
      options: ['A', 'B', 'C'],
      answer: 'A',
    }),
    makeQuestion({
      id: 'tf',
      type: 'true_false',
      gradeable: 'exact',
      prompt: 'Sky is blue',
      answer: true,
      options: undefined,
    }),
    makeQuestion({
      id: 'fib',
      type: 'fill_in_blank',
      gradeable: 'accepted',
      prompt: 'A ____ captures lexical scope',
      answer: 'closure',
      accepted_answers: ['closure', 'Closure', 'CLOSURE'],
      options: undefined,
    }),
    makeQuestion({
      id: 'ai',
      type: 'error_correction',
      gradeable: 'ai_only',
      prompt: 'Fix the error in this snippet',
      answer: 'No error — the code is correct.',
      options: undefined,
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                  */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/* ================================================================== */
/*  gradeQuestion                                                      */
/* ================================================================== */

describe('gradeQuestion', () => {
  /* ---- exact (string) ---- */
  describe('gradeable: exact (multiple_choice)', () => {
    const q = makeQuestion({ gradeable: 'exact', answer: 'Option A' });

    it('returns true when answer matches exactly', () => {
      expect(gradeQuestion(q, 'Option A')).toBe(true);
    });

    it('returns false when answer does not match', () => {
      expect(gradeQuestion(q, 'Option B')).toBe(false);
    });

    it('returns false when answer is null', () => {
      expect(gradeQuestion(q, null)).toBe(false);
    });

    it('returns false when answer is empty string', () => {
      expect(gradeQuestion(q, '')).toBe(false);
    });

    it('is case-sensitive (exact means strict)', () => {
      expect(gradeQuestion(q, 'option a')).toBe(false);
    });
  });

  /* ---- exact (boolean) ---- */
  describe('gradeable: exact (true_false)', () => {
    const q = makeQuestion({ gradeable: 'exact', type: 'true_false', answer: true });

    it('returns true when boolean matches', () => {
      expect(gradeQuestion(q, true)).toBe(true);
    });

    it('returns false when boolean does not match', () => {
      expect(gradeQuestion(q, false)).toBe(false);
    });

    it('returns false when answer is null', () => {
      expect(gradeQuestion(q, null)).toBe(false);
    });
  });

  /* ---- accepted ---- */
  describe('gradeable: accepted (fill_in_blank)', () => {
    const q = makeQuestion({
      gradeable: 'accepted',
      type: 'fill_in_blank',
      answer: 'closure',
      accepted_answers: ['closure', 'Closure'],
    });

    it('matches the canonical answer', () => {
      expect(gradeQuestion(q, 'closure')).toBe(true);
    });

    it('matches an accepted answer', () => {
      expect(gradeQuestion(q, 'Closure')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(gradeQuestion(q, 'CLOSURE')).toBe(true);
    });

    it('trims whitespace before comparing', () => {
      expect(gradeQuestion(q, '  closure  ')).toBe(true);
    });

    it('returns false for a wrong answer', () => {
      expect(gradeQuestion(q, 'hoisting')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(gradeQuestion(q, '')).toBe(false);
    });

    it('returns false for null', () => {
      expect(gradeQuestion(q, null)).toBe(false);
    });

    it('falls back to canonical answer when accepted_answers is empty', () => {
      const qNoAccepted = makeQuestion({
        gradeable: 'accepted',
        answer: 'prototype',
        accepted_answers: [],
      });
      expect(gradeQuestion(qNoAccepted, 'prototype')).toBe(true);
      expect(gradeQuestion(qNoAccepted, 'PROTOTYPE')).toBe(true);
    });

    it('falls back to canonical answer when accepted_answers is undefined', () => {
      const qNoAccepted = makeQuestion({
        gradeable: 'accepted',
        answer: 'prototype',
      });
      expect(gradeQuestion(qNoAccepted, 'prototype')).toBe(true);
    });
  });

  /* ---- ai_only ---- */
  describe('gradeable: ai_only', () => {
    const q = makeQuestion({ gradeable: 'ai_only', answer: 'reference text' });

    it('returns null regardless of answer', () => {
      expect(gradeQuestion(q, 'reference text')).toBe(null);
    });

    it('returns null when answer is null', () => {
      expect(gradeQuestion(q, null)).toBe(null);
    });

    it('returns null when answer is wrong', () => {
      expect(gradeQuestion(q, 'totally wrong')).toBe(null);
    });
  });
});

/* ================================================================== */
/*  computeResults                                                     */
/* ================================================================== */

describe('computeResults', () => {
  it('scores all-correct deck (excluding ai_only)', () => {
    const deck = mixedDeck();
    const answers: QuizAnswers = { mc: 'A', tf: true, fib: 'closure', ai: 'some text' };
    const r = computeResults(deck, answers);
    expect(r.score).toBe(3);
    expect(r.total).toBe(3);
    expect(r.percentage).toBe(100);
  });

  it('excludes ai_only from score and total', () => {
    const deck = mixedDeck();
    const answers: QuizAnswers = { mc: 'A', tf: true, fib: 'closure', ai: 'wrong' };
    const r = computeResults(deck, answers);
    expect(r.total).toBe(3);
    expect(r.results).toHaveLength(4);
    expect(r.results[3]!.correct).toBe(null);
  });

  it('scores partial answers correctly', () => {
    const deck = mixedDeck();
    const answers: QuizAnswers = { mc: 'A', tf: false, fib: 'closure', ai: null };
    const r = computeResults(deck, answers);
    expect(r.score).toBe(2);
    expect(r.total).toBe(3);
    expect(r.percentage).toBe(67);
  });

  it('scores 0 when no answers provided', () => {
    const deck = mixedDeck();
    const r = computeResults(deck, {});
    expect(r.score).toBe(0);
    expect(r.total).toBe(3);
    expect(r.percentage).toBe(0);
  });

  it('handles deck with only ai_only questions', () => {
    const deck = makeDeck([makeQuestion({ id: 'ai1', gradeable: 'ai_only' })]);
    const r = computeResults(deck, { ai1: 'text' });
    expect(r.score).toBe(0);
    expect(r.total).toBe(0);
    expect(r.percentage).toBe(0);
    expect(r.results).toHaveLength(1);
    expect(r.results[0]!.correct).toBe(null);
  });

  it('handles empty deck', () => {
    const deck = makeDeck([]);
    const r = computeResults(deck, {});
    expect(r.score).toBe(0);
    expect(r.total).toBe(0);
    expect(r.percentage).toBe(0);
    expect(r.results).toEqual([]);
  });

  it('rounds percentage to nearest integer', () => {
    const deck = makeDeck([
      makeQuestion({ id: 'q1', gradeable: 'exact', answer: 'yes' }),
      makeQuestion({ id: 'q2', gradeable: 'exact', answer: 'yes' }),
      makeQuestion({ id: 'q3', gradeable: 'exact', answer: 'yes' }),
    ]);
    const r = computeResults(deck, { q1: 'yes', q2: 'no', q3: 'yes' });
    expect(r.score).toBe(2);
    expect(r.total).toBe(3);
    expect(r.percentage).toBe(67);
  });

  it('preserves userAnswer and question in each result', () => {
    const deck = mixedDeck();
    const answers: QuizAnswers = { mc: 'B', tf: true, fib: 'hoisting', ai: 'my answer' };
    const r = computeResults(deck, answers);
    expect(r.results[0]!.userAnswer).toBe('B');
    expect(r.results[0]!.question.id).toBe('mc');
    expect(r.results[3]!.userAnswer).toBe('my answer');
    expect(r.results[3]!.question.id).toBe('ai');
  });
});

/* ================================================================== */
/*  useQuizSession                                                     */
/* ================================================================== */

describe('useQuizSession', () => {
  it('initializes at question 0 with no answers', () => {
    const deck = makeDeck([makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })]);
    const { result } = withScope(() => useQuizSession(deck));
    expect(result.currentIndex.value).toBe(0);
    expect(result.isFirst.value).toBe(true);
    expect(result.isLast.value).toBe(false);
    expect(result.isComplete.value).toBe(false);
    expect(result.total).toBe(2);
    expect(result.currentQuestion.value.id).toBe('q1');
    expect(result.direction.value).toBe('forward');
  });

  /* ---- navigation ---- */
  describe('navigation', () => {
    it('goNext advances the index', () => {
      const deck = makeDeck([
        makeQuestion({ id: 'q1' }),
        makeQuestion({ id: 'q2' }),
        makeQuestion({ id: 'q3' }),
      ]);
      const { result } = withScope(() => useQuizSession(deck));
      result.goNext();
      expect(result.currentIndex.value).toBe(1);
      expect(result.currentQuestion.value.id).toBe('q2');
      expect(result.direction.value).toBe('forward');
    });

    it('goPrev decrements the index', () => {
      const deck = makeDeck([
        makeQuestion({ id: 'q1' }),
        makeQuestion({ id: 'q2' }),
        makeQuestion({ id: 'q3' }),
      ]);
      const { result } = withScope(() => useQuizSession(deck));
      result.goNext();
      result.goPrev();
      expect(result.currentIndex.value).toBe(0);
      expect(result.direction.value).toBe('backward');
    });

    it('does not advance past the last question', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.goNext();
      expect(result.currentIndex.value).toBe(0);
      expect(result.isLast.value).toBe(true);
    });

    it('does not go below the first question', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.goPrev();
      expect(result.currentIndex.value).toBe(0);
      expect(result.isFirst.value).toBe(true);
    });

    it('isLast is true on the final question', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.goNext();
      expect(result.isLast.value).toBe(true);
    });
  });

  /* ---- answers ---- */
  describe('answers', () => {
    it('setAnswer stores an answer', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.setAnswer('q1', 'my answer');
      expect(result.getAnswer('q1')).toBe('my answer');
    });

    it('getAnswer returns null for unanswered questions', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' })]);
      const { result } = withScope(() => useQuizSession(deck));
      expect(result.getAnswer('q1')).toBe(null);
      expect(result.getAnswer('nonexistent')).toBe(null);
    });

    it('setAnswer overwrites previous answer', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.setAnswer('q1', 'first');
      result.setAnswer('q1', 'second');
      expect(result.getAnswer('q1')).toBe('second');
    });

    it('preserves answers when navigating back and forth', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.setAnswer('q1', 'answer-1');
      result.goNext();
      result.setAnswer('q2', 'answer-2');
      result.goPrev();
      expect(result.getAnswer('q1')).toBe('answer-1');
      result.goNext();
      expect(result.getAnswer('q2')).toBe('answer-2');
    });

    it('stores boolean answers for true/false questions', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1', type: 'true_false' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.setAnswer('q1', true);
      expect(result.getAnswer('q1')).toBe(true);
    });
  });

  /* ---- completion & results ---- */
  describe('completion & results', () => {
    it('submitAll sets isComplete to true', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.submitAll();
      expect(result.isComplete.value).toBe(true);
    });

    it('results is null before submission', () => {
      const deck = mixedDeck();
      const { result } = withScope(() => useQuizSession(deck));
      expect(result.results.value).toBe(null);
    });

    it('results computes QuizResults after submission', async () => {
      const deck = mixedDeck();
      const { result } = withScope(() => useQuizSession(deck));
      result.setAnswer('mc', 'A');
      result.setAnswer('tf', true);
      result.setAnswer('fib', 'closure');
      result.setAnswer('ai', 'some text');
      result.submitAll();
      await nextTick();
      const r = result.results.value;
      expect(r).not.toBe(null);
      expect(r!.score).toBe(3);
      expect(r!.total).toBe(3);
    });

    it('results recomputes when answers change after submission', async () => {
      const deck = makeDeck([makeQuestion({ id: 'q1', gradeable: 'exact', answer: 'yes' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.setAnswer('q1', 'no');
      result.submitAll();
      await nextTick();
      expect(result.results.value!.score).toBe(0);
      result.setAnswer('q1', 'yes');
      await nextTick();
      expect(result.results.value!.score).toBe(1);
    });
  });

  /* ---- reset ---- */
  describe('reset', () => {
    it('clears answers and resets to question 0', () => {
      const deck = makeDeck([makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })]);
      const { result } = withScope(() => useQuizSession(deck));
      result.setAnswer('q1', 'answer');
      result.goNext();
      result.submitAll();
      result.reset();
      expect(result.currentIndex.value).toBe(0);
      expect(result.getAnswer('q1')).toBe(null);
      expect(result.isComplete.value).toBe(false);
      expect(result.direction.value).toBe('forward');
    });
  });
});

/* ================================================================== */
/*  fetchQuizList                                                      */
/* ================================================================== */

describe('fetchQuizList', () => {
  it('returns groups on successful fetch', async () => {
    const mockGroups = [
      {
        concept_slug: 'closures',
        concept_name: 'Closures',
        files: [{ filename: 'q.json', path: '/p/q.json' }],
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ groups: mockGroups }),
    } as Response);

    const { result } = withScope(() => fetchQuizList('javascript'));
    await nextTick();
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });
    expect(result.groups.value).toEqual(mockGroups);
    expect(result.error.value).toBe(null);
  });

  it('sets error on failed fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as Response);

    const { result } = withScope(() => fetchQuizList('nonexistent'));
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });
    expect(result.groups.value).toEqual([]);
    expect(result.error.value).toBe('HTTP 404');
  });

  it('sets error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = withScope(() => fetchQuizList('javascript'));
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });
    expect(result.groups.value).toEqual([]);
    expect(result.error.value).toBe('Network error');
  });

  it('encodes the topic slug in the URL', () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ groups: [] }),
    } as Response);

    withScope(() => fetchQuizList('java script'));
    expect(fetch).toHaveBeenCalledWith('/api/quizzes?topic=java%20script');
  });

  it('reload() refetches data', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ groups: [] }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ groups: [{ concept_slug: 'x', concept_name: 'X', files: [] }] }),
      } as Response);

    const { result } = withScope(() => fetchQuizList('javascript'));
    await vi.waitFor(() => expect(result.loading.value).toBe(false));
    expect(result.groups.value).toEqual([]);

    await result.reload();
    expect(result.groups.value).toHaveLength(1);
  });

  it('sets loading to true during fetch, false after', async () => {
    let resolveJson: (v: unknown) => void = () => {};
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveJson = () => resolve({ ok: true, json: async () => ({ groups: [] }) } as Response);
      }),
    );

    const { result } = withScope(() => fetchQuizList('javascript'));
    expect(result.loading.value).toBe(true);
    resolveJson(undefined);
    await vi.waitFor(() => expect(result.loading.value).toBe(false));
  });
});

/* ================================================================== */
/*  fetchQuizDeck                                                      */
/* ================================================================== */

describe('fetchQuizDeck', () => {
  const mockDeck: QuizDeck = {
    version: 1,
    topic: 'JavaScript',
    topic_slug: 'javascript',
    concept_slug: 'closures',
    concept_name: 'Closures',
    created: '2026-06-24 10:30:00',
    questions: [makeQuestion({ id: 'q1' })],
  };

  it('returns the QuizDeck on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDeck,
    } as Response);

    const deck = await fetchQuizDeck('javascript', 'closures/quiz.json');
    expect(deck).toEqual(mockDeck);
  });

  it('encodes topic slug but not filename slashes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDeck,
    } as Response);

    await fetchQuizDeck('java script', 'closures/quiz.json');
    expect(fetch).toHaveBeenCalledWith('/api/quizzes/java%20script/closures/quiz.json');
  });

  it('throws on HTTP error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchQuizDeck('javascript', 'missing.json')).rejects.toThrow('HTTP 404');
  });

  it('throws on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchQuizDeck('javascript', 'quiz.json')).rejects.toThrow('Network error');
  });
});
