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

function sortTree(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.type === 'dir') sortTree(node.children);
  }
}

export function buildFileTree(paths: string[]): TreeNode[] {
  const root: DirNode = { type: 'dir', name: '', path: '', children: [] };
  const dirs = new Map<string, DirNode>();
  dirs.set('', root);

  for (const fullPath of paths) {
    const segments = fullPath.split('/');
    segments.shift();
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

export function ancestorDirPaths(fullRelPath: string): string[] {
  const parts = fullRelPath.split('/');
  if (parts.length < 2) return [];
  parts.shift();
  parts.pop();
  const result: string[] = [];
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    result.push(acc);
  }
  return result;
}

export function collectFiles(nodes: TreeNode[]): FileLeaf[] {
  const result: FileLeaf[] = [];
  for (const node of nodes) {
    if (node.type === 'file') result.push(node);
    else result.push(...collectFiles(node.children));
  }
  return result;
}
