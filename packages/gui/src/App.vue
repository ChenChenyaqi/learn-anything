<script setup lang="ts">
// Phase 1 shell placeholder. The chat dialog and agent UI arrive in later tasks.
</script>

<template>
  <main class="shell">
    <h1>Learn Anything</h1>
    <p class="subtitle">Desktop shell ready.</p>
  </main>
</template>

<style>
:root {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
    sans-serif;
  color-scheme: light dark;
}

body {
  margin: 0;
}

.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: #ffffff;
  color: #1a1a1a;
}

@media (prefers-color-scheme: dark) {
  .shell {
    background: #1b1b1b;
    color: #f5f5f5;
  }
}

h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  opacity: 0.6;
}
</style>
