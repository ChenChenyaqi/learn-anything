// Reading pi-agent session data off disk and converting it into the wire
// models consumed by the frontend. Used by the `list_sessions` and
// `load_session` replies.

import { SessionManager, type SessionInfo } from '@earendil-works/pi-coding-agent';
import { type TextContent } from '@earendil-works/pi-ai';

import type { ChatBlock, ChatRow, SessionMeta } from './wire.ts';

type SessionMessages = ReturnType<SessionManager['buildSessionContext']>['messages'];

function isText(content: unknown): content is TextContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as { type?: string }).type === 'text'
  );
}

function joinText(contents: Array<{ type: string }>): string {
  return contents
    .filter(isText)
    .map((part) => (part as TextContent).text)
    .join('');
}

/** Summarise one on-disk session as the wire `SessionMeta` (for listings). */
export function toSessionMeta(info: SessionInfo): SessionMeta {
  return {
    id: info.id,
    title: info.name ?? info.firstMessage,
    created_at: info.created.toISOString(),
    updated_at: info.modified.toISOString(),
    message_count: info.messageCount,
  };
}

/** Convert pi-agent message history into the wire `ChatRow[]` transcript. */
export function messagesToChatRows(messages: SessionMessages): ChatRow[] {
  const toolOutcomes = new Map<string, { status: 'ok' | 'error'; result: string | null }>();
  for (const message of messages) {
    if (message.role === 'toolResult') {
      toolOutcomes.set(message.toolCallId, {
        status: message.isError ? 'error' : 'ok',
        result: joinText(message.content),
      });
    }
  }

  const rows: ChatRow[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      const text =
        typeof message.content === 'string' ? message.content : joinText(message.content);
      rows.push({ role: 'user', text });
      continue;
    }
    if (message.role === 'assistant') {
      const blocks: ChatBlock[] = [];
      for (const part of message.content) {
        if (part.type === 'text') {
          blocks.push({ type: 'text', text: part.text });
          continue;
        }
        if (part.type === 'toolCall') {
          const outcome = toolOutcomes.get(part.id);
          if (!outcome) continue;
          blocks.push({
            type: 'tool_call',
            id: part.id,
            name: part.name,
            args: part.arguments,
            status: outcome.status,
            result: outcome.result,
          });
        }
      }
      if (blocks.length > 0) {
        rows.push({ role: 'assistant', blocks });
      }
    }
  }
  return rows;
}

/** Load a session's transcript rows by id, or null if the session is gone. */
export async function loadSessionRows(sessionId: string, cwd: string): Promise<ChatRow[] | null> {
  const sessions = await SessionManager.list(cwd);
  const target = sessions.find((info) => info.id === sessionId);
  if (!target) return null;
  const manager = SessionManager.open(target.path);
  const { messages } = manager.buildSessionContext();
  return messagesToChatRows(messages);
}
