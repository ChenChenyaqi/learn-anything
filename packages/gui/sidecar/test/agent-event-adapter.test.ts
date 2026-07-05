import { describe, it, expect } from 'vitest';
import { mapPiEvent } from '../src/agent-event-adapter.ts';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

const SID = 'sess-123';

function ev(e: unknown): AgentSessionEvent {
  return e as AgentSessionEvent;
}

describe('mapPiEvent — 5-variant contract + edge cases', () => {
  it('message_update text_delta → text_delta', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_update',
          message: {},
          assistantMessageEvent: {
            type: 'text_delta',
            contentIndex: 0,
            delta: 'Hello',
            partial: {},
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "delta": "Hello",
          "type": "text_delta",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('message_update toolcall_end → tool_call', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_update',
          message: {},
          assistantMessageEvent: {
            type: 'toolcall_end',
            contentIndex: 1,
            toolCall: {
              type: 'toolCall',
              id: 'tc_1',
              name: 'bash',
              arguments: { command: 'ls -la' },
            },
            partial: {},
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "args": {
            "command": "ls -la",
          },
          "id": "tc_1",
          "name": "bash",
          "type": "tool_call",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('message_update thinking_delta → skipped', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_update',
          message: {},
          assistantMessageEvent: {
            type: 'thinking_delta',
            contentIndex: 0,
            delta: 'hmm',
            partial: {},
          },
        }),
      ),
    ).toMatchInlineSnapshot(`null`);
  });

  it('message_update text_start → skipped', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_update',
          message: {},
          assistantMessageEvent: { type: 'text_start', contentIndex: 0, partial: {} },
        }),
      ),
    ).toMatchInlineSnapshot(`null`);
  });

  it('tool_execution_end (ok, multi-text) → tool_result', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'tool_execution_end',
          toolCallId: 'tc_1',
          toolName: 'bash',
          result: {
            content: [
              { type: 'text', text: 'file1.txt' },
              { type: 'text', text: 'file2.txt' },
            ],
            details: {},
          },
          isError: false,
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "id": "tc_1",
          "name": "bash",
          "result": "file1.txtfile2.txt",
          "status": "ok",
          "type": "tool_result",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('tool_execution_end (isError) → tool_result status error', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'tool_execution_end',
          toolCallId: 'tc_2',
          toolName: 'write',
          result: { content: [{ type: 'text', text: 'Permission denied' }], details: {} },
          isError: true,
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "id": "tc_2",
          "name": "write",
          "result": "Permission denied",
          "status": "error",
          "type": "tool_result",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('tool_execution_end (no text content) → tool_result result null', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'tool_execution_end',
          toolCallId: 'tc_3',
          toolName: 'grep',
          result: { content: [{ type: 'image', url: 'data:...' }], details: {} },
          isError: false,
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "id": "tc_3",
          "name": "grep",
          "result": null,
          "status": "ok",
          "type": "tool_result",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('message_end (assistant, error) → error with errorMessage', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_end',
          message: {
            role: 'assistant',
            stopReason: 'error',
            errorMessage: 'rate limit exceeded',
            content: [],
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "message": "rate limit exceeded",
          "type": "error",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('message_end (assistant, aborted) → error "cancelled"', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_end',
          message: {
            role: 'assistant',
            stopReason: 'aborted',
            content: [],
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "message": "cancelled",
          "type": "error",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('message_end (assistant, error, no errorMessage) → "unknown error"', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_end',
          message: { role: 'assistant', stopReason: 'error', content: [] },
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "message": "unknown error",
          "type": "error",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('message_end (non-assistant) → skipped', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_end',
          message: { role: 'user', content: 'hi', timestamp: 0 },
        }),
      ),
    ).toMatchInlineSnapshot(`null`);
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_end',
          message: {
            role: 'toolResult',
            toolCallId: 'x',
            toolName: 'bash',
            content: [],
            isError: false,
            timestamp: 0,
          },
        }),
      ),
    ).toMatchInlineSnapshot(`null`);
  });

  it('message_end (assistant, stop/toolUse) → skipped', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_end',
          message: { role: 'assistant', stopReason: 'stop', content: [] },
        }),
      ),
    ).toMatchInlineSnapshot(`null`);
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'message_end',
          message: { role: 'assistant', stopReason: 'toolUse', content: [] },
        }),
      ),
    ).toMatchInlineSnapshot(`null`);
  });

  it('agent_end (willRetry false) → done', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'agent_end',
          messages: [],
          willRetry: false,
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "event": {
          "type": "done",
        },
        "session_id": "sess-123",
      }
    `);
  });

  it('agent_end (willRetry true) → skipped', () => {
    expect(
      mapPiEvent(
        SID,
        ev({
          type: 'agent_end',
          messages: [],
          willRetry: true,
        }),
      ),
    ).toMatchInlineSnapshot(`null`);
  });

  it('events with no frontend analogue → all skipped', () => {
    const skipped = [
      { type: 'agent_start' },
      { type: 'turn_start' },
      { type: 'turn_end', message: {}, toolResults: [] },
      { type: 'message_start', message: {} },
      { type: 'tool_execution_start', toolCallId: 'x', toolName: 'bash', args: {} },
      { type: 'queue_update', steering: [], followUp: [] },
      { type: 'compaction_start', reason: 'manual' },
      {
        type: 'compaction_end',
        reason: 'manual',
        result: undefined,
        aborted: false,
        willRetry: false,
      },
      { type: 'entry_appended', entry: {} },
      { type: 'auto_retry_start', attempt: 1, maxAttempts: 3, delayMs: 1000, errorMessage: 'err' },
      { type: 'auto_retry_end', success: true, attempt: 1 },
      { type: 'session_info_changed', name: 'test' },
      { type: 'thinking_level_changed', level: 'high' },
    ];
    for (const e of skipped) {
      expect(mapPiEvent(SID, ev(e))).toMatchInlineSnapshot(`null`);
    }
  });
});
