import { describe, it, expect } from 'vitest';
import { validateQuizDeck } from '../src/scripts/utils.mjs';

const validDeck = {
  version: 1,
  topic: 'JavaScript',
  topic_slug: 'javascript',
  concept_slug: 'closures',
  concept_name: 'Closures',
  created: '2026-06-24 10:30:00',
  questions: [
    {
      id: 'q1',
      type: 'multiple_choice',
      gradeable: 'exact',
      prompt: 'What is a closure?',
      options: ['A', 'B', 'C', 'D'],
      answer: 'A',
      explanation: 'A closure captures lexical scope.',
    },
    {
      id: 'q2',
      type: 'true_false',
      gradeable: 'exact',
      prompt: 'Closures capture variables by reference.',
      answer: true,
      explanation: '...',
    },
    {
      id: 'q3',
      type: 'fill_in_blank',
      gradeable: 'accepted',
      prompt: 'A closure is also called ___.',
      accepted_answers: ['闭包', 'closure'],
      answer: '闭包',
      explanation: '...',
    },
    {
      id: 'q4',
      type: 'error_correction',
      gradeable: 'ai_only',
      prompt: 'Find the bug.',
      answer: 'Reference explanation',
      explanation: '...',
    },
  ],
};

describe('validateQuizDeck', () => {
  it('accepts a fully valid deck', () => {
    expect(validateQuizDeck(validDeck)).toEqual([]);
  });

  it('rejects non-object input', () => {
    expect(validateQuizDeck(null)).toHaveLength(1);
    expect(validateQuizDeck('not an object')).toHaveLength(1);
    expect(validateQuizDeck([])).toHaveLength(1);
  });

  it('reports wrong version and missing required top-level fields', () => {
    const errors = validateQuizDeck({ version: 2, questions: [] });
    const paths = errors.map((e) => e.path);
    expect(paths).toContain('version');
    expect(paths).toContain('topic');
    expect(paths).toContain('topic_slug');
    expect(paths).toContain('concept_slug');
    expect(paths).toContain('concept_name');
    expect(paths).toContain('created');
  });

  it('rejects unknown question type and gradeable', () => {
    const deck = {
      ...validDeck,
      questions: [
        { id: 'q1', type: 'essay', gradeable: 'magic', prompt: 'p', explanation: 'e', answer: 'x' },
      ],
    };
    const paths = validateQuizDeck(deck).map((e) => e.path);
    expect(paths).toContain('questions[0].type');
    expect(paths).toContain('questions[0].gradeable');
  });

  it('cross-validates type↔gradeable consistency', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          gradeable: 'accepted',
          prompt: 'p',
          explanation: 'e',
          options: ['A', 'B'],
          answer: 'A',
        },
      ],
    };
    const errors = validateQuizDeck(deck);
    expect(errors.some((e) => e.path === 'questions[0].gradeable')).toBe(true);
  });

  it('requires options[] (>=2) for multiple_choice', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          gradeable: 'exact',
          prompt: 'p',
          explanation: 'e',
          answer: 'A',
        },
      ],
    };
    expect(validateQuizDeck(deck).some((e) => e.path === 'questions[0].options')).toBe(true);
  });

  it('requires boolean answer for true_false', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'true_false',
          gradeable: 'exact',
          prompt: 'p',
          explanation: 'e',
          answer: 'yes',
        },
      ],
    };
    expect(validateQuizDeck(deck).some((e) => e.path === 'questions[0].answer')).toBe(true);
  });

  it('requires accepted_answers[] (>=1) for fill_in_blank', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'fill_in_blank',
          gradeable: 'accepted',
          prompt: 'p',
          explanation: 'e',
          answer: 'x',
        },
      ],
    };
    expect(validateQuizDeck(deck).some((e) => e.path === 'questions[0].accepted_answers')).toBe(
      true,
    );
  });

  /* ---- multi_select ---- */

  it('accepts a valid multi_select question', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'multi_select',
          gradeable: 'exact',
          prompt: 'p',
          explanation: 'e',
          options: ['A', 'B', 'C', 'D'],
          answer: ['A', 'C'],
        },
      ],
    };
    expect(validateQuizDeck(deck)).toEqual([]);
  });

  it('requires options[] (>=2) for multi_select', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'multi_select',
          gradeable: 'exact',
          prompt: 'p',
          explanation: 'e',
          options: ['A'],
          answer: ['A'],
        },
      ],
    };
    expect(validateQuizDeck(deck).some((e) => e.path === 'questions[0].options')).toBe(true);
  });

  it('requires answer to be an array (>=2) for multi_select', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'multi_select',
          gradeable: 'exact',
          prompt: 'p',
          explanation: 'e',
          options: ['A', 'B', 'C'],
          answer: 'A',
        },
      ],
    };
    expect(validateQuizDeck(deck).some((e) => e.path === 'questions[0].answer')).toBe(true);
  });

  it('rejects multi_select answer with only 1 element', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'multi_select',
          gradeable: 'exact',
          prompt: 'p',
          explanation: 'e',
          options: ['A', 'B', 'C'],
          answer: ['A'],
        },
      ],
    };
    expect(validateQuizDeck(deck).some((e) => e.path === 'questions[0].answer')).toBe(true);
  });

  it('rejects multi_select answer element not in options', () => {
    const deck = {
      ...validDeck,
      questions: [
        {
          id: 'q1',
          type: 'multi_select',
          gradeable: 'exact',
          prompt: 'p',
          explanation: 'e',
          options: ['A', 'B', 'C'],
          answer: ['A', 'Z'],
        },
      ],
    };
    expect(validateQuizDeck(deck).some((e) => e.path === 'questions[0].answer[1]')).toBe(true);
  });
});
