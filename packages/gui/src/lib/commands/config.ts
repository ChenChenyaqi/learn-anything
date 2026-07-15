// appData config commands: provider, model, base_url, working folder, api_key.
//
// Typed wrappers around the config-related Tauri commands registered in
// src-tauri. Field names match the Rust serde field names exactly (snake_case),
// because `AppConfig` is (de)serialized by serde with no rename.

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
