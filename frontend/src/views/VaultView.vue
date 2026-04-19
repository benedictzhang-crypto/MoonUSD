<script setup>
import { computed, ref } from 'vue'
import HeroPanel from '../components/HeroPanel.vue'
import LiquidationActionCard from '../components/LiquidationActionCard.vue'
import MetricCard from '../components/MetricCard.vue'
import VaultActionCard from '../components/VaultActionCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { MIN_COLLATERAL_RATIO, useMoonUsd } from '../composables/useMoonUsd'
import { useWallet } from '../composables/useWallet'
import {
  formatCurrency,
  formatEth,
  formatNumber,
  formatPercent,
} from '../utils/formatters'

const { walletState } = useWallet()
const {
  state,
  collateralValueUsd,
  collateralRatio,
  maxMintableMoonUsd,
  redeemableEth,
  dataSourceLabel,
  dataSourceTone,
  hasPendingTransaction,
  isActionPending,
  previewLiquidation,
  refreshFromChain,
  deposit,
  mint,
  burn,
  redeem,
  liquidate,
} = useMoonUsd()

const depositAmount = ref('')
const mintAmount = ref('')
const burnAmount = ref('')
const redeemAmount = ref('')
const liquidationTarget = ref('')
const liquidationBurnAmount = ref('')

const liquidationPreviewView = computed(() => {
  const preview = state.liquidationPreview.data

  if (!preview) {
    return null
  }

  return {
    currentRatio: formatPercent(preview.currentCollateralRatio),
    debt: `${formatNumber(preview.debtMoonUsd)} MoonUSD`,
    seizeAmount: formatEth(preview.collateralToSeizeEth),
    resultingRatio: formatPercent(preview.resultingCollateralRatio),
  }
})

const liquidationHelperText = computed(() => {
  const preview = state.liquidationPreview.data

  if (!preview) {
    return 'Preview any unhealthy vault address to estimate seized ETH and the resulting collateral ratio.'
  }

  if (preview.currentCollateralRatio >= MIN_COLLATERAL_RATIO) {
    return 'That vault is still healthy, so liquidation is not available yet.'
  }

  if (!state.liquidationPreview.burnAmount) {
    return `This vault is below ${MIN_COLLATERAL_RATIO}%. Enter a MoonUSD burn amount to fetch a precise live liquidation quote.`
  }

  if (!preview.canLiquidate && preview.debtMoonUsd > 0) {
    return `Try a smaller partial burn. Max partial liquidation at current prices is ${formatNumber(preview.maxPartialBurnMoonUsd)} MoonUSD.`
  }

  return `This vault is below ${MIN_COLLATERAL_RATIO}%. A full liquidation can always close the position; partial liquidations are capped by the live collateral value.`
})

async function handleLiquidationPreview() {
  return previewLiquidation(liquidationTarget.value.trim(), liquidationBurnAmount.value)
}

async function handleLiquidationSubmit() {
  return liquidate(liquidationTarget.value.trim(), liquidationBurnAmount.value)
}
</script>

<template>
  <div class="section">
    <HeroPanel
      eyebrow="Vault management"
      title="Manage your MoonUSD vault"
      description="Deposit ETH, mint MoonUSD, burn debt, redeem collateral, and liquidate unhealthy vaults. Every action on this page now maps to a real Sepolia transaction."
    >
      <article class="vault-hero-card">
        <div class="hero-line">
          <span>Wallet status</span>
          <StatusBadge
            :label="walletState.mode === 'metamask' ? 'MetaMask connected' : 'Wallet not connected'"
            :tone="walletState.mode === 'metamask' ? 'success' : 'warning'"
          />
        </div>
        <div class="hero-line">
          <span>Wallet ETH</span>
          <strong>{{ formatEth(state.vault.walletEth) }}</strong>
        </div>
        <div class="hero-line">
          <span>Wallet MoonUSD</span>
          <strong>{{ formatNumber(state.vault.walletMoonUsd) }} MoonUSD</strong>
        </div>
        <div class="hero-line">
          <span>Vault collateral value</span>
          <strong>{{ formatCurrency(collateralValueUsd) }}</strong>
        </div>
      </article>
    </HeroPanel>
  </div>

  <section class="section">
    <div class="status-banner" :class="state.lastAction.tone">
      <div class="status-copy">
        <strong>{{ state.lastAction.title }}</strong>
        <span class="muted-text">{{ state.lastAction.message }}</span>
        <a
          v-if="state.lastAction.txUrl"
          class="inline-link"
          :href="state.lastAction.txUrl"
          target="_blank"
          rel="noreferrer"
        >
          View transaction on Etherscan
        </a>
      </div>
      <div class="status-actions">
        <StatusBadge :label="dataSourceLabel" :tone="dataSourceTone" />
        <StatusBadge
          :label="`Minimum ratio ${MIN_COLLATERAL_RATIO}%`"
          :tone="collateralRatio >= MIN_COLLATERAL_RATIO ? 'success' : 'danger'"
        />
        <StatusBadge
          :label="hasPendingTransaction ? 'Tx pending' : 'Ready'"
          :tone="hasPendingTransaction ? 'warning' : 'success'"
        />
        <button class="button-ghost" type="button" @click="refreshFromChain()">
          {{ state.isSyncing ? 'Refreshing...' : 'Refresh data' }}
        </button>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="card-grid cols-4">
      <MetricCard
        label="Deposited collateral"
        :value="formatEth(state.vault.depositedEth)"
        detail="ETH currently locked in your vault."
      />
      <MetricCard
        label="Minted debt"
        :value="`${formatNumber(state.vault.mintedMoonUsd)} MoonUSD`"
        detail="Outstanding MoonUSD minted from this vault."
      />
      <MetricCard
        label="Collateral ratio"
        :value="formatPercent(collateralRatio)"
        detail="Live ratio for your vault based on the current Sepolia ETH price."
        :tone="collateralRatio >= 200 ? 'success' : collateralRatio >= 150 ? 'warning' : 'danger'"
      />
      <MetricCard
        label="Available to mint"
        :value="`${formatNumber(maxMintableMoonUsd)} MoonUSD`"
        detail="Remaining mint capacity while staying above the 150% minimum."
      />
    </div>
  </section>

  <section class="section">
    <div class="card-grid cols-2">
      <VaultActionCard
        v-model="depositAmount"
        title="Deposit ETH"
        description="Add more ETH collateral before minting or to improve the health of the vault."
        :helper-text="`Wallet balance: ${formatEth(state.vault.walletEth)}`"
        button-label="Deposit collateral"
        input-label="ETH amount"
        :pending="isActionPending('deposit')"
        :disabled="hasPendingTransaction && !isActionPending('deposit')"
        :submit-action="deposit"
      />
      <VaultActionCard
        v-model="mintAmount"
        title="Mint MoonUSD"
        description="Create new MoonUSD against the available collateral while staying above 150%."
        :helper-text="`Mint capacity: ${formatNumber(maxMintableMoonUsd)} MoonUSD`"
        button-label="Mint MoonUSD"
        input-label="MoonUSD amount"
        :pending="isActionPending('mint')"
        :disabled="hasPendingTransaction && !isActionPending('mint')"
        :submit-action="mint"
      />
      <VaultActionCard
        v-model="burnAmount"
        title="Burn MoonUSD"
        description="Burn MoonUSD to reduce debt before redeeming collateral or improving vault safety."
        :helper-text="`Wallet MoonUSD: ${formatNumber(state.vault.walletMoonUsd)} MoonUSD`"
        button-label="Burn MoonUSD"
        input-label="MoonUSD amount"
        :pending="isActionPending('burn')"
        :disabled="hasPendingTransaction && !isActionPending('burn')"
        :submit-action="burn"
      />
      <VaultActionCard
        v-model="redeemAmount"
        title="Redeem ETH"
        description="Withdraw ETH only if the remaining vault still satisfies the minimum collateral ratio."
        :helper-text="`Redeemable now: ${formatEth(redeemableEth)}`"
        button-label="Redeem ETH"
        input-label="ETH amount"
        :pending="isActionPending('redeem')"
        :disabled="hasPendingTransaction && !isActionPending('redeem')"
        :submit-action="redeem"
      />
    </div>
  </section>

  <section class="section">
    <LiquidationActionCard
      :target-address="liquidationTarget"
      :burn-amount="liquidationBurnAmount"
      @update:target-address="liquidationTarget = $event"
      @update:burn-amount="liquidationBurnAmount = $event"
      :helper-text="liquidationHelperText"
      :preview="liquidationPreviewView"
      :preview-error="state.liquidationPreview.error"
      :preview-loading="state.liquidationPreview.isLoading"
      :pending="isActionPending('liquidate')"
      :disabled="hasPendingTransaction && !isActionPending('liquidate')"
      :preview-action="handleLiquidationPreview"
      :submit-action="handleLiquidationSubmit"
    />
  </section>
</template>

<style scoped>
.vault-hero-card {
  width: 100%;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(20, 20, 20, 0.06);
  box-shadow: var(--shadow-soft);
}

.hero-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 15px 0;
  border-bottom: 1px solid rgba(20, 20, 20, 0.06);
}

.hero-line:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.hero-line:first-child {
  padding-top: 0;
}

.hero-line span {
  color: var(--text-muted);
}

.hero-line strong {
  text-align: right;
}

.status-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 560px) {
  .hero-line {
    align-items: flex-start;
    flex-direction: column;
  }

  .status-actions {
    justify-content: flex-start;
  }
}
</style>
