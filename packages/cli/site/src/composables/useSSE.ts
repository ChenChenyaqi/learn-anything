/* ------------------------------------------------------------------ */
/*  useSSE — Server-Sent Events connection with auto-reconnect          */
/*                                                                     */
/*  Creates an EventSource that listens for 'reload' messages and      */
/*  calls `onReload` when one arrives or when the connection restores  */
/*  after an error.  Uses exponential backoff for retries.              */
/* ------------------------------------------------------------------ */

export function createSSEListener(url: string, onReload: () => void): () => void {
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
        onReload();
      }
    });
    src.addEventListener('open', () => {
      retryDelay = 1000;
      if (reconnecting) {
        reconnecting = false;
        onReload();
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
