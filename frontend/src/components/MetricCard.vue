<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  detail: {
    type: String,
    default: '',
  },
  tone: {
    type: String,
    default: 'neutral',
  },
})

const toneClass = computed(() => `metric-${props.tone}`)
</script>

<template>
  <article class="metric-card panel-card" :class="toneClass">
    <p class="metric-label">{{ label }}</p>
    <h3>{{ value }}</h3>
    <p class="metric-detail">{{ detail }}</p>
    <slot />
  </article>
</template>

<style scoped>
.metric-card {
  position: relative;
  padding: 22px;
  overflow: hidden;
}

.metric-card::before {
  content: "";
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  height: 4px;
  background: rgba(246, 198, 78, 0.24);
}

.metric-card h3 {
  margin: 8px 0 10px;
  font-family: var(--font-heading);
  font-size: 1.8rem;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.metric-label {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-detail {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.65;
}

.metric-success::before {
  background: rgba(46, 157, 101, 0.42);
}

.metric-warning::before {
  background: rgba(210, 125, 31, 0.42);
}

.metric-danger::before {
  background: rgba(207, 77, 77, 0.42);
}
</style>
