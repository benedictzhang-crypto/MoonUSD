<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  tone: {
    type: String,
    default: 'neutral',
  },
})

const toneClass = computed(() => `tone-${props.tone}`)
</script>

<template>
  <span class="status-badge" :class="toneClass">{{ label }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.88rem;
  font-weight: 700;
}

.tone-neutral {
  background: rgba(255, 243, 200, 0.8);
  color: var(--primary-deep);
  border-color: rgba(246, 198, 78, 0.18);
}

.tone-success {
  background: var(--success-soft);
  color: var(--success);
  border-color: rgba(46, 157, 101, 0.16);
}

.tone-warning {
  background: var(--warning-soft);
  color: var(--warning);
  border-color: rgba(210, 125, 31, 0.16);
}

.tone-danger {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: rgba(207, 77, 77, 0.16);
}
</style>
