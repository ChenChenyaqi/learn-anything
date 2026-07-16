// Pure topic-tree builder.
//
// `site_topic_data` returns two independently-keyed file axes: sessions grouped
// by the domain directory name (i.e. the domain `slug`) and exercises grouped
// by concept `slug`. The design mockup unifies them under one cluster per
// domain, so this module reconciles the two: each domain becomes a cluster
// carrying its sessions (matched by `slug`) and the exercises of the concepts
// it owns. Orphan session dirs, orphan exercise concepts and top-level (root)
// files — none of which belong to a declared domain — are surfaced as their own
// trailing clusters so every file on disk is reachable, honestly reflecting the
// directory it lives in.

import type { Domain, ExerciseFile, SessionFile, TopicData } from '@/lib/commands';

export interface ClusterNode {
  /** Display label (domain name, orphan dir/concept name, or `其他` for root). */
  name: string;
  /** Stable, unique key for v-for / expansion state. Prefixed for orphans. */
  slug: string;
  /** `true` when the cluster is NOT backed by a `state.json` domain. */
  isOrphan: boolean;
  /** Concepts with `status === 'mastered'` (0 for orphan clusters). */
  mastered: number;
  /** Total concepts in the domain (0 for orphan clusters). */
  total: number;
  sessions: SessionFile[];
  exercises: ExerciseFile[];
}

/** Sentinel slug for the trailing top-level-files cluster. */
export const ROOT_CLUSTER_SLUG = '__root__';

/**
 * Build the unified cluster list from a topic payload. Returns `[]` for a null
 * payload (no folder / topic missing). Order: declared domains (state.json
 * order) → orphan session dirs → orphan exercise concepts → top-level files.
 */
export function buildTopicTree(data: TopicData | null): ClusterNode[] {
  if (!data) return [];

  const domains: Domain[] = data.state.domains ?? [];
  const sessionsByDir = data.sessions ?? {};
  const exerciseGroups = data.exercises ?? [];

  // concept slug → owning domain index, so exercise groups route back home.
  const conceptOwner = new Map<string, number>();
  domains.forEach((d, di) => {
    for (const c of d.concepts) conceptOwner.set(c.slug, di);
  });
  const knownDirSlugs = new Set(domains.map((d) => d.slug));

  // 1. One cluster per declared domain (always emitted, even when empty).
  const clusters: ClusterNode[] = domains.map((d) => {
    const ownedSlugs = new Set(d.concepts.map((c) => c.slug));
    const exercises: ExerciseFile[] = [];
    for (const g of exerciseGroups) {
      if (ownedSlugs.has(g.conceptSlug)) exercises.push(...g.files);
    }
    return {
      name: d.name,
      slug: d.slug,
      isOrphan: false,
      mastered: d.concepts.filter((c) => c.status === 'mastered').length,
      total: d.concepts.length,
      sessions: sessionsByDir[d.slug] ?? [],
      exercises,
    };
  });

  // 2. Orphan session dirs — a folder whose name matches no domain slug.
  for (const dir of Object.keys(sessionsByDir)) {
    if (knownDirSlugs.has(dir)) continue;
    clusters.push({
      name: dir,
      slug: 's:' + dir,
      isOrphan: true,
      mastered: 0,
      total: 0,
      sessions: sessionsByDir[dir] ?? [],
      exercises: [],
    });
  }

  // 3. Orphan exercise groups — a concept that belongs to no domain.
  for (const g of exerciseGroups) {
    if (conceptOwner.has(g.conceptSlug)) continue;
    clusters.push({
      name: g.conceptName || g.conceptSlug,
      slug: 'x:' + g.conceptSlug,
      isOrphan: true,
      mastered: 0,
      total: 0,
      sessions: [],
      exercises: g.files,
    });
  }

  // 4. Top-level (root) files — directly under sessions/ or exercises/.
  const rootSessions = data.rootSessions ?? [];
  const rootExercises = data.rootExercises ?? [];
  if (rootSessions.length > 0 || rootExercises.length > 0) {
    clusters.push({
      name: '其他',
      slug: ROOT_CLUSTER_SLUG,
      isOrphan: true,
      mastered: 0,
      total: 0,
      sessions: rootSessions,
      exercises: rootExercises,
    });
  }

  return clusters;
}
