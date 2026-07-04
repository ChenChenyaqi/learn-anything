<script setup lang="ts">
// API-key setup screen — pure markup.
//
// All form state (fields, save, validation) lives in `useSetupForm`;
// this component just binds it to inputs and emits `saved` upward. The key
// itself is never persisted in plaintext: it goes to the OS keychain via
// `save_key`; only provider/model/base_url reach `set_config`. Provider
// verification moves to the agent sidecar's session boot.

import { type AppConfig } from '../lib/commands';
import { useSetupForm } from '../composables/useSetupForm';
import FormField from './FormField.vue';
import { btnPrimary, fieldControl } from '../lib/ui';

const props = defineProps<{
  /** Current non-secret config, used to pre-fill provider/model/base_url. */
  config: AppConfig | null;
  /** Masked preview of an already-stored key, or `null` when none is saved. */
  existingKeyPreview: string | null;
}>();

const emit = defineEmits<{
  /** Fired after a successful save so the parent can re-evaluate routing. */
  saved: [];
}>();

const { provider, model, baseUrl, key, status, saving, hasExistingKey, onSave } =
  useSetupForm({
    config: () => props.config,
    existingKeyPreview: () => props.existingKeyPreview,
    onSaved: () => emit('saved'),
  });
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col gap-7 px-6 py-10">
    <header>
      <h1 class="m-0 text-2xl font-semibold">Learn Anything</h1>
      <p class="mt-1.5 text-sm opacity-65">Set up your provider to get started.</p>
    </header>

    <form class="flex flex-col gap-4" @submit.prevent="onSave">
      <FormField label="Provider">
        <select v-model="provider" :class="fieldControl">
          <option value="openai">OpenAI-compatible</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </FormField>

      <FormField label="Model id">
        <input
          v-model="model"
          :class="fieldControl"
          type="text"
          placeholder="e.g. gpt-4o"
          autocomplete="off"
          spellcheck="false"
        />
      </FormField>

      <FormField label="Base URL" optional>
        <input
          v-model="baseUrl"
          :class="fieldControl"
          type="text"
          placeholder="https://api.openai.com/v1"
          autocomplete="off"
          spellcheck="false"
        />
      </FormField>

      <FormField label="API key">
        <input
          v-model="key"
          :class="fieldControl"
          type="password"
          :placeholder="
            hasExistingKey ? `kept as ${existingKeyPreview} — leave blank to keep` : 'sk-…'
          "
          autocomplete="off"
          spellcheck="false"
        />
      </FormField>

      <p
        v-if="status.kind !== 'idle'"
        :class="['m-0 text-sm text-(--color-accent)']"
      >
        {{ status.text }}
      </p>

      <div class="mt-1 flex justify-end gap-3">
        <button type="submit" :class="[btnPrimary, 'px-4 py-2']" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </form>
  </section>
</template>
