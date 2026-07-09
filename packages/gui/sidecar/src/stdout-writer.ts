import type { AgentEvent, StdoutLine } from './types.ts';

function hhmmss(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export function log(msg: string): void {
  process.stderr.write(`${hhmmss()} [node] ${msg}\n`);
}

export function maskKey(key: string): string {
  const chars = [...key];
  if (chars.length <= 4) return '***';
  return '***' + chars.slice(-4).join('');
}

function describeAgentEvent(event: AgentEvent): string {
  switch (event.type) {
    case 'text_delta':
      return `text_delta, ${[...event.delta].length} chars`;
    case 'tool_call':
      return `tool_call, id=${event.id}, name=${event.name}`;
    case 'tool_result':
      return event.result == null
        ? `tool_result, id=${event.id}, name=${event.name}, ${event.status}`
        : `tool_result, id=${event.id}, name=${event.name}, ${event.status}, ${[...event.result].length} chars`;
    case 'done':
      return 'done';
    case 'error':
      return `error, ${event.message}`;
  }
}

function describeOutbound(payload: StdoutLine): string {
  if ('event' in payload) {
    return `agent_event (sid=${payload.session_id}, ${describeAgentEvent(payload.event)})`;
  }
  switch (payload.type) {
    case 'session_id':
      return `session_id (${payload.session_id})`;
    case 'list_sessions_reply':
      return `list_sessions_reply (req=${payload.requestId}, ${payload.sessions.length} sessions)`;
    case 'load_session_reply':
      return `load_session_reply (req=${payload.requestId}, sid=${payload.session_id}, ${payload.rows.length} rows, found=${payload.found})`;
    case 'switch_session_reply':
      return `switch_session_reply (req=${payload.requestId}, sid=${payload.session_id}, ok=${payload.ok})`;
  }
}

function isSuppressedEvent(payload: StdoutLine): boolean {
  return (
    'event' in payload &&
    (payload.event.type === 'text_delta' ||
      payload.event.type === 'tool_call' ||
      payload.event.type === 'tool_result')
  );
}

export function emitLine(payload: StdoutLine): void {
  if (!isSuppressedEvent(payload)) {
    log(`→ stdout  ${describeOutbound(payload)}`);
  }
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function emitAgentEvent(sessionId: string, event: AgentEvent): void {
  emitLine({ session_id: sessionId, event });
}
