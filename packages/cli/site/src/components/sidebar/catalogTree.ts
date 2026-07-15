import type {
  CatalogEntry,
  CatalogKind,
  StateV1,
  TopicCatalog,
} from '@/composables/topicDataTypes';

export interface CatalogTreeFile {
  type: 'file';
  key: string;
  name: string;
  path: string;
  entry: CatalogEntry;
}

export interface CatalogTreeDirectory {
  type: 'directory';
  key: string;
  name: string;
  label: string;
  isOrphan: boolean;
  children: CatalogTreeNode[];
}

export type CatalogTreeNode = CatalogTreeFile | CatalogTreeDirectory;

const ROOT_BY_KIND: Record<CatalogKind, string> = {
  session: 'sessions',
  exercise: 'exercises',
  quiz: 'quizzes',
};

interface SemanticLabel {
  label: string;
  order: number;
}

function buildLabels(state: StateV1 | null): Map<string, SemanticLabel> {
  const labels = new Map<string, SemanticLabel>();
  let order = 0;
  for (const domain of state?.domains ?? []) {
    if (!labels.has(domain.slug)) labels.set(domain.slug, { label: domain.name, order: order++ });
    for (const concept of domain.concepts) {
      if (!labels.has(concept.slug))
        labels.set(concept.slug, { label: concept.name, order: order++ });
    }
  }
  return labels;
}

function sortTree(nodes: CatalogTreeNode[], labels: Map<string, SemanticLabel>): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    const ao = a.type === 'directory' ? labels.get(a.name)?.order : undefined;
    const bo = b.type === 'directory' ? labels.get(b.name)?.order : undefined;
    if (ao !== undefined || bo !== undefined)
      return (ao ?? Number.MAX_SAFE_INTEGER) - (bo ?? Number.MAX_SAFE_INTEGER);
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) if (node.type === 'directory') sortTree(node.children, labels);
}

export function buildCatalogTree(
  catalog: TopicCatalog | null,
  kind: CatalogKind,
  topicSlug: string,
  state: StateV1 | null,
): CatalogTreeNode[] {
  const roots: CatalogTreeNode[] = [];
  const directories = new Map<string, CatalogTreeDirectory>();
  const labels = buildLabels(state);
  const rootName = ROOT_BY_KIND[kind];

  for (const entry of catalog?.entries ?? []) {
    if (entry.kind !== kind) continue;
    const parts = entry.path.split('/');
    if (parts.shift() !== rootName || parts.length === 0) continue;
    const filename = parts.pop()!;
    let children = roots;
    let parentKey = rootName;
    for (const part of parts) {
      const key = `${parentKey}/${part}`;
      let directory = directories.get(key);
      if (!directory) {
        const semantic = labels.get(part);
        directory = {
          type: 'directory',
          key,
          name: part,
          label: semantic?.label ?? part,
          isOrphan: !semantic,
          children: [],
        };
        directories.set(key, directory);
        children.push(directory);
      }
      children = directory.children;
      parentKey = key;
    }
    children.push({
      type: 'file',
      key: entry.path,
      name: filename,
      path: `/topics/${topicSlug}/${entry.path}`,
      entry,
    });
  }

  sortTree(roots, labels);
  return roots;
}

export function collectCatalogFiles(nodes: CatalogTreeNode[]): CatalogTreeFile[] {
  const files: CatalogTreeFile[] = [];
  for (const node of nodes) {
    if (node.type === 'file') files.push(node);
    else files.push(...collectCatalogFiles(node.children));
  }
  return files;
}
