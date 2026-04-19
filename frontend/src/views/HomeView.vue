<script setup>
import { RouterLink } from 'vue-router'
import MetricCard from '../components/MetricCard.vue'
import HeroPanel from '../components/HeroPanel.vue'
import { protocolSummaryCards } from '../data/mockData'
import { useMoonUsd } from '../composables/useMoonUsd'
import { formatCurrency, formatEth, formatNumber, formatPercent } from '../utils/formatters'

const { state, dataSourceLabel, refreshFromChain } = useMoonUsd()
</script>

<template>
  <div class="section">
    <HeroPanel
      eyebrow="Course final project"
      title="MoonUSD"
      description="A live Sepolia frontend for an ETH-backed overcollateralized stablecoin course project. The app now reads real on-chain protocol data and sends real MetaMask transactions."
    >
      <template #actions>
        <div class="button-row">
          <RouterLink class="button-secondary" to="/vault">Open Vault</RouterLink>
          <RouterLink class="button-secondary" to="/uniswap">Open Swap Demo</RouterLink>
          <button class="button-ghost" type="button" @click="refreshFromChain()">
            {{ state.isSyncing ? 'Refreshing...' : 'Refresh Sepolia' }}
          </button>
        </div>
      </template>

      <article class="hero-preview">
        <div>
          <p class="preview-label">Live preview</p>
          <h2>{{ formatCurrency(state.system.ethPrice) }}</h2>
          <p class="preview-copy">
            Live ETH/USD price from the Sepolia price feed. Current frontend source:
            <strong>{{ dataSourceLabel }}</strong>.
          </p>
        </div>
        <div class="preview-grid">
          <div>
            <span>Total system collateral</span>
            <strong>{{ formatEth(state.system.totalCollateralEth) }}</strong>
          </div>
          <div>
            <span>Total MoonUSD supply</span>
            <strong>{{ formatNumber(state.system.totalSupply) }} MoonUSD</strong>
          </div>
          <div>
            <span>System collateral ratio</span>
            <strong>{{ formatPercent(state.system.systemCollateralRatio) }}</strong>
          </div>
          <div>
            <span>Active vaults</span>
            <strong>{{ formatNumber(state.system.activeVaults) }}</strong>
          </div>
        </div>
      </article>
    </HeroPanel>
  </div>

  <section class="section">
    <div class="card-grid cols-4">
      <MetricCard
        v-for="card in protocolSummaryCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :detail="card.detail"
      />
    </div>
  </section>
</template>

<style scoped>
.hero-preview {
  width: 100%;
  padding: 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 247, 221, 0.94)),
    #ffffff;
  border: 1px solid rgba(20, 20, 20, 0.06);
  box-shadow: var(--shadow-soft);
}

.preview-label {
  margin: 0 0 8px;
  color: var(--text-soft);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.hero-preview h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 2.45rem;
  letter-spacing: -0.04em;
}

.preview-copy {
  margin: 8px 0 20px;
  color: var(--text-muted);
  line-height: 1.65;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.preview-grid div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(20, 20, 20, 0.06);
}

.preview-grid span {
  color: var(--text-soft);
  font-size: 0.88rem;
}

.preview-grid strong {
  font-size: 1.02rem;
}

@media (max-width: 560px) {
  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
