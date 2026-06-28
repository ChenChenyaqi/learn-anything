/* ------------------------------------------------------------------ */
/*  usePlatform — detect the user's platform for modifier-key display  */
/*                                                                     */
/*  Shared by QuizHelpPopover and QuizFooter so they show ⌘ on macOS   */
/*  and Ctrl elsewhere. Extracted from the inline check that lived in  */
/*  QuizModal.vue.                                                     */
/* ------------------------------------------------------------------ */

export function usePlatform() {
  let isMac = false;
  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform ?? navigator.platform;
    isMac = /Mac|iPod|iPhone|iPad/.test(platform);
  }
  return { isMac };
}
