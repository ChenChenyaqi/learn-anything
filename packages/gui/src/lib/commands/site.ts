// Site dashboard commands — the learning-state readers that replaced `serve.mjs`.
//
// Types mirror the Rust `site_api::model` structs, which serialize to camelCase
// (see `#[serde(rename_all = "camelCase")]`). `SiteTopicSummary` is distinct
// from the `project` module's `TopicSummary`: the latter is the GUI shell's
// lightweight `{ slug, topic }` row from `open_project`; this one is the richer
// dashboard row carrying mastery stats + domain names for the overview.

import { invoke } from '@tauri-apps/api/core';

/**
 * Per-topic summary row returned by `site_topic_summaries`.
 * Mirrors Rust `site_api::model::TopicSummary` (camelCase serialization).
 */
export interface SiteTopicSummary {
  slug: string;
  name: string;
  domainCount: number;
  totalConcepts: number;
  masteredCount: number;
  percentage: number;
  /** Ordered domain display names — drives the overview's description line. */
  domainNames: string[];
}

/**
 * List summary rows for every readable topic in the working folder.
 * `Err("404|No working folder")` when none has been chosen yet.
 *
 * `workingFolder` overrides `AppConfig.last_working_folder`; omit/`null` to use
 * the persisted default (matching the Rust `Option<String>` contract).
 */
export const siteTopicSummaries = (workingFolder?: string | null): Promise<SiteTopicSummary[]> =>
  invoke('site_topic_summaries', { workingFolder });

/**
 * (Re)point the filesystem watcher at `<working_folder>/.learn/topics` so
 * `site://reload` events keep firing after a folder change. The watcher is
 * single-instance — calling again swaps the previous one out.
 */
export const siteSetWatcherFolder = (workingFolder: string): Promise<void> =>
  invoke('site_set_watcher_folder', { workingFolder });

// ------------------------------------------------------------------
//  Topic data (site_topic_data)
//
//  The full per-topic payload. Mirrors Rust `site_api::model::TopicData`:
//  - `TopicData` + `ExerciseGroup` serialize camelCase (`rename_all`).
//  - `StateV1` / `Domain` / `Concept` have NO `rename_all` → field names
//    match the on-disk `state.json` verbatim (snake_case).
//  - `sessions` / `rootSessions` / `exercises` / `rootExercises` are
//    `skip_serializing_if = empty` on the Rust side, so they are ABSENT from
//    the JSON when empty — typed optional here.
// ------------------------------------------------------------------

/** Canonical concept mastery values (Rust stores these as a plain `String`). */
export type ConceptStatus = 'mastered' | 'in_progress' | 'needs_practice' | 'unexplored';

/** A single concept inside a domain. Field names mirror on-disk `state.json`. */
export interface Concept {
  name: string;
  slug: string;
  status: ConceptStatus;
  confidence: number;
  practice_count: number;
  explain_count: number;
  last_explained: string | null;
  last_practiced: string | null;
  details: string[];
}

/** A cluster of concepts. `slug` keys the `sessions/` subdirectory. */
export interface Domain {
  name: string;
  slug: string;
  concepts: Concept[];
}

/** Lifted from `<topic>/state.json`. Field names mirror the on-disk JSON. */
export interface StateV1 {
  version: number | null;
  topic: string;
  slug: string;
  created: string;
  domains: Domain[];
}

/** A `.md` note under `sessions/`. No `rename_all` → `filename`, `path`. */
export interface SessionFile {
  filename: string;
  /** API path `/topics/<slug>/sessions/<rel>` — usable with `siteFileContent`. */
  path: string;
}

/** A code/asset file under `exercises/`. No `rename_all` → `name`, `path`. */
export interface ExerciseFile {
  name: string;
  /** API path `/topics/<slug>/exercises/<rel>` — usable with `siteFileContent`. */
  path: string;
}

/** Exercises grouped by concept (camelCase via `rename_all`). */
export interface ExerciseGroup {
  conceptSlug: string;
  conceptName: string;
  files: ExerciseFile[];
}

/**
 * Full payload for one topic, returned by `site_topic_data`.
 * `sessions`/`rootSessions`/`exercises`/`rootExercises` are omitted by the
 * backend when empty, hence optional. `state` + `knowledgeMap` are always
 * present (`knowledgeMap` is `""` when `knowledge-map.md` is absent).
 */
export interface TopicData {
  state: StateV1;
  knowledgeMap: string;
  sessions?: Record<string, SessionFile[]>;
  rootSessions?: SessionFile[];
  exercises?: ExerciseGroup[];
  rootExercises?: ExerciseFile[];
}

/**
 * Fetch the full payload for one topic. Resolves `null` when the working
 * folder is unset or the topic directory doesn't exist; rejects with a
 * `"code|message"` string otherwise.
 *
 * `workingFolder` overrides `AppConfig.last_working_folder`; omit/`null` to
 * use the persisted default (matching the Rust `Option<String>` contract).
 */
export const siteTopicData = (
  slug: string,
  workingFolder?: string | null,
): Promise<TopicData | null> => invoke('site_topic_data', { slug, workingFolder });

/**
 * Read a note/exercise file at an API path (e.g.
 * `/topics/rust/sessions/basics/lifetimes.md`). Resolves `null` for a valid
 * but missing path (404); rejects `"403|Forbidden"` for traversal attempts.
 */
export const siteFileContent = (
  path: string,
  workingFolder?: string | null,
): Promise<string | null> => invoke('site_file_content', { path, workingFolder });
