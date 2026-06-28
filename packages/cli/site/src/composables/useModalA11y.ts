/* ================================================================== */
/*  useModalA11y — shared modal accessibility & lifecycle concerns     */
/*                                                                     */
/*  Consolidates the focus-save/restore, body scroll lock, optional    */
/*  document-level keydown listener, and unmount cleanup shared by     */
/*  every modal in the app. Extracted from the duplicated logic that   */
/*  lived in both QuizModal.vue and SearchModal.vue.                   */
/*                                                                     */
/*  Autofocus of the dialog/input element is intentionally left to     */
/*  each consumer (targets and ordering differ per modal).             */
/* ================================================================== */

import { watch, onBeforeUnmount, nextTick, type Ref } from 'vue';

export interface UseModalA11yOptions {
  /**
   * Optional global keydown handler. When provided, it is registered on
   * `document` while the modal is open and removed when it closes (and
   * on unmount). Omit for modals that bind keydown in the template.
   */
  onKeydown?: (e: KeyboardEvent) => void;
}

/**
 * Wire up shared modal a11y concerns to an `open` ref.
 *
 * - **Focus save/restore:** records `document.activeElement` on the
 *   closed→open transition and restores focus to it on open→closed.
 * - **Scroll lock:** sets `body.style.overflow = 'hidden'` while open.
 * - **Global keydown:** registers `options.onKeydown` on `document`
 *   only while open (when provided).
 * - **Cleanup:** everything is torn down in `onBeforeUnmount`.
 *
 * Must be called from within a component `setup()` (uses lifecycle hooks).
 */
export function useModalA11y(open: Ref<boolean>, options: UseModalA11yOptions = {}): void {
  const { onKeydown } = options;
  let savedFocus: HTMLElement | null = null;

  /* ---- focus save / restore ---- */
  watch(open, (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      savedFocus = document.activeElement as HTMLElement | null;
    }
    if (!isOpen && wasOpen && savedFocus) {
      const toRestore = savedFocus;
      nextTick(() => toRestore?.focus());
    }
  });

  /* ---- scroll lock + global keydown ---- */
  watch(
    open,
    (isOpen) => {
      document.body.style.overflow = isOpen ? 'hidden' : '';

      if (!onKeydown) return;
      if (isOpen) {
        document.addEventListener('keydown', onKeydown);
      } else {
        document.removeEventListener('keydown', onKeydown);
      }
    },
    { immediate: true },
  );

  /* ---- cleanup ---- */
  onBeforeUnmount(() => {
    document.body.style.overflow = '';
    if (onKeydown) {
      document.removeEventListener('keydown', onKeydown);
    }
  });
}
