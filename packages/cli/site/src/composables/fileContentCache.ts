/* ================================================================== */
/*  fileContentCache — on-demand file-content fetcher (LRU cache)      */
/*                                                                     */
/*  Separate from the topic indexes: hits /api/file and owns its own   */
/*  store. Capped at FILE_CACHE_MAX entries with LRU eviction.         */
/* ================================================================== */

const FILE_CACHE_MAX = 200;

const fileContents = new Map<string, string>();

/** Clear the cache (SSE-driven reload / test reset). */
export function clearFileContentCache(): void {
  fileContents.clear();
}

/** Seed the cache (test injection). */
export function setFileContent(path: string, content: string): void {
  fileContents.set(path, content);
}

export async function loadFileContent(path: string): Promise<string | null> {
  if (fileContents.has(path)) {
    // Re-insert on hit so the entry becomes most-recently-used; eviction
    // then removes the genuinely least-recently-used key (true LRU).
    const cached = fileContents.get(path)!;
    fileContents.delete(path);
    fileContents.set(path, cached);
    return cached;
  }
  try {
    const resp = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
    if (!resp.ok) return null;
    const text = await resp.text();
    if (fileContents.size >= FILE_CACHE_MAX) {
      const oldest = fileContents.keys().next().value;
      if (oldest) fileContents.delete(oldest);
    }
    fileContents.set(path, text);
    return text;
  } catch {
    return null;
  }
}

export const loadSessionContent = loadFileContent;
export const loadExerciseContent = loadFileContent;
