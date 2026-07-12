import { onMounted, ref } from 'vue';

const MIN_WIDTH = 280;
const MAX_FRACTION = 0.5;
const STORAGE_KEY = 'learn-anything-agent-panel-width';

export function useAgentPanelResize() {
  const width = ref(400);
  const resizing = ref(false);

  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const val = Number(stored);
        if (val >= MIN_WIDTH) width.value = val;
      }
    } catch {
      /* ignore */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, String(width.value));
    } catch {
      /* ignore */
    }
  }

  function start(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    resizing.value = true;
    const startX = e.clientX;
    const startWidth = width.value;

    function onMove(e: MouseEvent) {
      const delta = startX - e.clientX;
      const maxWidth = Math.floor(window.innerWidth * MAX_FRACTION);
      width.value = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + delta));
    }

    function onUp() {
      resizing.value = false;
      save();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  onMounted(load);

  return { width, resizing, start };
}
