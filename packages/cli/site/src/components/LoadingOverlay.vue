<script setup lang="ts">
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();
</script>

<template>
  <div class="loading-overlay z-50" role="status" aria-live="polite">
    <div class="loading-overlay__inner">
      <span class="loading-overlay__label">{{ t('loading.note') }}</span>

      <svg class="loading-overlay__pen" viewBox="0 0 140 20" aria-hidden="true">
        <!-- notebook ruled lines -->
        <line x1="2" y1="6" x2="138" y2="6" />
        <line x1="2" y1="14" x2="138" y2="14" />

        <!-- the red pen annotation -->
        <path class="pen-stroke" d="M2 11 H138" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color-mix(in srgb, var(--color-bg) 72%, transparent);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.loading-overlay__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.loading-overlay__label {
  font-size: var(--text-sm);
  color: var(--color-pencil);
  letter-spacing: 0.01em;
}

.loading-overlay__pen {
  width: 132px;
  height: auto;
  overflow: visible;
}

.loading-overlay__pen line {
  stroke: var(--color-divider);
  stroke-width: 1;
  shape-rendering: crispEdges;
}

/* --- The red pen drawing across the ruled line --- */
.pen-stroke {
  fill: none;
  stroke: var(--color-brand-2);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 136;
  stroke-dashoffset: 136;
  animation: la-pen-draw 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}

@keyframes la-pen-draw {
  0% {
    stroke-dashoffset: 136;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  85% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@keyframes la-nib-move {
  0% {
    offset-distance: 0%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  85% {
    offset-distance: 100%;
    opacity: 1;
  }
  100% {
    offset-distance: 100%;
    opacity: 0;
  }
}

/* --- Fade transition driven by <Transition name="ld-fade"> in App.vue --- */
.ld-fade-enter-active,
.ld-fade-leave-active {
  transition: opacity 0.18s ease;
}
.ld-fade-enter-from,
.ld-fade-leave-to {
  opacity: 0;
}

/* --- Reduced motion: show a calm, fully-drawn static underline --- */
@media (prefers-reduced-motion: reduce) {
  .pen-stroke {
    animation: none;
    stroke-dashoffset: 0;
    opacity: 1;
  }
}
</style>
