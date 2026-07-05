import type { AgentEvent, SelectSessionPayload, StdoutLine, UiRequestKind } from './types.ts';

export function emitLine(payload: StdoutLine): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function emitAgentEvent(sessionId: string, event: AgentEvent): void {
  emitLine({ session_id: sessionId, event });
}

export function emitUiRequest(
  requestId: string,
  kind: UiRequestKind,
  payload: SelectSessionPayload,
): void {
  emitLine({ type: 'ui_request', request_id: requestId, kind, payload });
}
