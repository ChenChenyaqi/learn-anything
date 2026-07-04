<script setup lang="ts">
// Topic list for an opened working folder. Lists readable v1 topics, or an
// "empty folder" hint when fresh. Below the topic list is the chat dialog
// surface where new topics are created.
import { type ProjectInfo } from '../lib/commands';
import ChatDialog from './ChatDialog.vue';

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
    <div class="mt-6">
      <ChatDialog />
    </div>
  </div>
</template>
