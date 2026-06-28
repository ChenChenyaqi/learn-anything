import MarkdownIt from 'markdown-it';
import emphasisRule from 'markdown-it/lib/rules_inline/emphasis.mjs';
import anchor from 'markdown-it-anchor';
import DOMPurify from 'dompurify';
import '../styles/code.css';
import { highlightInner } from './highlight';
import { headingSlug } from './slug';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    const { value, langClass } = highlightInner(str, lang);
    const cls = langClass ? ` class="${langClass}"` : '';
    return `<pre><code${cls}>${value}</code></pre>`;
  },
});

// Treat underscores as literal text (so __init__, __proto__ etc. render verbatim),
// while keeping * / ** emphasis. Code spans/blocks are unaffected.
const tokenizeEmphasis = emphasisRule.tokenize;
md.inline.ruler.at('emphasis', (state, silent) => {
  if (state.src.charCodeAt(state.pos) === 0x5f /* _ */) return false;
  return tokenizeEmphasis(state, silent);
});

md.use(anchor, {
  level: [1, 2, 3, 4, 5, 6],
  slugify: headingSlug,
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '#',
    placement: 'before',
    class: 'header-anchor',
    renderAttrs: () => ({
      'aria-label': 'Permalink to heading',
      tabindex: '-1',
    }),
  }),
});

/**
 * Renders a Markdown string to HTML.
 *
 * Output is sanitized via DOMPurify so safe HTML passes through (e.g. the
 * `<details>/<summary>` collapsible blocks used for answers) while dangerous
 * constructs — `<script>`, `on*` event handlers, `javascript:` URIs — are
 * stripped. The default allow-list keeps standard HTML, tables, code spans,
 * and the `<span class="hljs-…">` markup emitted by highlight.js.
 */
export function renderMarkdown(src: string): string {
  return DOMPurify.sanitize(md.render(src));
}

/**
 * Gets the file extension from a path.
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Checks if a file is a markdown file.
 */
export function isMarkdownFile(path: string): boolean {
  return /\.md$/i.test(path);
}
