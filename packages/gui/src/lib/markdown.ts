// Markdown rendering for note files. Configures a single shared `markdown-it`
// instance with highlight.js for fenced code blocks and an override that forces
// every link to open externally (a desktop app has no in-app tab navigation).
//
// The output HTML is consumed read-only via `v-html` in `NoteViewer`; the
// visual styling lives in `styles/main.css` under the `.prose` scope. HTML in
// source is disabled (`html: false`) since notes are trusted content authored
// by the agent but we still avoid raw-HTML injection surface.

import MarkdownIt from 'markdown-it';
import { highlightCode } from './highlight';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    return highlightCode(str, lang);
  },
});

// Force all links to open in the system browser (no in-app navigation).
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const aIndex = tokens[idx].attrIndex('target');
  if (aIndex < 0) tokens[idx].attrPush(['target', '_blank']);
  else tokens[idx].attrs![aIndex][1] = '_blank';
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Render a markdown note to HTML. */
export function renderMarkdown(text: string): string {
  return md.render(text);
}
