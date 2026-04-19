<script setup>
import HeroPanel from '../components/HeroPanel.vue'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useMoonUsd } from '../composables/useMoonUsd'
import {
  formatCurrency,
  formatEth,
  formatNumber,
  formatPercent,
} from '../utils/formatters'

const { state, pegStatus, healthTone, dataSourceLabel, dataSourceTone, refreshFromChain } =
  useMoonUsd()
</script>

<template>
  <div class="section">
    <HeroPanel
      eyebrow="Protocol dashboard"
      title="Monitor the minimum metrics the project needs"
      description="This screen is intentionally compact for demo day: oracle price, collateral, supply, health, and a clear pointer to the live swap demo for market behavior."
    >
      <article class="dashboard-hero-card">
        <div class="hero-chip-row">
          <StatusBadge :label="dataSourceLabel" :tone="dataSourceTone" />
          <StatusBadge :label="state.system.statusLabel" :tone="healthTone" />
          <StatusBadge :label="pegStatus.label" :tone="pegStatus.tone" />
        </div>
        <h2>{{ formatPercent(state.system.systemCollateralRatio) }}</h2>
        <p>Current live system collateral ratio from the deployed Sepolia MoonVault.</p>
        <button class="button-ghost refresh-button" type="button" @click="refreshFromChain()">
          {{ state.isSyncing ? 'Refreshing...' : 'Refresh live data' }}
        </button>
      </article>
    </HeroPanel>
  </div>

  <section class="section">
    <div class="card-grid cols-3">
      <MetricCard
        label="ETH Price"
        :value="formatCurrency(state.system.ethPrice)"
        detail="Live ETH/USD read from the configured Sepolia price feed."
      />
      <MetricCard
        label="Total System Collateral"
        :value="formatEth(state.system.totalCollateralEth)"
        detail="Live ETH currently locked inside the deployed MoonVault."
      />
      <MetricCard
        label="MoonUSD Supply"
        :value="`${formatNumber(state.system.totalSupply)} MoonUSD`"
        detail="Live MoonUSD total supply from the deployed Sepolia token."
      />
      <MetricCard
        label="Peg Status"
        value="Use Swap Demo"
        detail="Professor sell tests are shown on the Swap Demo and Attack Demo pages instead of a mocked peg widget."
      />
      <MetricCard
        label="System Health"
        :value="Number.isFinite(state.system.healthScore) ? `${state.system.healthScore}/100` : 'N/A'"
        detail="Derived from the live system collateral ratio on Sepolia."
        :tone="healthTone"
      />
      <MetricCard
        label="Active Vaults"
        :value="formatNumber(state.system.activeVaults)"
        detail="Live count derived from vault deposit history and current vault balances."
      />
    </div>
  </section>
</template>

<style scoped>
.dashboard-hero-card {
  padding: 24px;
}

.hero-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.dashboard-hero-card h2 {
  margin: 0 0 8px;
  font-family: var(--font-heading);
  font-size: 2.5rem;
  letter-spacing: -0.04em;
}

.dashboard-hero-card p {
  margin: 0;
  color: var(--text-muted);
}

.refresh-button {
  margin-top: 18px;
}
</style>
