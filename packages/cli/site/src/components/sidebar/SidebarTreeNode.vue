<script setup lang="ts">
defineProps<{
  label: string;
  expanded: boolean;
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
      @click="$emit('toggle')"
    >
      <span
        class="text-[10px] transition-transform duration-150 shrink-0 w-3 text-center"
        :class="expanded ? 'rotate-90' : ''"
        >▶</span
      >
      <span class="truncate">{{ label }}</span>
      <slot name="actions" />
    </button>

    <div v-if="expanded" class="pl-4 mb-1 space-y-px">
      <slot />
    </div>
  </div>
</template>
