<script setup>
import AppNavbar from './AppNavbar.vue'
</script>

<template>
  <div class="page-shell">
    <AppNavbar />
    <main class="page-container shell-content">
      <slot />
    </main>
    <footer class="page-container app-footer">
      <p>MoonUSD frontend scaffold for Sepolia demo day.</p>
      <p class="soft-text">Phase 1 focuses on clean UX, mock data, and a contract-ready structure.</p>
    </footer>
  </div>
</template>

<style scoped>
.shell-content {
  padding: 28px 0 72px;
}

.app-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0 40px;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.app-footer p {
  margin: 0;
}
</style>
