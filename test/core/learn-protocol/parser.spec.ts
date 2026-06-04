import { describe, it, expect } from 'vitest';
import { parseKnowledgeMap } from '../../../src/core/learn-protocol/parser.js';

describe('parseKnowledgeMap', () => {
  // -- Mixed Chinese + English (realistic data) -------------------

  it('should parse Chinese + English mixed markdown (realistic data)', () => {
    const md = `# JavaScript 知识地图

## 语言基础
- 变量与数据类型
- 运算符与表达式
- 流程控制
  - 条件语句 (if/else, switch)
  - 循环 (for, while, for...of)
- 类型转换与比较

## 函数与作用域
- 函数定义与调用
- 作用域与闭包
- this 关键字`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({
      topic: 'JavaScript 知识地图',
      domains: [
        {
          name: '语言基础',
          concepts: [
            { name: '变量与数据类型', children: [] },
            { name: '运算符与表达式', children: [] },
            {
              name: '流程控制',
              children: ['条件语句 (if/else, switch)', '循环 (for, while, for...of)'],
            },
            { name: '类型转换与比较', children: [] },
          ],
        },
        {
          name: '函数与作用域',
          concepts: [
            { name: '函数定义与调用', children: [] },
            { name: '作用域与闭包', children: [] },
            { name: 'this 关键字', children: [] },
          ],
        },
      ],
    });
  });

  // -- Pure English ------------------------------------------------

  it('should parse pure English markdown correctly', () => {
    const md = `# JavaScript

## Functions
- Function Declaration
- Arrow Functions
  - Implicit return
  - Lexical this
- Closures

## Objects
- Prototype Chain
- Classes
  - Constructor
  - Inheritance`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({
      topic: 'JavaScript',
      domains: [
        {
          name: 'Functions',
          concepts: [
            { name: 'Function Declaration', children: [] },
            { name: 'Arrow Functions', children: ['Implicit return', 'Lexical this'] },
            { name: 'Closures', children: [] },
          ],
        },
        {
          name: 'Objects',
          concepts: [
            { name: 'Prototype Chain', children: [] },
            { name: 'Classes', children: ['Constructor', 'Inheritance'] },
          ],
        },
      ],
    });
  });

  // -- Only h1 title, no domains ----------------------------------

  it('should return empty domains when only h1 title is present', () => {
    const md = `# My Topic`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({ topic: 'My Topic', domains: [] });
  });

  // -- No h1 -------------------------------------------------------

  it('should handle markdown with no h1 (topic falls back to empty string)', () => {
    const md = `## Domain A
- Concept 1
- Concept 2`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({
      topic: '',
      domains: [
        {
          name: 'Domain A',
          concepts: [
            { name: 'Concept 1', children: [] },
            { name: 'Concept 2', children: [] },
          ],
        },
      ],
    });
  });

  // -- Domains with no concepts ------------------------------------

  it('should handle domains with no concepts', () => {
    const md = `# Title
## Empty Domain
## Another Empty Domain`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({
      topic: 'Title',
      domains: [
        { name: 'Empty Domain', concepts: [] },
        { name: 'Another Empty Domain', concepts: [] },
      ],
    });
  });

  // -- Special characters ------------------------------------------

  it('should preserve special characters (emoji, slashes, parentheses)', () => {
    const md = `# 🚀 JavaScript (ES6+)

## 异步编程 (Async)
- callback 函数
- Promise/A+
- async/await 🎉
  - try/catch 错误处理
- 事件循环 (Event Loop)
  - 宏任务 & 微任务`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({
      topic: '🚀 JavaScript (ES6+)',
      domains: [
        {
          name: '异步编程 (Async)',
          concepts: [
            { name: 'callback 函数', children: [] },
            { name: 'Promise/A+', children: [] },
            { name: 'async/await 🎉', children: ['try/catch 错误处理'] },
            { name: '事件循环 (Event Loop)', children: ['宏任务 & 微任务'] },
          ],
        },
      ],
    });
  });

  // -- Underscores / markdown emphasis syntax (Python dunder methods) --

  it('should preserve underscores in concept names like __init__, __call__', () => {
    const md = `## Python
- __init__
  - self
- __call__
- __str__
  - repr
  - format`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({
      topic: '',
      domains: [
        {
          name: 'Python',
          concepts: [
            { name: '__init__', children: ['self'] },
            { name: '__call__', children: [] },
            { name: '__str__', children: ['repr', 'format'] },
          ],
        },
      ],
    });
  });

  // -- Empty list items --------------------------------------------

  it('should skip empty list items', () => {
    const md = `# Test
## Domain
-
- Concept A
  -
  -
- Concept B`;

    const result = parseKnowledgeMap(md);

    expect(result.domains[0].concepts).toHaveLength(2);
    expect(result.domains[0].concepts[0].name).toBe('Concept A');
    expect(result.domains[0].concepts[1].name).toBe('Concept B');
  });

  // -- Multiple domains with mixed detail levels -------------------

  it('should handle multiple domains with mixed detail levels', () => {
    const md = `# Deep
## A
- a1
## B
- b1
  - b1d1
- b2
## C
- c1`;

    const result = parseKnowledgeMap(md);

    expect(result).toEqual({
      topic: 'Deep',
      domains: [
        { name: 'A', concepts: [{ name: 'a1', children: [] }] },
        {
          name: 'B',
          concepts: [
            { name: 'b1', children: ['b1d1'] },
            { name: 'b2', children: [] },
          ],
        },
        { name: 'C', concepts: [{ name: 'c1', children: [] }] },
      ],
    });
  });

  // -- Deeper nesting (only 2 levels captured) ---------------------

  it('should only capture 2 levels of nesting (deeper levels are ignored)', () => {
    const md = `## Root
- Level 1
  - Level 2
    - Level 3 (should be ignored)`;

    const result = parseKnowledgeMap(md);

    expect(result.domains[0].concepts).toHaveLength(1);
    expect(result.domains[0].concepts[0].name).toBe('Level 1');
    expect(result.domains[0].concepts[0].children).toEqual(['Level 2']);
    // Level 3 should not appear anywhere
    expect(result.domains[0].concepts[0].children).not.toContain('Level 3 (should be ignored)');
  });

  // -- Multiple details under one concept --------------------------

  it('should collect multiple details under a concept', () => {
    const md = `## DOM
- Events
  - Event Bubbling
  - Event Delegation
  - addEventListener`;

    const result = parseKnowledgeMap(md);

    expect(result.domains[0].concepts[0]).toEqual({
      name: 'Events',
      children: ['Event Bubbling', 'Event Delegation', 'addEventListener'],
    });
  });

  // -- Empty string ------------------------------------------------

  it('should handle empty string gracefully', () => {
    const result = parseKnowledgeMap('');

    expect(result).toEqual({ topic: '', domains: [] });
  });
});
