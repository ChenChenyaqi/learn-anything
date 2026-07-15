// Working-folder selection / validation / scaffolding commands.
//
// `TopicSummary` here is the lightweight row returned by the GUI shell's
// `project::open_project` validator (snake_case, `{ slug, topic }`). It is
// distinct from the richer site_api summary (see `./site`) — the two surfaces
// stay independent by design, mirroring the Rust split between `project.rs`
// and `site_api`.

import { invoke } from '@tauri-apps/api/core';

/** One readable v1 topic inside a working folder, mirrored from `project::TopicSummary`. */
export interface TopicSummary {
  slug: string;
  topic: string;
}

/** Result of validating a working folder, mirrored from `project::ProjectInfo`. */
export interface ProjectInfo {
  dir: string;
  fresh: boolean;
  topics: TopicSummary[];
}

/* ── working-folder selection / validation / creation ───────────────── */

/** Open a native folder picker; returns the chosen path or `null` on cancel. */
export const pickProjectDir = (): Promise<string | null> => invoke('pick_project_dir');

/** Validate a working folder and list its readable v1 topics. */
export const openProject = (dir: string): Promise<ProjectInfo> => invoke('open_project', { dir });

/** Ensure `<dir>/.learn/topics/` exists. Idempotent. */
export const createProject = (dir: string): Promise<string> => invoke('create_project', { dir });
