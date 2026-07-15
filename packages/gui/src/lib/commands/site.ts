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
