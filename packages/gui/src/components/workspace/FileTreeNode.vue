<script setup lang="ts">
// Recursive file-tree node. Renders a directory (collapsible, recursing into
// its children) or a file leaf. A leaf reports a click up via `open`.
//
// Directories default to expanded so the whole structure is visible on first
// render; the user may collapse any of them. The active leaf (matched by path)
// gets the accent left-border + surface fill, mirroring the mockup's
// `.tree-leaf.active`.
//
// Self-references `<FileTreeNode>` for its children — Vue 3 `<script setup>`
// resolves this by filename automatically.

import { ref, computed } from 'vue';
import type { TreeNode, FileLeaf } from './buildFileTree';

const props = defineProps<{
  node: TreeNode;
  activePath: string | null;
}>();

const emit = defineEmits<{
  open: [leaf: FileLeaf];
}>();

const open = ref(true);

function activate() {
  if (props.node.type === 'file') emit('open', props.node);
  else open.value = !open.value;
}

/** Sans for markdown notes, mono for everything else (code/json). */
const leafMono = computed(() => !props.node.name.endsWith('.md'));
</script>

<template>
  <div v-if="node.type === 'dir'">
    <button
      type="button"
      class="flex w-full items-center gap-1 rounded-r-lg px-1.5 py-1 text-left text-sm text-(--color-ink) transition-colors hover:bg-(--color-surface-hover)"
      @click="activate"
    >
      <span class="inline-block w-3 text-text-3 transition-transform" :class="open && 'rotate-90'"
        >▸</span
      >
      <span>{{ node.name }}</span>
    </button>
    <div v-show="open" class="ml-3 border-l border-(--color-rule) pl-2">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :active-path="activePath"
        @open="emit('open', $event)"
      />
    </div>
  </div>

  <div
    v-else
    class="flex cursor-pointer items-center gap-2 rounded-r-lg border-l-2 border-l-transparent px-1.5 py-1 text-sm transition-colors hover:bg-(--color-surface-hover)"
    :class="
      node.path === activePath
        ? 'border-l-(--color-accent) bg-(--color-surface)'
        : 'border-l-transparent'
    "
    @click="activate"
  >
    <span class="truncate" :class="leafMono ? 'font-mono text-xs' : ''">{{ node.name }}</span>
  </div>
</template>
