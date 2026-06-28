import { onMounted, onUnmounted } from 'vue';

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
