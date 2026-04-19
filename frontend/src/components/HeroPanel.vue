<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <section class="hero panel-card">
    <div class="hero-copy">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <div class="hero-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="hero-side">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.95fr);
  gap: 28px;
  padding: 34px;
}

.hero-copy h1 {
  margin: 18px 0 12px;
  font-family: var(--font-heading);
  font-size: clamp(2.35rem, 5vw, 4.2rem);
  line-height: 0.98;
  letter-spacing: -0.04em;
}

.hero-copy p {
  margin: 0;
  max-width: 62ch;
  color: var(--text-muted);
  line-height: 1.72;
  font-size: 1.05rem;
}

.hero-actions {
  margin-top: 24px;
}

.hero-side {
  display: flex;
  align-items: stretch;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 26px;
  }
}
</style>
