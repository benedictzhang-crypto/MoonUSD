<template>
  <section class="not-found-wrap">
    <article class="panel-card not-found-card">
      <span class="eyebrow">404</span>
      <h1>Page not found</h1>
      <p>
        This route does not exist in the MoonUSD demo yet. Jump back to the landing page or head
        straight to the vault.
      </p>
      <div class="button-row">
        <RouterLink class="button" to="/">Back Home</RouterLink>
        <RouterLink class="button-secondary" to="/vault">Open Vault</RouterLink>
      </div>
    </article>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.not-found-wrap {
  display: grid;
  place-items: center;
  min-height: 72vh;
}

.not-found-card {
  width: min(100%, 640px);
  padding: 32px;
  text-align: center;
}

.not-found-card h1 {
  margin: 20px 0 12px;
  font-family: var(--font-heading);
  font-size: 2.5rem;
  letter-spacing: -0.04em;
}

.not-found-card p {
  margin: 0 auto 26px;
  max-width: 42ch;
  color: var(--text-muted);
  line-height: 1.7;
}

.not-found-card .button-row {
  justify-content: center;
}
</style>
