import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import type { AgentEvent, AgentEventJsonL } from './types.ts';

export function mapPiEvent(sessionId: string, event: AgentSessionEvent): AgentEventJsonL | null {
  switch (event.type) {
    case 'message_update': {
      const sub = event.assistantMessageEvent;
      if (sub.type === 'text_delta') {
        return wrap(sessionId, { type: 'text_delta', delta: sub.delta });
      }
      if (sub.type === 'toolcall_end') {
        return wrap(sessionId, {
          type: 'tool_call',
          id: sub.toolCall.id,
          name: sub.toolCall.name,
          args: sub.toolCall.arguments,
        });
      }
      return null;
    }
    case 'tool_execution_end': {
      return wrap(sessionId, {
        type: 'tool_result',
        id: event.toolCallId,
        name: event.toolName,
        status: event.isError ? 'error' : 'ok',
        result: stringifyToolResult(event.result),
      });
    }
    case 'message_end': {
      if (event.message.role !== 'assistant') return null;
      const msg = event.message;
      if (msg.stopReason === 'aborted') {
        return wrap(sessionId, { type: 'error', message: 'cancelled' });
      }
      if (msg.stopReason === 'error') {
        return wrap(sessionId, {
          type: 'error',
          message: msg.errorMessage ?? 'unknown error',
        });
      }
      return null;
    }
    case 'agent_end': {
      if (event.willRetry) return null;
      return wrap(sessionId, { type: 'done' });
    }
    default:
      return null;
  }
}

function wrap(sessionId: string, event: AgentEvent): AgentEventJsonL {
  return { session_id: sessionId, event };
}

function stringifyToolResult(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const texts: string[] = [];
  for (const part of content) {
    if (typeof part === 'object' && part !== null && (part as { type?: string }).type === 'text') {
      const text = (part as { text?: string }).text;
      if (typeof text === 'string') texts.push(text);
    }
  }
  if (texts.length === 0) return null;
  return texts.join('');
}
