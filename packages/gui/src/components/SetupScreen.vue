<script setup lang="ts">
// API-key setup screen — pure markup.
//
// All form state (fields, save, validation) lives in `useSetupForm`;
// this component just binds it to inputs and emits `saved` upward. The key is
// stored in plaintext alongside the rest of the config (`set_config`); the
// masked `existingKeyPreview` is display-only.

import { useI18n } from 'vue-i18n';
import { type AppConfig, type LanguagePreference } from '../lib/commands';
import { useSetupForm } from '../composables/useSetupForm';
import FormField from './FormField.vue';
import { btnPrimary, fieldControl } from '../lib/ui';

const { t } = useI18n();

const props = defineProps<{
  /** Current non-secret config, used to pre-fill provider/model/base_url. */
  config: AppConfig | null;
  /** Masked preview of an already-stored key, or `null` when none is saved. */
  existingKeyPreview: string | null;
}>();

const emit = defineEmits<{
  /** Fired after a successful save so the parent can re-evaluate routing. */
  saved: [];
  /** Fired immediately when the language preference changes (saved via
   *  `set_language`, independent of the provider form's Save button). */
  language: [pref: LanguagePreference];
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

    <!-- Language: app-level preference, applied + persisted immediately via
         `set_language` — deliberately NOT part of the provider form below,
         whose Save validates model/key and would reject fresh installs. -->
    <FormField :label="t('setup.language')">
      <select
        :class="fieldControl"
        :value="config?.language ?? 'system'"
        @change="
          emit('language', ($event.target as HTMLSelectElement).value as LanguagePreference)
        "
      >
        <option value="system">{{ t('setup.languageSystem') }}</option>
        <option value="en">English</option>
        <option value="zh-CN">简体中文</option>
      </select>
    </FormField>

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
