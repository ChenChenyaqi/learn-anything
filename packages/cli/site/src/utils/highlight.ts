/* Syntax highlighting utilities (shared by the markdown render pipeline and
 * standalone code rendering). Built on highlight.js. */

import hljs from 'highlight.js';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** HTML-escape — matches markdown-it's escapeHtml (the 5 significant chars). */
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** Map common file extensions to highlight.js language names. */
const LANG_MAP: Record<string, string> = {
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

/** Resolve a file extension (or language name) to a highlight.js language id. */
export function resolveLanguage(lang: string): string {
  return LANG_MAP[lang] ?? lang;
}

export interface HighlightResult {
  /** Highlighted (or escaped) HTML for the code's inner content. */
  value: string;
  /** Wrapper class hint: `hljs language-LANG` | `hljs` | `` (escape fallback). */
  langClass: string;
}

/**
 * Shared highlight ladder: known language → auto-detect → escaped fallback.
 * Returns the inner HTML plus a class hint for the wrapping `<code>` element.
 */
export function highlightInner(code: string, lang: string): HighlightResult {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return {
        value: hljs.highlight(code, { language: lang, ignoreIllegals: true }).value,
        langClass: `hljs language-${lang}`,
      };
    } catch {
      // fall through to auto-detect
    }
  }
  try {
    return { value: hljs.highlightAuto(code).value, langClass: 'hljs' };
  } catch {
    return { value: escapeHtml(code), langClass: '' };
  }
}

/**
 * Highlight raw code for standalone display (returns inner HTML only,
 * no `<pre><code>` wrapper). Accepts a language name or file extension.
 */
export function highlightCode(code: string, lang: string): string {
  return highlightInner(code, resolveLanguage(lang)).value;
}
