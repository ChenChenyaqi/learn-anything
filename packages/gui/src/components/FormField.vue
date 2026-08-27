<script setup lang="ts">
// Generic form-field container: a label + the control via the default slot.
// Collapses the repeated `<label><span>…</span><input/></label>` scaffold used
// across the setup form into one consistent block.
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{ label: string; optional?: boolean }>();
</script>

<template>
  <label class="flex flex-col gap-1.5">
    <span class="text-sm font-medium opacity-85">
      {{ label }}
      <span v-if="optional" class="font-normal opacity-55">{{ t('common.optional') }}</span>
    </span>
    <slot />
  </label>
</template>
