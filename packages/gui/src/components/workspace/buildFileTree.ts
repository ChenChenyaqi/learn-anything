// Recursive physical file-tree builder, ported from cli/site's
// `buildFileTree.ts` (PR126). Consumes the flat relative-path axes returned by
// `site_topic_data` (`TopicFiles`) and constructs a sorted dir/file tree that
// mirrors the actual filesystem — so arbitrary nesting depth renders correctly
// in the sidebar (the old fixed-depth domain/concept grouping is retired).
//
// Each incoming path is prefixed with its axis (`sessions/`, `exercises/`,
// `quizzes/`); the builder drops the first segment so the tree's top-level
// nodes are the real subdirectories (e.g. `js`, `css`), not the axis name.

export interface FileLeaf {
  type: 'file';
  name: string;
  path: string;
}

export interface DirNode {
  type: 'dir';
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = FileLeaf | DirNode;

/** Directories first, then files, alphabetical within each group. Recursive. */
function sortTree(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.type === 'dir') sortTree(node.children);
  }
}

/**
 * Build a sorted dir/file tree from flat prefixed paths. The first segment of
 * each path (the axis prefix) is dropped, so `exercises/css/box.md` and
 * `exercises/js/1.js` yield top-level `css` / `js` dirs — never an `exercises`
 * root. Returns `[]` for empty input.
 */
export function buildFileTree(paths: string[]): TreeNode[] {
  const root: DirNode = { type: 'dir', name: '', path: '', children: [] };
  const dirs = new Map<string, DirNode>();
  dirs.set('', root);

  for (const fullPath of paths) {
    const segments = fullPath.split('/');
    segments.shift(); // drop the axis prefix (sessions/ | exercises/ | quizzes/)
    const filename = segments.pop()!;
    let prefix = '';
    for (const segment of segments) {
      const childPath = prefix ? `${prefix}/${segment}` : segment;
      if (!dirs.has(childPath)) {
        const dir: DirNode = { type: 'dir', name: segment, path: childPath, children: [] };
        dirs.set(childPath, dir);
        dirs.get(prefix)!.children.push(dir);
      }
      prefix = childPath;
    }
    dirs.get(prefix)!.children.push({
      type: 'file',
      name: filename,
      path: fullPath,
    });
  }

  sortTree(root.children);
  return root.children;
}

/**
 * Directory paths between the axis prefix and the file, in ancestry order.
 * e.g. `sessions/css/advanced/box.md` → `['css', 'css/advanced']` — used to
 * auto-expand the ancestors of a selected file so it's never hidden.
 */
export function ancestorDirPaths(fullRelPath: string): string[] {
  const parts = fullRelPath.split('/');
  if (parts.length < 2) return [];
  parts.shift(); // axis prefix
  parts.pop(); // filename
  const result: string[] = [];
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    result.push(acc);
  }
  return result;
}

/** Flatten a tree back into its file leaves (depth-first, in tree order). */
export function collectFiles(nodes: TreeNode[]): FileLeaf[] {
  const result: FileLeaf[] = [];
  for (const node of nodes) {
    if (node.type === 'file') result.push(node);
    else result.push(...collectFiles(node.children));
  }
  return result;
}
