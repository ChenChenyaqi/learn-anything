<script setup lang="ts">
// Topic list for an opened working folder. Lists readable v1 topics, or an
// "empty folder" hint when fresh. The dashed block is the task-9 chat surface
// placeholder.
import { type ProjectInfo } from '../lib/commands';

defineProps<{ project: ProjectInfo }>();
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h2 class="m-0 mb-2 text-base font-semibold">
        {{ project.fresh ? 'Empty folder' : `Topics (${project.topics.length})` }}
      </h2>
      <ul v-if="!project.fresh" class="columns-2 text-sm">
        <li v-for="t in project.topics" :key="t.slug">{{ t.topic }}</li>
      </ul>
      <p v-else class="text-sm opacity-60">
        This folder has no topics yet. The chat (next task) will create them here.
      </p>
    </div>
    <div
      class="mt-6 rounded-[10px] border border-dashed border-(--color-rule) p-8 text-center text-sm opacity-55"
    >
      Chat dialog arrives in task 9.
    </div>
  </div>
</template>
