<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { useWallet } from '../composables/useWallet'
import WalletConnectButton from './WalletConnectButton.vue'

const route = useRoute()
useWallet()

const navItems = [
  { name: 'Home', to: '/' },
  { name: 'Vault', to: '/vault' },
  { name: 'Dashboard', to: '/dashboard' },
  { name: 'Swap Demo', to: '/uniswap' },
]
</script>

<template>
  <header class="navbar-wrap">
    <div class="page-container navbar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark"></span>
        <div>
          <strong>MoonUSD</strong>
          <span>Overcollateralized stablecoin prototype</span>
        </div>
      </RouterLink>

      <nav class="nav-links">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: route.path === item.to }"
        >
          {{ item.name }}
        </RouterLink>
      </nav>

      <div class="nav-actions">
        <WalletConnectButton />
      </div>
    </div>
  </header>
</template>

<style scoped>
.navbar-wrap {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(14px);
  background: rgba(255, 253, 247, 0.82);
  border-bottom: 1px solid rgba(20, 20, 20, 0.05);
}

.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 88px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 220px;
}

.brand strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.1rem;
  letter-spacing: -0.02em;
}

.brand span {
  display: block;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 35% 35%, #fffce8 0%, #fff1b3 35%, transparent 36%),
    linear-gradient(135deg, #f9d76d 0%, #f1bb27 100%);
  box-shadow: 0 14px 24px rgba(246, 198, 78, 0.28);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(20, 20, 20, 0.06);
}

.nav-link {
  padding: 10px 16px;
  border-radius: 999px;
  color: var(--text-muted);
  font-weight: 600;
  transition: background 160ms ease, color 160ms ease;
}

.nav-link.active,
.nav-link:hover {
  background: rgba(246, 198, 78, 0.18);
  color: var(--text);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 980px) {
  .navbar {
    flex-wrap: wrap;
    padding: 14px 0;
  }

  .nav-links {
    order: 3;
    width: 100%;
    justify-content: space-between;
    overflow-x: auto;
  }
}

@media (max-width: 640px) {
  .nav-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
