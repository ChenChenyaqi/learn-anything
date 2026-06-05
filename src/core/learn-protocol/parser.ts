/**
 * Markdown parser for v0 knowledge-map.md.
 *
 * Uses unified + remark-parse to extract the hierarchical structure
 * (domains -> concepts -> details) from the v0 knowledge-map format.
 *
 * This is used ONLY during migration (init/update), not at AI runtime.
 *
 * v0 knowledge-map.md format:
 *
 * ```md
 * # Topic Name
 * ## Domain 1
 * - Concept A
 *   - Detail A1
 *   - Detail A2
 * - Concept B
 * ## Domain 2
 * - Concept C
 * ```
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, Heading, List, ListItem } from 'mdast';

import type { ParsedKnowledgeMap, ParsedDomain, ParsedConcept } from './types.js';

// ---- Helpers -----------------------------------------------------------

/** Recursively extract plain text from an AST node.
 *
 * Does NOT descend into nested `list` nodes — those are structural
 * children (details under a concept) and should not contribute to
 * the parent concept's name.
 */
function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';

  const n = node as Record<string, unknown>;

  if (n.type === 'text' && typeof n.value === 'string') {
    return n.value;
  }

  // Don't descend into lists: their content belongs to child concepts/details.
  if (n.type === 'list') return '';

  if (Array.isArray(n.children)) {
    return n.children.map(extractText).join('');
  }

  return '';
}

/** Narrow a child node to a specific type. */
function isHeading(node: unknown, depth: number): node is Heading {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  return n.type === 'heading' && n.depth === depth;
}

function isList(node: unknown): node is List {
  if (!node || typeof node !== 'object') return false;
  return (node as Record<string, unknown>).type === 'list';
}

// ---- Public API ---------------------------------------------------------

/**
 * Parse a v0 knowledge-map.md file content into a structured representation.
 *
 * The parser walks the mdast tree:
 * - `# Title` (h1) -> topic name
 * - `## DomainName` (h2) -> start a new domain
 * - `- Concept` (top-level list item) -> add concept to current domain
 * - `  - Detail` (nested list item) -> add detail to preceding concept
 */
export function parseKnowledgeMap(markdown: string): ParsedKnowledgeMap {
  const tree = unified().use(remarkParse).parse(markdown) as Root;

  let topic = '';
  const domains: ParsedDomain[] = [];
  let currentDomain: ParsedDomain | null = null;

  for (const node of tree.children) {
    // # Title
    if (isHeading(node, 1)) {
      topic = extractText(node).trim();
      continue;
    }

    // ## DomainName
    if (isHeading(node, 2)) {
      if (currentDomain) domains.push(currentDomain);
      currentDomain = {
        name: extractText(node).trim(),
        concepts: [],
      };
      continue;
    }

    // - Concept list (only process if we're inside a domain)
    if (isList(node) && currentDomain) {
      const list = node;
      for (const item of list.children) {
        processListItem(item as ListItem, currentDomain, markdown);
      }
    }
  }

  // Push the last domain
  if (currentDomain) domains.push(currentDomain);

  return { topic, domains };
}

/**
 * Get list-item text via source position slicing.
 *
 * remark-parse consumes `__init__` as `<strong>init</strong>`, losing the
 * underscores. By slicing the original markdown source at the paragraph's
 * position offsets, we preserve the exact original text including any
 * markdown formatting characters.
 */
function extractListItemText(item: ListItem, source: string): string {
  for (const child of item.children) {
    if ((child as unknown as Record<string, unknown>).type === 'paragraph') {
      const para = child as unknown as Record<string, unknown>;
      const pos = para.position as Record<string, unknown> | undefined;
      if (pos?.start && pos?.end) {
        const start = pos.start as Record<string, number>;
        const end = pos.end as Record<string, number>;
        if (start.offset !== undefined && end.offset !== undefined) {
          return source.slice(start.offset, end.offset);
        }
      }
    }
  }
  // Fallback to recursive text extraction
  return extractText(item);
}

/** Strip common Markdown escape backslashes (e.g. `\_` → `_`, `\*` → `*`). */
function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\`*{}[\]()#+\-.!_>~|])/g, '$1');
}

/** Extract a concept (and its optional details) from a list item. */
function processListItem(item: ListItem, domain: ParsedDomain, source: string): void {
  const name = unescapeMarkdown(extractListItemText(item, source).trim());
  if (!name) return;

  const concept: ParsedConcept = { name, children: [] };

  // Look for a nested list inside this list item (these are third-level details)
  for (const child of item.children) {
    if (isList(child)) {
      for (const nestedItem of child.children) {
        const detailName = unescapeMarkdown(
          extractListItemText(nestedItem as ListItem, source).trim(),
        );
        if (detailName) {
          concept.children.push(detailName);
        }
      }
    }
  }

  domain.concepts.push(concept);
}
