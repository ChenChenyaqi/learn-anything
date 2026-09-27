<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getDataVersion, refreshTopicData } from '@/composables/useTopicData';

interface Entry {
  id: string;
  name: string;
  path: string;
  available: boolean;
}
const { t } = useI18n();
const mode = ref('');
const entries = ref<Entry[]>([]);
const path = ref('');
const busy = ref(false);
const message = ref('');
const error = ref('');
const pendingRemoval = ref('');

async function loadRegistry() {
  try {
    const response = await fetch('/api/registry');
    if (!response.ok) throw new Error(t('registry.failed'));
    const data = await response.json();
    mode.value = data.mode;
    entries.value = data.topics;
  } catch {
    error.value = t('registry.failed');
  }
}
watch(getDataVersion, loadRegistry, { immediate: true });

async function manage(method: 'POST' | 'DELETE', body: { path: string } | { id: string }) {
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    const response = await fetch('/api/registry', {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Learn-Anything': 'dashboard' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('registry.failed'));
    if (method === 'POST') {
      message.value = `${t('registry.imported')}: ${result.topics.length}`;
      if (result.skipped.length) error.value = result.skipped.join('\n');
      if (result.topics.length) path.value = '';
    } else {
      message.value = t('registry.removed');
      pendingRemoval.value = '';
    }
    await refreshTopicData();
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('registry.failed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mb-8 text-sm">
    <p v-if="mode === 'project'" class="text-text-3">{{ t('registry.projectMode') }}</p>
    <details v-if="mode === 'global'" class="rounded-xl border border-(--color-divider) p-4">
      <summary class="cursor-pointer font-medium">
        {{ t('registry.manage') }} ({{ entries.length }})
      </summary>
      <p class="text-text-3 my-3">{{ t('registry.hint') }}</p>
      <form
        class="flex flex-wrap gap-2 mb-4"
        @submit.prevent="manage('POST', { path: path.trim() })"
      >
        <label for="registry-path" class="w-full">{{ t('registry.path') }}</label>
        <input
          id="registry-path"
          v-model="path"
          required
          class="flex-1 min-w-0 border border-(--color-divider) rounded px-3 py-2 bg-(--color-bg-soft)"
          :placeholder="t('registry.placeholder')"
        />
        <button
          type="submit"
          :disabled="busy || !path.trim()"
          class="rounded border border-(--color-divider) px-3 py-2 disabled:opacity-50"
        >
          {{ t('registry.import') }}
        </button>
      </form>
      <ul class="space-y-3">
        <li v-for="entry in entries" :key="entry.id" class="border-t border-(--color-divider) pt-3">
          <div class="font-medium">{{ entry.name }}</div>
          <p class="text-xs text-text-3 break-all">{{ entry.path }}</p>
          <p v-if="!entry.available" class="text-amber-600 my-1">{{ t('registry.unavailable') }}</p>
          <template v-if="pendingRemoval === entry.id">
            <p class="my-2">{{ t('registry.confirm') }}</p>
            <button
              :disabled="busy"
              class="underline mr-4"
              @click="manage('DELETE', { id: entry.id })"
            >
              {{ t('registry.remove') }}
            </button>
            <button :disabled="busy" class="underline" @click="pendingRemoval = ''">
              {{ t('registry.cancel') }}
            </button>
          </template>
          <button
            v-else
            :disabled="busy"
            class="underline mt-2 text-text-2"
            @click="pendingRemoval = entry.id"
          >
            {{ t('registry.remove') }}
          </button>
        </li>
      </ul>
    </details>
    <p v-if="message" role="status" class="mt-3">{{ message }}</p>
    <p v-if="error" role="alert" class="mt-3 text-red-600 whitespace-pre-wrap break-all">
      {{ error }}
    </p>
  </section>
</template>
