import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSEListener } from '@/composables/useSSE';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, data = '') {
    for (const listener of this.listeners.get(type) ?? []) listener({ data } as MessageEvent);
  }
}

describe('SSE change events', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('parses structured topic events and supports legacy reload messages', () => {
    const onChange = vi.fn();
    createSSEListener('/api/events', onChange);
    const source = FakeEventSource.instances[0];

    source.emit('message', JSON.stringify({ type: 'topic-updated', topicSlug: 'javascript' }));
    source.emit('message', 'reload');

    expect(onChange).toHaveBeenNthCalledWith(1, {
      type: 'topic-updated',
      topicSlug: 'javascript',
    });
    expect(onChange).toHaveBeenNthCalledWith(2, { type: 'topics-updated' });
  });

  it('signals reconciliation after reconnecting', () => {
    const onChange = vi.fn();
    createSSEListener('/api/events', onChange);
    FakeEventSource.instances[0].onerror?.();
    vi.advanceTimersByTime(1000);
    FakeEventSource.instances[1].emit('open');
    expect(onChange).toHaveBeenCalledWith({ type: 'reconnected' });
  });
});
