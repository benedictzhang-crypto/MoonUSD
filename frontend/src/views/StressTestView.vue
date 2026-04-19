<script setup>
import { computed, ref } from 'vue'
import HeroPanel from '../components/HeroPanel.vue'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useMoonUsd } from '../composables/useMoonUsd'
import {
  DEFAULT_UNISWAP_FEE_PERCENT,
  DEFAULT_UNISWAP_SELL_SIZES,
  calculateMoonUsdNeededForPeg,
  calculatePoolDepthUsd,
  simulateMoonUsdSale,
} from '../services/web3/uniswap'
import {
  formatCurrency,
  formatEth,
  formatNumber,
  formatPercent,
} from '../utils/formatters'

const { state, refreshFromChain, dataSourceLabel, dataSourceTone } = useMoonUsd()

const selectedSellAmount = ref(100)
const seedEth = ref('0.25')

const attackPlan = computed(() => {
  const normalizedSeedEth = Number(seedEth.value)
  const requiredMoonUsd = calculateMoonUsdNeededForPeg(normalizedSeedEth, state.system.ethPrice)
  const poolDepthUsd = calculatePoolDepthUsd(normalizedSeedEth, state.system.ethPrice)

  if (
    !Number.isFinite(normalizedSeedEth) ||
    normalizedSeedEth <= 0 ||
    !Number.isFinite(requiredMoonUsd)
  ) {
    return null
  }

  return {
    seedEth: normalizedSeedEth,
    requiredMoonUsd,
    poolDepthUsd,
  }
})

const attackScenario = computed(() => {
  if (!attackPlan.value) {
    return null
  }

  return simulateMoonUsdSale({
    reserveEth: attackPlan.value.seedEth,
    reserveMoonUsd: attackPlan.value.requiredMoonUsd,
    sellAmountMoonUsd: selectedSellAmount.value,
    feePercent: DEFAULT_UNISWAP_FEE_PERCENT,
    ethPriceUsd: state.system.ethPrice,
  })
})

const attackSummary = computed(() => {
  if (!attackScenario.value) {
    return {
      title: 'Waiting for live market inputs',
      body: 'Refresh the Sepolia oracle data and confirm a pool seed size before testing a market sell attack.',
      tone: 'neutral',
    }
  }

  if (attackScenario.value.postTradeMoonUsdPriceUsd >= 0.97) {
    return {
      title: 'Attack absorbed cleanly',
      body: `A sell of ${selectedSellAmount.value} MoonUSD still leaves the pool price close to the $1 target.`,
      tone: 'success',
    }
  }

  if (attackScenario.value.postTradeMoonUsdPriceUsd >= 0.9) {
    return {
      title: 'Peg slips but still trades',
      body: `A sell of ${selectedSellAmount.value} MoonUSD creates visible slippage, so the pool needs deeper liquidity before demo day.`,
      tone: 'warning',
    }
  }

  return {
    title: 'Pool is too shallow for this attack',
    body: `A sell of ${selectedSellAmount.value} MoonUSD would push the market price far below the peg. Increase initial liquidity before the attack test.`,
    tone: 'danger',
  }
})
</script>

<template>
  <div class="section">
    <HeroPanel
      eyebrow="Attack demo"
      title="Test the 10 / 100 / 1000 MoonUSD sell attack"
      description="This page is for the classroom market stress test: use 10, 100, or 1000 MoonUSD sell sizes against the testnet pool and show whether the pair still trades close to the peg."
    >
      <article class="attack-hero-card">
        <div class="hero-row">
          <span>Data source</span>
          <StatusBadge :label="dataSourceLabel" :tone="dataSourceTone" />
        </div>
        <div class="hero-row">
          <span>ETH oracle price</span>
          <strong>{{ formatCurrency(state.system.ethPrice) }}</strong>
        </div>
        <div class="hero-row">
          <span>Selected sell size</span>
          <strong>{{ selectedSellAmount }} MoonUSD</strong>
        </div>
      </article>
    </HeroPanel>
  </div>

  <section class="section">
    <article class="panel-card control-card">
      <div class="control-head">
        <div>
          <h2 class="section-title">Attack setup</h2>
          <p class="section-copy">
            Set the ETH liquidity you plan to seed on Uniswap. MoonUSD on the other side is
            automatically sized to a $1 starting peg using the live oracle price.
          </p>
        </div>
        <button class="button-ghost" type="button" @click="refreshFromChain()">
          {{ state.isSyncing ? 'Refreshing...' : 'Refresh live data' }}
        </button>
      </div>

      <div class="control-grid">
        <label class="field-block">
          <span>Seed ETH in pool</span>
          <input v-model="seedEth" class="input-field" type="number" min="0" step="0.01" />
        </label>
      </div>

      <div class="button-row">
        <button
          v-for="sellAmount in DEFAULT_UNISWAP_SELL_SIZES"
          :key="sellAmount"
          class="button"
          :class="{ active: selectedSellAmount === sellAmount }"
          type="button"
          @click="selectedSellAmount = sellAmount"
        >
          Sell {{ sellAmount }}
        </button>
      </div>
    </article>
  </section>

  <section class="section">
    <div class="card-grid cols-4">
      <MetricCard
        label="Seed ETH"
        :value="formatEth(attackPlan?.seedEth)"
        detail="ETH liquidity you plan to put into the MoonUSD/ETH pool."
      />
      <MetricCard
        label="MoonUSD Needed"
        :value="formatNumber(attackPlan?.requiredMoonUsd, 2)"
        detail="MoonUSD required on the other side to start near the $1 peg."
      />
      <MetricCard
        label="Pool Depth"
        :value="formatCurrency(attackPlan?.poolDepthUsd)"
        detail="Approximate total USD depth of the launch pool."
      />
      <MetricCard
        label="Attack Inventory"
        value="1,110 MoonUSD"
        detail="Enough inventory to run 10, 100, and 1000 MoonUSD sell tests."
      />
    </div>
  </section>

  <section class="section">
    <article class="panel-card summary-card">
      <div class="summary-head">
        <span class="eyebrow">Attack Result</span>
        <StatusBadge :label="attackSummary.title" :tone="attackSummary.tone" />
      </div>
      <p class="section-copy">{{ attackSummary.body }}</p>

      <div class="analysis-grid">
        <div>
          <span>ETH received by seller</span>
          <strong>{{ formatEth(attackScenario?.ethOut, 5) }}</strong>
        </div>
        <div>
          <span>Average execution price</span>
          <strong>{{ formatCurrency(attackScenario?.averageExecutionPriceUsd) }}</strong>
        </div>
        <div>
          <span>Post-trade MoonUSD price</span>
          <strong>{{ formatCurrency(attackScenario?.postTradeMoonUsdPriceUsd) }}</strong>
        </div>
        <div>
          <span>Price impact vs $1</span>
          <strong>{{ formatPercent(attackScenario?.priceImpactVsPegPercent) }}</strong>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.attack-hero-card,
.control-card,
.summary-card {
  padding: 24px;
}

.hero-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(20, 20, 20, 0.06);
}

.hero-row:first-child {
  padding-top: 0;
}

.hero-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.hero-row span,
.field-block span,
.analysis-grid span {
  color: var(--text-muted);
}

.control-head,
.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.control-grid,
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.field-block span {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.button-row {
  margin-top: 18px;
}

.button.active {
  box-shadow: 0 16px 28px rgba(239, 182, 29, 0.35);
}

.analysis-grid div {
  padding: 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(20, 20, 20, 0.06);
}

.analysis-grid span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.88rem;
}

@media (max-width: 640px) {
  .hero-row,
  .control-head,
  .summary-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .control-grid,
  .analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
