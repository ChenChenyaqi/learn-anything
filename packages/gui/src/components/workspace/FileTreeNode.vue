<script setup lang="ts">
// Recursive file-tree node. Renders a directory (collapsible, recursing into
// its children) or a file leaf. A leaf reports a click up via `open`.
//
// Directories default to expanded. The active leaf (matched by path) gets the
// accent left-border + surface fill. On the `quizzes` axis, directory rows
// expose a `batchActions` slot (▶/⇄) so the sidebar can run a sequential or
// random batch over that subtree; the slot is forwarded through recursion.
//
// Self-references `<FileTreeNode>` for its children — Vue 3 `<script setup>`
// resolves this by filename automatically.

import { ref, computed } from 'vue';
import type { TreeNode, FileLeaf, DirNode } from './buildFileTree';

const props = defineProps<{
  node: TreeNode;
  activePath: string | null;
  axis: 'sessions' | 'exercises' | 'quizzes';
}>();

const emit = defineEmits<{
  open: [leaf: FileLeaf];
}>();

// Explicitly type the batch-actions slot so the recursive slot forwarding
// doesn't form a self-referential (circular) type.
defineSlots<{
  batchActions(props: { node: DirNode }): unknown;
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
    <div
      class="flex items-center rounded-r-lg px-1.5 py-1 transition-colors hover:bg-(--color-surface-hover)"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-1 text-left text-sm text-(--color-ink)"
        @click="activate"
      >
        <span class="inline-block w-3 text-text-3 transition-transform" :class="open && 'rotate-90'"
          >▸</span
        >
        <span class="truncate">{{ node.name }}</span>
      </button>

      <!-- batch actions (quiz axis only) -->
      <slot v-if="axis === 'quizzes'" name="batchActions" :node="node" />
    </div>

    <div v-show="open" class="ml-3 border-l border-(--color-rule) pl-2">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :active-path="activePath"
        :axis="axis"
        @open="emit('open', $event)"
      >
        <template v-if="$slots.batchActions" #batchActions="{ node: childNode }">
          <slot name="batchActions" :node="childNode" />
        </template>
      </FileTreeNode>
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
