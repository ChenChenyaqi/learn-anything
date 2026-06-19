// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../site/src/utils/markdown';

/* ==================================================================== */
/*  Tests for the markdown-it-anchor integration in utils/markdown.ts.  */
/*  renderMarkdown() runs markdown-it (with anchor plugin) then          */
/*  DOMPurify.sanitize(), so these tests verify the full pipeline.       */
/* ==================================================================== */

/** Build the expected HTML for a heading with an anchor permalink. */
function h(tag: string, id: string, inner: string): string {
  return (
    `<${tag} id="${id}" tabindex="-1">` +
    `<a class="header-anchor" href="#${id}" aria-label="Permalink to heading" tabindex="-1">#</a> ` +
    `${inner}</${tag}>\n`
  );
}

describe('renderMarkdown: heading anchors', () => {
  /* --------------------------------------------------------------- */
  /*  All heading levels h1–h6                                       */
  /* --------------------------------------------------------------- */
  it.each([
    ['# H1', 'h1', 'h-h1', 'H1'],
    ['## H2', 'h2', 'h-h2', 'H2'],
    ['### H3', 'h3', 'h-h3', 'H3'],
    ['#### H4', 'h4', 'h-h4', 'H4'],
    ['##### H5', 'h5', 'h-h5', 'H5'],
    ['###### H6', 'h6', 'h-h6', 'H6'],
  ])('renders %s with id, anchor, aria-label, tabindex', (_src, tag, id, text) => {
    expect(renderMarkdown(_src)).toBe(h(tag, id, text));
  });

  /* --------------------------------------------------------------- */
  /*  Slugify: lowercase, whitespace → hyphen, strip punctuation     */
  /* --------------------------------------------------------------- */
  it('slugifies to lowercase with hyphens', () => {
    expect(renderMarkdown('## Operators and Control Flow')).toBe(
      h('h2', 'h-operators-and-control-flow', 'Operators and Control Flow'),
    );
  });

  it('lowercases CamelCase', () => {
    expect(renderMarkdown('## CamelCase Title')).toBe(
      h('h2', 'h-camelcase-title', 'CamelCase Title'),
    );
  });

  it('collapses multiple spaces into one hyphen in the slug', () => {
    expect(renderMarkdown('## Foo   Bar')).toBe(h('h2', 'h-foo-bar', 'Foo   Bar'));
  });

  it('strips punctuation but keeps letters, numbers, and hyphens', () => {
    expect(renderMarkdown('## Hello, World! (v2.0)')).toBe(
      h('h2', 'h-hello-world-v20', 'Hello, World! (v2.0)'),
    );
  });

  it('preserves existing hyphens in the slug', () => {
    expect(renderMarkdown('## Already-Hyphenated')).toBe(
      h('h2', 'h-already-hyphenated', 'Already-Hyphenated'),
    );
  });

  it('extracts text from inline code for the slug', () => {
    expect(renderMarkdown('## The `forEach` method')).toBe(
      h('h2', 'h-the-foreach-method', 'The <code>forEach</code> method'),
    );
  });

  /* --------------------------------------------------------------- */
  /*  CJK slug preservation                                          */
  /* --------------------------------------------------------------- */
  it('preserves Chinese characters in slug', () => {
    expect(renderMarkdown('## 控制流')).toBe(h('h2', 'h-控制流', '控制流'));
  });

  it('preserves mixed ASCII and CJK', () => {
    expect(renderMarkdown('## JavaScript 语言基础')).toBe(
      h('h2', 'h-javascript-语言基础', 'JavaScript 语言基础'),
    );
  });

  it('preserves Japanese characters', () => {
    expect(renderMarkdown('## 非同期プログラミング')).toBe(
      h('h2', 'h-非同期プログラミング', '非同期プログラミング'),
    );
  });

  it('preserves Korean characters', () => {
    expect(renderMarkdown('## 비동기 프로그래밍')).toBe(
      h('h2', 'h-비동기-프로그래밍', '비동기 프로그래밍'),
    );
  });

  /* --------------------------------------------------------------- */
  /*  Duplicate headings get incrementing suffixes                  */
  /* --------------------------------------------------------------- */
  it('appends -1 to the second occurrence of the same heading', () => {
    expect(renderMarkdown('## Overview\n\nText.\n\n## Overview')).toBe(
      h('h2', 'h-overview', 'Overview') + '<p>Text.</p>\n' + h('h2', 'h-overview-1', 'Overview'),
    );
  });

  it('appends incrementing suffixes for multiple duplicates', () => {
    expect(renderMarkdown('## Overview\n\n## Overview\n\n## Overview')).toBe(
      h('h2', 'h-overview', 'Overview') +
        h('h2', 'h-overview-1', 'Overview') +
        h('h2', 'h-overview-2', 'Overview'),
    );
  });

  it('renders multiple heading levels in one document', () => {
    expect(renderMarkdown('# Title\n\n## Subtitle\n\n### Deep')).toBe(
      h('h1', 'h-title', 'Title') + h('h2', 'h-subtitle', 'Subtitle') + h('h3', 'h-deep', 'Deep'),
    );
  });
});

describe('renderMarkdown: DOMPurify compatibility', () => {
  it('preserves <details>/<summary> collapsible blocks', () => {
    expect(renderMarkdown('<details><summary>Click</summary>Content</details>')).toBe(
      '<details><summary>Click</summary>Content</details>',
    );
  });

  it('preserves highlighted fenced code blocks', () => {
    expect(renderMarkdown('```js\nconst x = 1;\n```')).toBe(
      '<pre><code class="hljs language-js">' +
        '<span class="hljs-keyword">const</span> x = ' +
        '<span class="hljs-number">1</span>;\n' +
        '</code></pre>\n',
    );
  });
});
