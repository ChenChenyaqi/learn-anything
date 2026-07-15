/* ------------------------------------------------------------------ */
/*  useSSE — Server-Sent Events connection with auto-reconnect          */
/*                                                                     */
/*  Creates an EventSource that listens for 'reload' messages and      */
/*  calls `onReload` when one arrives or when the connection restores  */
/*  after an error.  Uses exponential backoff for retries.              */
/* ------------------------------------------------------------------ */

export type SiteChangeEvent =
  | { type: 'topic-updated'; topicSlug: string }
  | { type: 'topics-updated' }
  | { type: 'reconnected' };

export function createSSEListener(
  url: string,
  onChange: (event: SiteChangeEvent) => void,
): () => void {
  let src: EventSource | null = null;
  let stopped = false;
  let retryDelay = 1000;
  let reconnecting = false;
  const MAX_RETRY_DELAY = 30000;

  function connect() {
    if (stopped) return;
    src = new EventSource(url);
    src.addEventListener('message', (e) => {
      if (e.data === 'reload') {
        retryDelay = 1000;
        onChange({ type: 'topics-updated' });
        return;
      }
      try {
        const event = JSON.parse(e.data) as SiteChangeEvent;
        if (event.type === 'topic-updated' || event.type === 'topics-updated') onChange(event);
      } catch {
        // Ignore heartbeat/forward-compatible messages.
      }
    });
    src.addEventListener('open', () => {
      retryDelay = 1000;
      if (reconnecting) {
        reconnecting = false;
        onChange({ type: 'reconnected' });
      }
    });
    src.onerror = () => {
      reconnecting = true;
      src?.close();
      src = null;
      if (!stopped) {
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
      }
    };
  }

  connect();
  return () => {
    stopped = true;
    src?.close();
  };
}
