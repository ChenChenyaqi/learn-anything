// Agent sidecar commands — the Node sidecar proxied through Rust.
//
// Shared wire types live in `shared/protocol.ts` so the sidecar and frontend
// cannot drift; they are re-exported here so call sites can keep importing
// everything from `@/lib/commands`.
//
// NOTE: this module lives at `src/lib/commands/`, one level deeper than the old
// flat `commands.ts`, so the protocol import is `../../../shared/protocol`.

import { invoke } from '@tauri-apps/api/core';

import type { ChatRow, SessionMeta } from '../../../shared/protocol';

export type { AgentEvent, ChatBlock, ChatRow, SessionMeta } from '../../../shared/protocol';

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

/** Switch the sidecar's active session to `sessionId` (awaits confirmation). */
export const agentSwitchSession = (
  sessionId: string,
  workingFolder?: string | null,
): Promise<void> => invoke('agent_switch_session', { sessionId, workingFolder });
