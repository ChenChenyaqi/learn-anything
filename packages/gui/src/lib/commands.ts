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
  /** Plaintext LLM API key, stored alongside the rest of the config. */
  api_key: string | null;
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

/* ── appData config (provider, model, base_url, working folder, api_key) ─ */

export const getConfig = (): Promise<AppConfig> => invoke('get_config');
export const setConfig = (config: AppConfig): Promise<void> => invoke('set_config', { config });

/* ── key display helper ────────────────────────────────────────────── */

/**
 * Produce a non-secret preview of a key for display, e.g. `sk-…7X2J`.
 *
 * The raw key now lives in plaintext config (the opencode / claude code
 * convention); masking is purely a display-layer courtesy to avoid
 * shoulder-surfing / screenshots. Short keys are fully hidden, longer ones
 * show only the first 3 and last 4 characters.
 */
export function maskKey(key: string): string {
  const chars = [...key];
  const len = chars.length;
  if (len <= 8) return `•••• (${len} chars)`;
  return `${chars.slice(0, 3).join('')}…${chars.slice(len - 4).join('')}`;
}

/* ── working-folder selection / validation / creation ───────────────── */

/** Open a native folder picker; returns the chosen path or `null` on cancel. */
export const pickProjectDir = (): Promise<string | null> => invoke('pick_project_dir');

/** Validate a working folder and list its readable v1 topics. */
export const openProject = (dir: string): Promise<ProjectInfo> => invoke('open_project', { dir });

/** Ensure `<dir>/.learn/topics/` exists. Idempotent. */
export const createProject = (dir: string): Promise<string> => invoke('create_project', { dir });

/* ── agent sidecar (pi Node sidecar proxied through Rust) ───────────── */

// Shared wire types live in `shared/protocol.ts` so the sidecar and frontend
// cannot drift. Re-exported here so existing `import ... from '@/lib/commands'`
// call sites keep working.
import type { ChatRow, SessionMeta } from '../../shared/protocol';

export type { AgentEvent, ChatBlock, ChatRow, SessionMeta } from '../../shared/protocol';

/**
 * Frontend alias for a transcript row. `useAgentSession.messages` holds
 * `ChatMessage[]` — structurally identical to `ChatRow` but named to convey
 * "live in-memory message" rather than "wire-restore row".
 */
export type ChatMessage = ChatRow;

/** Boot (or re-enter) a sidecar session for the given working folder. */
export const agentNewSession = (workingFolder?: string | null): Promise<{ session_id: string }> =>
  invoke('agent_new_session', { workingFolder });

/** Send a user message to the active session (returns immediately). */
export const agentSend = (sessionId: string, text: string): Promise<void> =>
  invoke('agent_send', { sessionId, text });

/** Cancel the in-flight run for a session. */
export const agentCancel = (sessionId: string): Promise<void> =>
  invoke('agent_cancel', { sessionId });

/** List persisted sessions for a working folder. */
export const agentListSessions = (workingFolder?: string | null): Promise<SessionMeta[]> =>
  invoke('agent_list_sessions', { workingFolder });

/** Restore a session's transcript rows. */
export const agentLoadSession = (
  sessionId: string,
  workingFolder?: string | null,
): Promise<ChatRow[]> => invoke('agent_load_session', { sessionId, workingFolder });

/** Reply to a sidecar `ui_request` (e.g. session picker). */
export const agentReplyUi = (requestId: string, value: unknown): Promise<void> =>
  invoke('agent_reply_ui', { requestId, value });
