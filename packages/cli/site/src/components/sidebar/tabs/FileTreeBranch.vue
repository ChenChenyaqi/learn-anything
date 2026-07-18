<script setup lang="ts">
import SidebarTreeNode from '@/components/sidebar/SidebarTreeNode.vue';
import type { TreeNode, FileLeaf } from '@/components/sidebar/tabs/buildFileTree';

defineOptions({ name: 'FileTreeBranch' });

defineProps<{
  nodes: TreeNode[];
  expandedKeys: Set<string>;
  selectedFilePath?: string | null;
  mono?: boolean;
}>();

defineEmits<{
  toggle: [key: string];
  'file-selected': [file: FileLeaf];
}>();
</script>

<template>
  <template v-for="node in nodes" :key="node.path">
    <SidebarTreeNode
      v-if="node.type === 'dir'"
      :label="node.name"
      :expanded="expandedKeys.has(node.path)"
      @toggle="$emit('toggle', node.path)"
    >
      <template v-if="$slots['dir-action']" #actions>
        <slot name="dir-action" :node="node" />
      </template>
      <FileTreeBranch
        :nodes="node.children"
        :expanded-keys="expandedKeys"
        :selected-file-path="selectedFilePath"
        :mono="mono"
        @toggle="(k: string) => $emit('toggle', k)"
        @file-selected="(f: FileLeaf) => $emit('file-selected', f)"
      >
        <template v-if="$slots['dir-action']" #dir-action="scope">
          <slot name="dir-action" v-bind="scope" />
        </template>
      </FileTreeBranch>
    </SidebarTreeNode>
    <button
      v-else
      class="block w-full text-left py-1 text-xs transition-colors cursor-pointer truncate"
      :class="[
        mono ? 'font-mono' : 'font-medium',
        node.path === selectedFilePath ? 'text-brand-2' : 'text-text-2 hover:text-text-1',
      ]"
      @click="$emit('file-selected', node)"
    >
      {{ node.name }}
    </button>
  </template>
</template>
