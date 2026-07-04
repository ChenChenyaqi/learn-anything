// Typed wrappers around every Tauri command registered in src-tauri.
//
// Centralizing them here keeps the Rust↔TS contract in one file: components
// import typed functions instead of scattering raw `invoke(...)` strings that
// can silently drift from the Rust command names/signatures.
//
// Field names match the Rust serde field names exactly (snake_case), because
// `AppConfig`/`ProjectInfo`/etc. are (de)serialized by serde with no rename.

import { invoke } from '@tauri-apps/api/core';

/** LLM provider. Serialized lowercase by the Rust `Provider` enum. */
export type Provider = 'openai' | 'anthropic';

/** Non-secret app config, mirrored from `config::AppConfig`. */
export interface AppConfig {
  provider: Provider;
  model: string;
  base_url: string | null;
  last_working_folder: string | null;
}

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

/* ── keychain (OS keychain) ─────────────────────────────────────────── */

/** Whether a key is currently stored (decides setup vs. chat view). */
export const hasKey = (): Promise<boolean> => invoke('has_key');

/** Masked preview of the stored key (e.g. `sk-…7X2J`), or `null` if none. */
export const loadKey = (): Promise<string | null> => invoke('load_key');

/** Store the API key in the OS keychain. */
export const saveKey = (key: string): Promise<void> => invoke('save_key', { key });

/** Delete the stored API key. */
export const deleteKey = (): Promise<void> => invoke('delete_key');

/* ── appData config (non-secret) ────────────────────────────────────── */

export const getConfig = (): Promise<AppConfig> => invoke('get_config');
export const setConfig = (config: AppConfig): Promise<void> => invoke('set_config', { config });

/* ── working-folder selection / validation / creation ───────────────── */

/** Open a native folder picker; returns the chosen path or `null` on cancel. */
export const pickProjectDir = (): Promise<string | null> => invoke('pick_project_dir');

/** Validate a working folder and list its readable v1 topics. */
export const openProject = (dir: string): Promise<ProjectInfo> => invoke('open_project', { dir });

/** Ensure `<dir>/.learn/topics/` exists. Idempotent. */
export const createProject = (dir: string): Promise<string> => invoke('create_project', { dir });
