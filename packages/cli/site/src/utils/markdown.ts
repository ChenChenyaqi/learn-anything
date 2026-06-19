import MarkdownIt from 'markdown-it';
import emphasisRule from 'markdown-it/lib/rules_inline/emphasis.mjs';
import anchor from 'markdown-it-anchor';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import '../styles/code.css';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre><code class="hljs language-' +
          lang +
          '">' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        );
      } catch {
        // fall through
      }
    }
    // Auto-detect if no language specified
    try {
      const result = hljs.highlightAuto(str);
      return '<pre><code class="hljs">' + result.value + '</code></pre>';
    } catch {
      return '<pre><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    }
  },
});

// Treat underscores as literal text (so __init__, __proto__ etc. render verbatim),
// while keeping * / ** emphasis. Code spans/blocks are unaffected.
const tokenizeEmphasis = emphasisRule.tokenize;
md.inline.ruler.at('emphasis', (state, silent) => {
  if (state.src.charCodeAt(state.pos) === 0x5f /* _ */) return false;
  return tokenizeEmphasis(state, silent);
});

/**
 * Unicode-aware slugify that preserves CJK characters.
 * Prefixes every id with `h-` to mitigate DOM clobbering from user-controlled
 * heading text (per markdown-it security guidance).
 */
export function headingSlug(str: string): string {
  return (
    'h-' +
    str
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
  );
}

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
 * Highlights raw code with syntax highlighting.
 * Accepts a language name (or file extension) and returns HTML.
 */
export function highlightCode(code: string, lang: string): string {
  // Map file extensions to language names
  const langMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    sh: 'bash',
    yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
  };

  const resolvedLang = langMap[lang] || lang;

  if (hljs.getLanguage(resolvedLang)) {
    try {
      return hljs.highlight(code, { language: resolvedLang, ignoreIllegals: true }).value;
    } catch {
      // fall through
    }
  }

  // Auto-detect
  try {
    return hljs.highlightAuto(code).value;
  } catch {
    return md.utils.escapeHtml(code);
  }
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
