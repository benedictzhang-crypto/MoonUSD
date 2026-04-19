<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import HeroPanel from '../components/HeroPanel.vue'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useMoonUsd } from '../composables/useMoonUsd'
import { useWallet } from '../composables/useWallet'
import {
  addMoonSwapLiquidity,
  approveMoonSwapSpend,
  getMoonSwapPoolExplorerUrl,
  getMoonSwapTransactionExplorerUrl,
  isLiveSwapReady,
  quoteMoonSwapAddLiquidity,
  quoteMoonSwapEthToMoonUsd,
  quoteMoonSwapMoonUsdToEth,
  readMoonSwapState,
  swapMoonSwapEthForMoonUsd,
  swapMoonSwapMoonUsdForEth,
} from '../services/web3/moonswap'
import { getMoonUsdSwapUrl } from '../services/web3/uniswap'
import {
  formatCurrency,
  formatEth,
  formatNumber,
  formatPercent,
} from '../utils/formatters'

const { state, refreshFromChain, dataSourceLabel, dataSourceTone } = useMoonUsd()
const { walletState, isSepolia, connectWallet, switchToSepolia } = useWallet()

const liquidityEth = ref('0.10')
const buyEthAmount = ref('0.01')
const sellMoonUsdAmount = ref('10')

const actionState = reactive({
  pendingAction: '',
  lastAction: {
    tone: 'neutral',
    title: 'Swap demo ready',
    message: 'Use MoonSwapPool on Sepolia for the classroom demo, or jump to Uniswap if their interface is working again.',
    txUrl: '',
  },
  pool: {
    reserveEth: null,
    reserveMoonUsd: null,
    totalLiquidityShares: null,
    walletMoonUsdAllowance: null,
    walletLiquidityShares: null,
    feePercent: null,
  },
  quotes: {
    liquidityMoonUsd: null,
    liquidityShares: null,
    buyMoonUsd: null,
    sellEth: null,
  },
  isLoadingPool: false,
})

const liveSwapReady = computed(() => isLiveSwapReady())
const uniswapSwapUrl = computed(() => getMoonUsdSwapUrl(0.05))
const moonSwapPoolUrl = computed(() => (liveSwapReady.value ? getMoonSwapPoolExplorerUrl() : ''))

const poolHasLiquidity = computed(() => (
  Number.isFinite(actionState.pool.reserveEth) &&
  actionState.pool.reserveEth > 0 &&
  Number.isFinite(actionState.pool.reserveMoonUsd) &&
  actionState.pool.reserveMoonUsd > 0
))

const needsMoonUsdApproval = computed(() => {
  if (!Number.isFinite(actionState.pool.walletMoonUsdAllowance)) {
    return true
  }

  const neededForLiquidity = Number(actionState.quotes.liquidityMoonUsd || 0)
  const neededForSell = Number(sellMoonUsdAmount.value || 0)
  const maxNeeded = Math.max(neededForLiquidity, neededForSell)

  return actionState.pool.walletMoonUsdAllowance < maxNeeded
})

const maxSeedEthFromWalletMoonUsd = computed(() => {
  if (poolHasLiquidity.value) {
    return null
  }

  if (!Number.isFinite(state.vault.walletMoonUsd) || state.vault.walletMoonUsd <= 0) {
    return null
  }

  if (!Number.isFinite(state.system.ethPrice) || state.system.ethPrice <= 0) {
    return null
  }

  const moonUsdLimitedEth = state.vault.walletMoonUsd / state.system.ethPrice

  if (!Number.isFinite(state.vault.walletEth) || state.vault.walletEth <= 0) {
    return moonUsdLimitedEth
  }

  return Math.max(Math.min(moonUsdLimitedEth, state.vault.walletEth - 0.01), 0)
})

function normalizeAmount(amount) {
  const numeric = Number(amount)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Number(numeric.toFixed(6))
}

function shortHashFromUrl(txUrl) {
  if (!txUrl) {
    return ''
  }

  const hash = txUrl.split('/').pop() || ''
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function setAction(tone, title, message, txUrl = '') {
  actionState.lastAction = {
    tone,
    title,
    message,
    txUrl,
  }
}

async function loadPoolState({ silent = false } = {}) {
  if (!liveSwapReady.value) {
    actionState.pool = {
      reserveEth: null,
      reserveMoonUsd: null,
      totalLiquidityShares: null,
      walletMoonUsdAllowance: null,
      walletLiquidityShares: null,
      feePercent: null,
    }

    if (!silent) {
      setAction('warning', 'Swap pool missing', 'Deploy MoonSwapPool to Sepolia before using the local swap demo.')
    }

    return false
  }

  actionState.isLoadingPool = true

  try {
    const nextPool = await readMoonSwapState(walletState.address)
    actionState.pool = nextPool
    return true
  } catch (error) {
    if (!silent) {
      setAction('danger', 'Swap pool sync failed', error.message || 'Could not load MoonSwapPool state.')
    }
    return false
  } finally {
    actionState.isLoadingPool = false
  }
}

async function updateLiquidityQuote() {
  const ethAmount = normalizeAmount(liquidityEth.value)

  if (!ethAmount) {
    actionState.quotes.liquidityMoonUsd = null
    actionState.quotes.liquidityShares = null
    return
  }

  if (!poolHasLiquidity.value) {
    actionState.quotes.liquidityMoonUsd =
      Number.isFinite(state.system.ethPrice) && state.system.ethPrice > 0
        ? Number((ethAmount * state.system.ethPrice).toFixed(4))
        : null
    actionState.quotes.liquidityShares = null
    return
  }

  try {
    const quote = await quoteMoonSwapAddLiquidity(ethAmount)
    actionState.quotes.liquidityMoonUsd = quote.requiredMoonUsd
    actionState.quotes.liquidityShares = quote.estimatedShares
  } catch {
    actionState.quotes.liquidityMoonUsd = null
    actionState.quotes.liquidityShares = null
  }
}

async function updateSwapQuotes() {
  const buyAmount = normalizeAmount(buyEthAmount.value)
  const sellAmount = normalizeAmount(sellMoonUsdAmount.value)

  if (buyAmount && Number.isFinite(actionState.pool.reserveEth) && actionState.pool.reserveEth > 0) {
    try {
      actionState.quotes.buyMoonUsd = await quoteMoonSwapEthToMoonUsd(buyAmount)
    } catch {
      actionState.quotes.buyMoonUsd = null
    }
  } else {
    actionState.quotes.buyMoonUsd = null
  }

  if (sellAmount && Number.isFinite(actionState.pool.reserveMoonUsd) && actionState.pool.reserveMoonUsd > 0) {
    try {
      actionState.quotes.sellEth = await quoteMoonSwapMoonUsdToEth(sellAmount)
    } catch {
      actionState.quotes.sellEth = null
    }
  } else {
    actionState.quotes.sellEth = null
  }
}

async function refreshSwapDemo() {
  await refreshFromChain({ silent: true })
  await loadPoolState({ silent: true })
  await Promise.all([updateLiquidityQuote(), updateSwapQuotes()])
}

async function ensureWalletReady(actionLabel) {
  if (!walletState.isConnected) {
    setAction('neutral', 'Connecting wallet', 'MetaMask is opening a wallet connection request.')
    await connectWallet()

    if (!walletState.isConnected) {
      setAction(
        'warning',
        `${actionLabel} unavailable`,
        walletState.status || 'Connect MetaMask before using the local swap demo.',
      )
      return false
    }
  }

  if (!isSepolia.value) {
    setAction('neutral', 'Switching to Sepolia', 'MetaMask is opening a Sepolia network switch request.')
    await switchToSepolia()

    if (!isSepolia.value) {
      setAction(
        'warning',
        `${actionLabel} unavailable`,
        walletState.status || 'Switch MetaMask to Sepolia before using the local swap demo.',
      )
      return false
    }
  }

  if (!liveSwapReady.value) {
    setAction('warning', `${actionLabel} unavailable`, 'MoonSwapPool is not configured in the frontend yet.')
    return false
  }

  return true
}

async function runPoolTransaction(actionKey, title, callback) {
  if (actionState.pendingAction) {
    setAction('warning', 'Transaction pending', 'Wait for the current Sepolia transaction to confirm before sending another one.')
    return false
  }

  actionState.pendingAction = actionKey

  try {
    const tx = await callback()
    const txUrl = getMoonSwapTransactionExplorerUrl(tx.hash)
    setAction('neutral', `${title} submitted`, `Waiting for confirmation. Tx ${shortHashFromUrl(txUrl)} is pending.`, txUrl)
    await tx.wait()
    await refreshSwapDemo()
    setAction('success', `${title} confirmed`, `Sepolia confirmed the transaction. Tx ${shortHashFromUrl(txUrl)} is on Etherscan.`, txUrl)
    return true
  } catch (error) {
    setAction('warning', `${title} failed`, error?.shortMessage || error?.message || 'The swap transaction could not be completed.')
    return false
  } finally {
    actionState.pendingAction = ''
  }
}

async function handleApproveMoonUsd() {
  if (!(await ensureWalletReady('Approval'))) {
    return
  }

  await runPoolTransaction('approve', 'MoonUSD approval', () => approveMoonSwapSpend())
}

async function ensureMoonUsdApproval(requiredAmount) {
  if (
    Number.isFinite(actionState.pool.walletMoonUsdAllowance) &&
    actionState.pool.walletMoonUsdAllowance >= requiredAmount
  ) {
    return true
  }

  return runPoolTransaction('approve', 'MoonUSD approval', () => approveMoonSwapSpend())
}

async function handleAddLiquidity() {
  setAction('neutral', 'Add liquidity clicked', 'Preparing a MetaMask transaction for MoonSwapPool.')

  if (!(await ensureWalletReady('Add liquidity'))) {
    return
  }

  const ethAmount = normalizeAmount(liquidityEth.value)
  const moonUsdAmount = Number(actionState.quotes.liquidityMoonUsd)

  if (!ethAmount || !Number.isFinite(moonUsdAmount) || moonUsdAmount <= 0) {
    setAction('warning', 'Add liquidity unavailable', 'Enter a valid ETH amount and wait for the MoonUSD quote.')
    return
  }

  if (!(await ensureMoonUsdApproval(moonUsdAmount))) {
    return
  }

  const maxMoonUsdAmount = Number((moonUsdAmount * 1.01).toFixed(6))
  await runPoolTransaction('liquidity', 'Liquidity add', () =>
    addMoonSwapLiquidity(ethAmount, maxMoonUsdAmount, 0),
  )
}

async function handleBuyMoonUsd() {
  setAction('neutral', 'Buy clicked', 'Preparing a MetaMask transaction to swap ETH for MoonUSD.')

  if (!(await ensureWalletReady('Buy MoonUSD'))) {
    return
  }

  const ethAmount = normalizeAmount(buyEthAmount.value)
  const quotedMoonUsd = Number(actionState.quotes.buyMoonUsd)

  if (!ethAmount || !Number.isFinite(quotedMoonUsd) || quotedMoonUsd <= 0) {
    setAction('warning', 'Buy unavailable', 'Enter a valid ETH amount and wait for the quote.')
    return
  }

  const minMoonUsdOut = Number((quotedMoonUsd * 0.98).toFixed(6))
  await runPoolTransaction('buy', 'MoonUSD buy', () =>
    swapMoonSwapEthForMoonUsd(ethAmount, minMoonUsdOut),
  )
}

async function handleSellMoonUsd() {
  setAction('neutral', 'Sell clicked', 'Preparing a MetaMask transaction to swap MoonUSD for ETH.')

  if (!(await ensureWalletReady('Sell MoonUSD'))) {
    return
  }

  const moonUsdAmount = normalizeAmount(sellMoonUsdAmount.value)
  const quotedEthOut = Number(actionState.quotes.sellEth)

  if (!moonUsdAmount || !Number.isFinite(quotedEthOut) || quotedEthOut <= 0) {
    setAction('warning', 'Sell unavailable', 'Enter a valid MoonUSD amount and wait for the quote.')
    return
  }

  if (!(await ensureMoonUsdApproval(moonUsdAmount))) {
    return
  }

  const minEthOut = Number((quotedEthOut * 0.98).toFixed(6))
  await runPoolTransaction('sell', 'MoonUSD sell', () =>
    swapMoonSwapMoonUsdForEth(moonUsdAmount, minEthOut),
  )
}

watch(
  () => [walletState.address, walletState.chainId, state.system.ethPrice],
  () => {
    void refreshSwapDemo()
  },
  { immediate: true },
)

watch(liquidityEth, () => {
  void updateLiquidityQuote()
})

watch([buyEthAmount, sellMoonUsdAmount], () => {
  void updateSwapQuotes()
})

onMounted(() => {
  void refreshSwapDemo()
})
</script>

<template>
  <div class="section">
    <HeroPanel
      eyebrow="Swap demo"
      title="Run the local MoonUSD swap demo"
      description="This page uses a simple MoonSwapPool on Sepolia so the course demo does not depend on third-party frontends. The Uniswap jump is still here if their interface becomes available again."
    >
      <template #actions>
        <div class="button-row">
          <button class="button" type="button" @click="refreshSwapDemo()">
            {{ actionState.isLoadingPool || state.isSyncing ? 'Refreshing...' : 'Refresh swap data' }}
          </button>
          <a class="button-secondary" :href="uniswapSwapUrl" target="_blank" rel="noreferrer">
            Open Uniswap
          </a>
          <RouterLink class="button-ghost" to="/vault">Mint in Vault</RouterLink>
        </div>
      </template>

      <article class="swap-hero-card">
        <div class="hero-row">
          <span>System data</span>
          <StatusBadge :label="dataSourceLabel" :tone="dataSourceTone" />
        </div>
        <div class="hero-row">
          <span>Pool contract</span>
          <a
            v-if="liveSwapReady"
            class="inline-link"
            :href="moonSwapPoolUrl"
            target="_blank"
            rel="noreferrer"
          >
            View on Etherscan
          </a>
          <strong v-else>Not deployed yet</strong>
        </div>
        <div class="hero-row">
          <span>Pool fee</span>
          <strong>{{ formatPercent(actionState.pool.feePercent, 2) }}</strong>
        </div>
        <div class="hero-row">
          <span>Current reserves</span>
          <strong>{{ formatEth(actionState.pool.reserveEth) }} / {{ formatNumber(actionState.pool.reserveMoonUsd, 2) }} MUSD</strong>
        </div>
      </article>
    </HeroPanel>
  </div>

  <section class="section">
    <article class="status-banner" :class="actionState.lastAction.tone">
      <div>
        <strong>{{ actionState.lastAction.title }}</strong>
        <span>{{ actionState.lastAction.message }}</span>
      </div>
      <a
        v-if="actionState.lastAction.txUrl"
        class="inline-link"
        :href="actionState.lastAction.txUrl"
        target="_blank"
        rel="noreferrer"
      >
        View transaction
      </a>
    </article>
  </section>

  <section class="section">
    <div class="card-grid cols-4">
      <MetricCard
        label="Pool ETH"
        :value="formatEth(actionState.pool.reserveEth)"
        detail="ETH currently sitting inside MoonSwapPool."
      />
      <MetricCard
        label="Pool MoonUSD"
        :value="`${formatNumber(actionState.pool.reserveMoonUsd, 2)} MUSD`"
        detail="MoonUSD reserve currently available for swaps."
      />
      <MetricCard
        label="Your LP Shares"
        :value="formatNumber(actionState.pool.walletLiquidityShares, 4)"
        detail="Liquidity shares owned by the connected wallet."
      />
      <MetricCard
        label="MoonUSD Allowance"
        :value="needsMoonUsdApproval ? 'Approval needed' : 'Approved'"
        detail="Approve once before adding liquidity or selling MoonUSD into the pool."
        :tone="needsMoonUsdApproval ? 'warning' : 'success'"
      />
    </div>
  </section>

  <section class="section">
    <div class="card-grid cols-3">
      <article class="panel-card swap-card">
        <div class="card-head">
          <h2 class="section-title">Approve MoonUSD</h2>
          <StatusBadge :label="needsMoonUsdApproval ? 'Needed' : 'Ready' " :tone="needsMoonUsdApproval ? 'warning' : 'success'" />
        </div>
        <p class="section-copy">
          This one-time approval lets MoonSwapPool use your MoonUSD for liquidity adds and MoonUSD
          sells.
        </p>
        <button
          class="button"
          type="button"
          :disabled="actionState.pendingAction && actionState.pendingAction !== 'approve'"
          @click="handleApproveMoonUsd()"
        >
          {{ actionState.pendingAction === 'approve' ? 'Approving...' : 'Approve MoonUSD' }}
        </button>
      </article>

      <article class="panel-card swap-card">
        <div class="card-head">
          <h2 class="section-title">Add Liquidity</h2>
          <StatusBadge label="ETH + MUSD" tone="neutral" />
        </div>
        <label class="field-block">
          <span>ETH amount</span>
          <input v-model="liquidityEth" class="input-field" type="number" min="0" step="0.01" />
        </label>
        <div class="quote-box">
          <span>MoonUSD needed</span>
          <strong>{{ formatNumber(actionState.quotes.liquidityMoonUsd, 2) }} MUSD</strong>
        </div>
        <div v-if="poolHasLiquidity" class="quote-box">
          <span>Estimated LP shares</span>
          <strong>{{ formatNumber(actionState.quotes.liquidityShares, 4) }}</strong>
        </div>
        <div class="quote-box" v-if="!poolHasLiquidity">
          <span>Starter pool guide</span>
          <strong>
            {{ maxSeedEthFromWalletMoonUsd ? `With your current MUSD balance, seed about ${formatEth(maxSeedEthFromWalletMoonUsd, 4)} or less.` : 'Mint MoonUSD first, then seed the opening ETH/MUSD ratio.' }}
          </strong>
        </div>
        <button
          class="button"
          type="button"
                    @click="handleAddLiquidity()"
        >
          {{ actionState.pendingAction === 'approve' ? 'Approving...' : actionState.pendingAction === 'liquidity' ? 'Adding...' : needsMoonUsdApproval ? 'Approve & Add Liquidity' : 'Add Liquidity' }}
        </button>
      </article>

      <article class="panel-card swap-card">
        <div class="card-head">
          <h2 class="section-title">Buy MoonUSD</h2>
          <StatusBadge label="ETH -> MUSD" tone="success" />
        </div>
        <label class="field-block">
          <span>ETH amount</span>
          <input v-model="buyEthAmount" class="input-field" type="number" min="0" step="0.001" />
        </label>
        <div class="quote-box">
          <span>Estimated MUSD out</span>
          <strong>{{ formatNumber(actionState.quotes.buyMoonUsd, 4) }} MUSD</strong>
        </div>
        <button
          class="button"
          type="button"
                    @click="handleBuyMoonUsd()"
        >
          {{ actionState.pendingAction === 'buy' ? 'Buying...' : 'Swap ETH for MUSD' }}
        </button>
      </article>

      <article class="panel-card swap-card span-two">
        <div class="card-head">
          <h2 class="section-title">Sell MoonUSD</h2>
          <StatusBadge label="MUSD -> ETH" tone="warning" />
        </div>
        <label class="field-block">
          <span>MoonUSD amount</span>
          <input v-model="sellMoonUsdAmount" class="input-field" type="number" min="0" step="1" />
        </label>
        <div class="quote-box">
          <span>Estimated ETH out</span>
          <strong>{{ formatEth(actionState.quotes.sellEth, 6) }}</strong>
        </div>
        <button
          class="button"
          type="button"
                    @click="handleSellMoonUsd()"
        >
          {{ actionState.pendingAction === 'approve' ? 'Approving...' : actionState.pendingAction === 'sell' ? 'Selling...' : needsMoonUsdApproval ? 'Approve & Swap MUSD' : 'Swap MUSD for ETH' }}
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.swap-hero-card,
.swap-card {
  padding: 24px;
}

.hero-row,
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.hero-row {
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
.quote-box span {
  color: var(--text-muted);
}

.swap-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-block span {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.quote-box {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(20, 20, 20, 0.06);
}

.quote-box span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.88rem;
}

.quote-box strong {
  display: block;
}

.span-two {
  grid-column: span 2;
}

@media (max-width: 980px) {
  .span-two {
    grid-column: span 1;
  }
}

@media (max-width: 640px) {
  .hero-row,
  .card-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
