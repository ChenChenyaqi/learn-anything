// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, h, ref } from 'vue';
import { useToc, type TocItem } from '../../site/src/composables/useToc';

/* ------------------------------------------------------------------ */
/*  Helpers — run composable inside a real component lifecycle        */
/* ------------------------------------------------------------------ */

interface Scope<T> {
  result: T;
  unmount: () => void;
}

function withScope<T>(fn: () => T): Scope<T> {
  let result!: T;
  const Wrapper = defineComponent({
    setup() {
      result = fn();
      return () => h('div');
    },
  });
  const app = createApp(Wrapper);
  const host = document.createElement('div');
  app.mount(host);
  return { result, unmount: () => app.unmount() };
}

/** Create a heading element exactly as markdown-it-anchor renders it. */
function heading(
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
  id: string,
  text: string,
): HTMLElement {
  const el = document.createElement(tag);
  el.id = id;
  el.tabIndex = -1;
  const anchor = document.createElement('a');
  anchor.className = 'header-anchor';
  anchor.href = `#${id}`;
  anchor.textContent = '#';
  el.appendChild(anchor);
  el.appendChild(document.createTextNode(text));
  return el;
}

/* ------------------------------------------------------------------ */
/*  IntersectionObserver mock                                         */
/* ------------------------------------------------------------------ */

let ioCallback: IntersectionObserverCallback | null = null;
let ioDisconnects = 0;
let ioObserved: Element[] = [];

class MockIO {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
    ioObserved = [];
  }
  observe(el: Element) {
    ioObserved.push(el);
  }
  unobserve() {}
  disconnect() {
    ioDisconnects++;
  }
  takeRecords() {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                  */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  ioCallback = null;
  ioDisconnects = 0;
  ioObserved = [];
  vi.stubGlobal('IntersectionObserver', MockIO);
  // jsdom does not implement scrollIntoView — define as spy
  Element.prototype.scrollIntoView = vi.fn(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/* ================================================================== */
/*  refresh() — heading extraction                                    */
/* ================================================================== */

describe('useToc — refresh()', () => {
  it('returns empty when container is null', () => {
    const containerRef = ref<HTMLElement | null>(null);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(result.headings.value).toEqual([]);
  });

  it('extracts h2 and h3 with ids', () => {
    const host = document.createElement('div');
    host.appendChild(heading('h2', 'h-alpha', 'Alpha'));
    host.appendChild(heading('h3', 'h-beta', 'Beta'));
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(result.headings.value).toEqual<TocItem[]>([
      { id: 'h-alpha', text: 'Alpha', level: 2 },
      { id: 'h-beta', text: 'Beta', level: 3 },
    ]);
  });

  it('ignores h1, h4, h5, h6', () => {
    const host = document.createElement('div');
    host.appendChild(heading('h1', 'h-title', 'Title'));
    host.appendChild(heading('h2', 'h-keep', 'Keep'));
    host.appendChild(heading('h4', 'h-skip', 'Skip'));
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(result.headings.value).toHaveLength(1);
    expect(result.headings.value[0]!.id).toBe('h-keep');
  });

  it('ignores headings without id', () => {
    const h2NoId = document.createElement('h2');
    h2NoId.textContent = 'No ID';
    const host = document.createElement('div');
    host.appendChild(h2NoId);
    host.appendChild(heading('h2', 'h-has-id', 'Has ID'));
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(result.headings.value).toHaveLength(1);
    expect(result.headings.value[0]!.id).toBe('h-has-id');
  });

  it('strips the leading # from the anchor permalink', () => {
    const host = document.createElement('div');
    host.appendChild(heading('h2', 'h-foo', 'Hello World'));
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(result.headings.value[0]!.text).toBe('Hello World');
  });

  it('handles CJK heading text', () => {
    const host = document.createElement('div');
    host.appendChild(heading('h2', 'h-rumen', '入门指南'));
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(result.headings.value[0]!.text).toBe('入门指南');
  });

  it('returns empty when container has no h2/h3', () => {
    const host = document.createElement('div');
    host.appendChild(document.createElement('p')).textContent = 'No headings';
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(result.headings.value).toEqual([]);
  });
});

/* ================================================================== */
/*  IntersectionObserver integration                                  */
/* ================================================================== */

describe('useToc — observer', () => {
  it('observes each extracted heading element', () => {
    const host = document.createElement('div');
    const h2a = heading('h2', 'h-a', 'A');
    const h2b = heading('h2', 'h-b', 'B');
    host.appendChild(h2a);
    host.appendChild(h2b);
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(ioObserved).toContain(h2a);
    expect(ioObserved).toContain(h2b);
  });

  it('does not create an observer when there are no headings', () => {
    const host = document.createElement('div');
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    expect(ioCallback).toBeNull();
  });

  it('updates activeId to the topmost intersecting heading', () => {
    const host = document.createElement('div');
    const h2a = heading('h2', 'h-a', 'A');
    const h2b = heading('h2', 'h-b', 'B');
    host.appendChild(h2a);
    host.appendChild(h2b);
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();

    expect(ioCallback).not.toBeNull();
    ioCallback!([
      {
        target: h2b,
        isIntersecting: true,
        boundingClientRect: { top: 100 } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
      {
        target: h2a,
        isIntersecting: true,
        boundingClientRect: { top: 50 } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
    ]);
    expect(result.activeId.value).toBe('h-a');
  });

  it('ignores entries that are not intersecting', () => {
    const host = document.createElement('div');
    const h2 = heading('h2', 'h-foo', 'Foo');
    host.appendChild(h2);
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();

    result.activeId.value = 'h-foo';
    ioCallback!([
      {
        target: h2,
        isIntersecting: false,
        boundingClientRect: { top: 999 } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
    ]);
    expect(result.activeId.value).toBe('h-foo');
  });

  it('disconnects previous observer on re-refresh', () => {
    const host = document.createElement('div');
    host.appendChild(heading('h2', 'h-a', 'A'));
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));
    result.refresh();
    result.refresh();
    expect(ioDisconnects).toBeGreaterThanOrEqual(1);
  });

  it('disconnects observer on component unmount', () => {
    const host = document.createElement('div');
    host.appendChild(heading('h2', 'h-a', 'A'));
    const containerRef = ref(host);
    const { result, unmount } = withScope(() => useToc(containerRef));
    result.refresh();
    const before = ioDisconnects;
    unmount();
    expect(ioDisconnects).toBeGreaterThan(before);
  });
});

/* ================================================================== */
/*  scrollTo()                                                        */
/* ================================================================== */

describe('useToc — scrollTo()', () => {
  it('scrolls the target element into view smoothly', () => {
    const host = document.createElement('div');
    const h2 = heading('h2', 'h-target', 'Target');
    host.appendChild(h2);
    document.body.appendChild(h2);
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));

    result.scrollTo('h-target');
    expect(h2.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    document.body.removeChild(h2);
  });

  it('updates activeId immediately', () => {
    const host = document.createElement('div');
    const h2 = heading('h2', 'h-now', 'Now');
    host.appendChild(h2);
    document.body.appendChild(h2);
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));

    result.scrollTo('h-now');
    expect(result.activeId.value).toBe('h-now');
    document.body.removeChild(h2);
  });

  it('replaces URL hash via history.replaceState', () => {
    const host = document.createElement('div');
    const h2 = heading('h2', 'h-link', 'Link');
    host.appendChild(h2);
    document.body.appendChild(h2);
    const replaceSpy = vi.spyOn(history, 'replaceState');
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));

    result.scrollTo('h-link');
    expect(replaceSpy).toHaveBeenCalledWith(null, '', '#h-link');
    document.body.removeChild(h2);
  });

  it('is a no-op when element does not exist', () => {
    const host = document.createElement('div');
    const containerRef = ref(host);
    const { result } = withScope(() => useToc(containerRef));

    const replaceSpy = vi.spyOn(history, 'replaceState');
    result.scrollTo('h-nonexistent');
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
