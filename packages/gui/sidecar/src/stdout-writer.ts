import type { AgentEvent, StdoutLine } from './types.ts';

export function emitLine(payload: StdoutLine): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function emitAgentEvent(sessionId: string, event: AgentEvent): void {
  emitLine({ session_id: sessionId, event });
}
