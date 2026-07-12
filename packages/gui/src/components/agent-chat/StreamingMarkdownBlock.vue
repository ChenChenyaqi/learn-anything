<script setup lang="ts">
import MarkdownRender from 'markstream-vue';
import 'markstream-vue/index.css';

defineProps<{
  text: string;
  done: boolean;
}>();
</script>

<template>
  <MarkdownRender
    mode="chat"
    :content="text"
    :final="done"
    :fade="false"
    :typewriter="!done"
    :max-live-nodes="!done ? 0 : undefined"
  />
</template>
