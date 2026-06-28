<script setup lang="ts">
defineProps<{
  label: string;
  expanded: boolean;
  isOrphan?: boolean;
  orphanTitle?: string;
}>();

defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <div>
    <button
      class="w-full flex items-center gap-1.5 py-1 text-sm font-medium transition-colors cursor-pointer"
      :class="expanded ? 'text-text-1' : 'text-text-2 hover:text-text-1'"
      :title="isOrphan ? orphanTitle : undefined"
      @click="$emit('toggle')"
    >
      <span
        class="text-[10px] transition-transform duration-150 shrink-0 w-3 text-center"
        :class="expanded ? 'rotate-90' : ''"
        >▶</span
      >
      <span
        v-if="isOrphan"
        class="inline-block w-1.25 h-1.25 rounded-full bg-text-3 shrink-0"
        aria-hidden="true"
      ></span>
      <span class="truncate">{{ label }}</span>
      <slot name="actions" />
    </button>

    <div v-if="expanded" class="pl-4 mb-1 space-y-px">
      <slot />
    </div>
  </div>
</template>
