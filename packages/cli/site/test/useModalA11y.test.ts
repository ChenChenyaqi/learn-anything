// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, h, ref, nextTick, type Ref } from 'vue';
import { useModalA11y } from '@/composables/useModalA11y';

/* ------------------------------------------------------------------ */
/*  Mount helper — exposes the `open` ref and unmount control           */
/* ------------------------------------------------------------------ */

interface Mounted {
  open: Ref<boolean>;
  unmount: () => void;
}

/** Drain the full microtask queue (the focus restore is scheduled via a
 *  nested nextTick inside the watcher, so a single `await nextTick()` is
 *  not enough to observe it). */
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mountModal(onKeydown?: (e: KeyboardEvent) => void): Mounted {
  const open = ref(false);
  const Wrapper = defineComponent({
    setup() {
      useModalA11y(open, onKeydown ? { onKeydown } : {});
      return () => h('div');
    },
  });
  const app = createApp(Wrapper);
  const host = document.createElement('div');
  app.mount(host);
  return { open, unmount: () => app.unmount() };
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

/* ================================================================== */
/*  Body scroll lock                                                   */
/* ================================================================== */

describe('useModalA11y — scroll lock', () => {
  it('locks body scroll when opened', async () => {
    const { open } = mountModal();
    expect(document.body.style.overflow).toBe('');

    open.value = true;
    await nextTick();

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when closed', async () => {
    const { open } = mountModal();
    open.value = true;
    await nextTick();

    open.value = false;
    await nextTick();

    expect(document.body.style.overflow).toBe('');
  });

  it('toggles correctly across multiple open/close cycles', async () => {
    const { open } = mountModal();
    for (let i = 0; i < 3; i++) {
      open.value = true;
      await nextTick();
      expect(document.body.style.overflow).toBe('hidden');

      open.value = false;
      await nextTick();
      expect(document.body.style.overflow).toBe('');
    }
  });
});

/* ================================================================== */
/*  Global keydown listener                                            */
/* ================================================================== */

describe('useModalA11y — global keydown', () => {
  it('registers the handler on open and forwards events', async () => {
    const onKeydown = vi.fn();
    const { open } = mountModal(onKeydown);

    open.value = true;
    await nextTick();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onKeydown).toHaveBeenCalledOnce();
  });

  it('removes the handler on close (no forwarding after close)', async () => {
    const onKeydown = vi.fn();
    const { open } = mountModal(onKeydown);

    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onKeydown).not.toHaveBeenCalled();
  });

  it('does not register a keydown listener when no handler is given', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const { open } = mountModal();

    open.value = true;
    await nextTick();

    expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    addSpy.mockRestore();
  });

  it('re-registers the handler when re-opened', async () => {
    const onKeydown = vi.fn();
    const { open } = mountModal(onKeydown);

    open.value = true;
    await nextTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onKeydown).toHaveBeenCalledTimes(1);

    open.value = false;
    await nextTick();

    open.value = true;
    await nextTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onKeydown).toHaveBeenCalledTimes(2);
  });
});

/* ================================================================== */
/*  Focus save / restore                                               */
/* ================================================================== */

describe('useModalA11y — focus save/restore', () => {
  it('restores focus to the previously focused element on close', async () => {
    const trigger = document.createElement('input');
    trigger.id = 'trigger';
    document.body.append(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const other = document.createElement('input');
    other.id = 'other';
    document.body.append(other);

    const { open } = mountModal();

    // open — focus moves elsewhere inside the "dialog"
    open.value = true;
    await nextTick();
    other.focus();
    expect(document.activeElement).toBe(other);

    // close — focus should be restored to the trigger
    open.value = false;
    await flushPromises();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not throw when there was nothing focused before opening', async () => {
    const { open } = mountModal();
    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();
    // no assertion needed — just must not throw
    expect(true).toBe(true);
  });
});

/* ================================================================== */
/*  Unmount cleanup                                                    */
/* ================================================================== */

describe('useModalA11y — unmount cleanup', () => {
  it('restores body scroll on unmount', async () => {
    const { open, unmount } = mountModal();
    open.value = true;
    await nextTick();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('removes the keydown listener on unmount', async () => {
    const onKeydown = vi.fn();
    const { open, unmount } = mountModal(onKeydown);

    open.value = true;
    await nextTick();
    unmount();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onKeydown).not.toHaveBeenCalled();
  });
});
