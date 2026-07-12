// Single source of truth for the sidecar's wire contract — the Node-side
// mirror of the Rust `wire.rs` module. Every stdin/stdout frame type and
// schema lives here so the two ends cannot silently drift.
//
// The shared data models (AgentEvent / ChatRow / SessionMeta) come from
// `shared/protocol.ts`, which is also consumed by the Vue frontend.

import { z } from 'zod';

// Re-exported for convenience so sidecar modules import all wire types from
// one place. (Also imported below for local use in StdoutLine.)
import type { AgentEvent, ChatRow, SessionMeta } from '../../shared/protocol.ts';
export type { AgentEvent, ChatBlock, ChatRow, SessionMeta } from '../../shared/protocol.ts';

/* ------------------------------------------------------------------ */
/*  Inbound: Rust → sidecar                                           */
/* ------------------------------------------------------------------ */

/** Boot frame — the first stdin line. Has no `kind`; recognised via `apiKey`. */
export const BootConfigSchema = z.object({
  apiKey: z.string().min(1),
  provider: z.string().min(1),
  baseUrl: z.string().min(1).nullable().optional(),
  model: z.string().min(1),
  cwd: z.string().min(1),
  sessionId: z.string().nullable().optional(),
});
export type BootConfig = z.infer<typeof BootConfigSchema>;

/** Command frames — every stdin line after boot, discriminated by `kind`. */
export const AgentRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('user_message'),
    text: z.string(),
    sessionId: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('slash_command'),
    text: z.string(),
    sessionId: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('cancel'),
    sessionId: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('switch_session'),
    sessionId: z.string(),
    cwd: z.string().nullable().optional(),
    requestId: z.string(),
  }),
  z.object({
    kind: z.literal('list_sessions'),
    cwd: z.string(),
    requestId: z.string(),
  }),
  z.object({
    kind: z.literal('load_session'),
    sessionId: z.string(),
    cwd: z.string().nullable().optional(),
    requestId: z.string(),
  }),
]);
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

/* ------------------------------------------------------------------ */
/*  Outbound: sidecar → Rust                                          */
/* ------------------------------------------------------------------ */
// Typed but trusted: these are constructed locally (not parsed from
// untrusted input), so they are not zod-validated before emission.

export interface AgentEventJsonL {
  session_id: string;
  event: AgentEvent;
}

export type StdoutLine =
  | AgentEventJsonL
  | { type: 'session_id'; session_id: string }
  | { type: 'list_sessions_reply'; requestId: string; sessions: SessionMeta[] }
  | {
      type: 'load_session_reply';
      requestId: string;
      session_id: string;
      rows: ChatRow[];
      found: boolean;
    }
  | {
      type: 'switch_session_reply';
      requestId: string;
      session_id: string;
      ok: boolean;
    };
