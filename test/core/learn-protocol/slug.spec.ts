import { describe, it, expect } from 'vitest';
import { generateSlug } from '../../../src/core/learn-protocol/slug.js';

describe('generateSlug', () => {
  // ── Basic ASCII ───────────────────────────────────────────────────

  it('should convert simple ASCII to lowercase kebab-case', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should handle single word', () => {
    expect(generateSlug('JavaScript')).toBe('javascript');
  });

  it('should handle already kebab-case input', () => {
    expect(generateSlug('already-kebab')).toBe('already-kebab');
  });

  it('should handle already lowercase input', () => {
    expect(generateSlug('lowercase')).toBe('lowercase');
  });

  // ── Slashes ───────────────────────────────────────────────────────

  it('should replace slashes with hyphens', () => {
    expect(generateSlug('Functions/Closures')).toBe('functions-closures');
  });

  it('should handle multiple slashes', () => {
    expect(generateSlug('a/b/c')).toBe('a-b-c');
  });

  // ── Spaces ────────────────────────────────────────────────────────

  it('should replace spaces with hyphens', () => {
    expect(generateSlug('Event Loop')).toBe('event-loop');
  });

  it('should handle multiple consecutive spaces', () => {
    expect(generateSlug('hello   world')).toBe('hello-world');
  });

  // ── Special characters removal ────────────────────────────────────

  it('should remove special characters (parentheses, dots, etc.)', () => {
    expect(generateSlug('Functions (ES6+)')).toBe('functions-es6');
  });

  it('should remove emoji', () => {
    expect(generateSlug('🚀 JavaScript')).toBe('javascript');
  });

  it('should remove exclamation and question marks', () => {
    expect(generateSlug('What?! Why!')).toBe('what-why');
  });

  it('should preserve underscores', () => {
    expect(generateSlug('__init__')).toBe('__init__');
  });

  it('should preserve digits', () => {
    expect(generateSlug('ES6 Features')).toBe('es6-features');
  });

  it('should handle plus sign removal', () => {
    expect(generateSlug('C++')).toBe('c');
  });

  it('should handle hash sign removal', () => {
    expect(generateSlug('C#')).toBe('c');
  });

  // ── Unicode / Chinese characters ──────────────────────────────────

  it('should preserve Chinese characters', () => {
    expect(generateSlug('变量与数据类型')).toBe('变量与数据类型');
  });

  it('should handle mixed Chinese and English', () => {
    expect(generateSlug('异步编程 (Async)')).toBe('异步编程-async');
  });

  it('should handle Japanese characters', () => {
    expect(generateSlug('プロミス')).toBe('プロミス');
  });

  // ── Consecutive dashes collapse ───────────────────────────────────

  it('should collapse consecutive dashes from slash + space combo', () => {
    expect(generateSlug('a/ b')).toBe('a-b');
  });

  it('should collapse multiple consecutive dashes', () => {
    expect(generateSlug('hello---world')).toBe('hello-world');
  });

  // ── Leading / trailing dashes ─────────────────────────────────────

  it('should trim leading and trailing dashes', () => {
    expect(generateSlug('-hello-')).toBe('hello');
  });

  it('should trim dashes after special character removal', () => {
    expect(generateSlug('(hello)')).toBe('hello');
  });

  it('should handle input that results in all-dashes', () => {
    expect(generateSlug('!!!')).toBe('');
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should handle string with only spaces', () => {
    expect(generateSlug('   ')).toBe('');
  });

  it('should handle string with only special characters', () => {
    expect(generateSlug('@#$%')).toBe('');
  });

  it('should handle single character', () => {
    expect(generateSlug('A')).toBe('a');
  });

  it('should handle mixed case with numbers and special chars', () => {
    expect(generateSlug('React Hooks (v18.2)')).toBe('react-hooks-v182');
  });

  it('should handle tab characters (treated as whitespace)', () => {
    expect(generateSlug('hello\tworld')).toBe('hello-world');
  });
});
