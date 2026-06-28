import { ref, onBeforeUnmount, type Ref } from 'vue';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/* ------------------------------------------------------------------ */
/*  Composable                                                        */
/* ------------------------------------------------------------------ */

/**
 * Extract h2/h3 headings from a rendered DOM container and track the
 * active heading via IntersectionObserver scroll-spy.
 *
 * @param containerRef  Ref to the `.prose-content` element.
 * @returns Reactive heading list, active id, refresh() and scrollTo().
 */
export function useToc(containerRef: Ref<HTMLElement | null | undefined>) {
  const headings = ref<TocItem[]>([]);
  const activeId = ref<string>('');
  const isScrollingProgrammatically = ref(false);

  let observer: IntersectionObserver | null = null;
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  function refresh(): void {
    const container = containerRef.value;
    if (!container) {
      headings.value = [];
      return;
    }

    const els = Array.from(container.querySelectorAll<HTMLElement>('h2[id], h3[id]'));
    headings.value = els.map((el) => ({
      id: el.id,
      text: el.textContent?.replace(/^#\s*/, '').trim() ?? '',
      level: Number(el.tagName.substring(1)),
    }));

    observer?.disconnect();
    if (els.length === 0) return;

    observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingProgrammatically.value) return;
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length === 0) return;
        intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        activeId.value = intersecting[0]!.target.id;
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );

    els.forEach((el) => observer!.observe(el));
  }

  function scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    activeId.value = id;
    isScrollingProgrammatically.value = true;
    if (scrollTimer) clearTimeout(scrollTimer);
    const onScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        isScrollingProgrammatically.value = false;
        window.removeEventListener('scroll', onScroll);
        scrollTimer = null;
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    if (typeof history !== 'undefined') {
      history.replaceState(history.state, '', `#${id}`);
    }
  }

  onBeforeUnmount(() => {
    observer?.disconnect();
    if (scrollTimer) clearTimeout(scrollTimer);
  });

  return { headings, activeId, refresh, scrollTo };
}
