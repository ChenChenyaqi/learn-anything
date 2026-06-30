import { provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export type ViewMode = 'map' | 'progress';

export function useViewMode() {
  const route = useRoute();
  const router = useRouter();

  const viewMode = ref<ViewMode>('map');
  provide('viewMode', viewMode);

  function setMode(mode: ViewMode, syncUrl = true): void {
    if (viewMode.value === mode) return;
    viewMode.value = mode;
    if (!syncUrl) return;
    const query = { ...route.query };
    if (mode === 'progress') query.view = 'progress';
    else delete query.view;
    router.replace({ query });
  }

  provide('setViewMode', setMode);

  function restoreFromRoute(): void {
    viewMode.value = route.query.view === 'progress' ? 'progress' : 'map';
  }

  watch(
    () => route.params.slug,
    () => restoreFromRoute(),
    { immediate: true },
  );
}
