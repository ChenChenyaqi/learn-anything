// Code syntax highlighting via highlight.js (common-language bundle, ~35 langs
// including rust/js/ts/python/go/json...). Keeps the bundle lean versus the
// full ~190-language `highlight.js` entry while covering virtually every
// exercise file. Used both by the markdown renderer (fenced code blocks) and by
// `CodeViewer` (whole-file highlighting).

import hljs from 'highlight.js/lib/common';

export { hljs };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Highlight a code string to HTML. Uses the given language when known to
 * highlight.js, otherwise falls back to auto-detection, finally to escaped
 * plain text. Never throws.
 */
export function highlightCode(code: string, lang?: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      /* fall through */
    }
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

/** File extension → highlight.js language id, for hinting the highlighter. */
const EXT_LANG: Record<string, string> = {
  '.rs': 'rust',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.json': 'json',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.sql': 'sql',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'xml',
  '.xml': 'xml',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'ini',
  '.ini': 'ini',
  '.md': 'markdown',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.php': 'php',
  '.lua': 'lua',
  '.r': 'r',
  '.diff': 'diff',
  '.patch': 'diff',
};

/** Resolve a filename to a highlight.js language id, or undefined. */
export function langForFile(name: string): string | undefined {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return undefined;
  return EXT_LANG[name.slice(dot).toLowerCase()];
}
