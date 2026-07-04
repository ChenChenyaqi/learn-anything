import { onMounted, onUnmounted } from 'vue';

// Mirrors the site's dark-mode strategy: a stored preference wins, otherwise
// the OS `prefers-color-scheme` is followed live. Phase 1 has no toggle UI, so
// in practice the app always tracks the system theme (task 8.4) — the stored
// branch is kept so a future settings toggle drops in unchanged.
export function useDarkMode() {
  function apply() {
    const stored = localStorage.getItem('learn-anything-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  }

  onMounted(() => {
    apply();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  });

  onUnmounted(() => {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', apply);
  });
}
