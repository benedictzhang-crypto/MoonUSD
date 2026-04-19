import { computed, reactive, watch } from 'vue'
import { useWallet } from './useWallet'
import {
  burnAndRedeem as burnAndRedeemOnChain,
  depositCollateral as depositCollateralOnChain,
  getTransactionExplorerUrl,
  isLiveConfigReady,
  liquidateVault as liquidateVaultOnChain,
  MOONUSD_CONFIG,
  mintMoonUsd as mintMoonUsdOnChain,
  readLiquidationPreview,
  readSystemState,
  readVaultState,
} from '../services/web3/moonusd'

export const MIN_COLLATERAL_RATIO = 150

const { walletState, isSepolia } = useWallet()

function emptyVaultState() {
  return {
    walletEth: null,
    walletMoonUsd: null,
    depositedEth: null,
    mintedMoonUsd: null,
    collateralValueUsd: null,
    collateralRatio: null,
  }
}

function emptySystemState() {
  return {
    ethPrice: null,
    totalCollateralEth: null,
    totalSupply: null,
    pegPrice: null,
    activeVaults: null,
    healthScore: null,
    statusLabel: 'Loading Sepolia data',
    systemCollateralRatio: null,
  }
}

function emptyLiquidationPreview() {
  return {
    targetAddress: '',
    burnAmount: '',
    isLoading: false,
    error: '',
    data: null,
  }
}

const state = reactive({
  vault: emptyVaultState(),
  system: emptySystemState(),
  lastAction: {
    tone: 'neutral',
    title: 'Live mode',
    message: 'MoonUSD now uses Sepolia data and real transactions only.',
    txHash: '',
    txUrl: '',
  },
  transaction: {
    pendingAction: '',
    hash: '',
    url: '',
  },
  liquidationPreview: emptyLiquidationPreview(),
  liveConfigReady: isLiveConfigReady(),
  hasSystemData: false,
  hasVaultData: false,
  isSyncing: false,
})

let watcherStarted = false
let activeRefresh = null

const collateralValueUsd = computed(() => state.vault.collateralValueUsd)

const collateralRatio = computed(() => {
  if (
    Number.isFinite(state.vault.collateralRatio) ||
    state.vault.collateralRatio === Number.POSITIVE_INFINITY
  ) {
    return state.vault.collateralRatio
  }

  return null
})

const maxMintableMoonUsd = computed(() => {
  if (!Number.isFinite(collateralValueUsd.value) || !Number.isFinite(state.vault.mintedMoonUsd)) {
    return null
  }

  const safeDebtLimit = collateralValueUsd.value / (MIN_COLLATERAL_RATIO / 100)
  return Math.max(safeDebtLimit - state.vault.mintedMoonUsd, 0)
})

const redeemableEth = computed(() => {
  if (!Number.isFinite(state.vault.depositedEth) || !Number.isFinite(state.vault.mintedMoonUsd)) {
    return null
  }

  if (state.vault.mintedMoonUsd <= 0) {
    return state.vault.depositedEth
  }

  if (!Number.isFinite(state.system.ethPrice) || state.system.ethPrice <= 0) {
    return null
  }

  const minimumCollateralUsd = state.vault.mintedMoonUsd * (MIN_COLLATERAL_RATIO / 100)
  const minimumCollateralEth = minimumCollateralUsd / state.system.ethPrice
  return Math.max(state.vault.depositedEth - minimumCollateralEth, 0)
})

const pegStatus = computed(() => ({
  label: 'Unavailable',
  tone: 'neutral',
}))

const healthTone = computed(() => {
  if (!Number.isFinite(state.system.healthScore)) {
    return 'neutral'
  }

  if (state.system.healthScore >= 85) {
    return 'success'
  }

  if (state.system.healthScore >= 70) {
    return 'warning'
  }

  return 'danger'
})

const dataSourceLabel = computed(() => {
  if (!state.liveConfigReady) {
    return 'Config missing'
  }

  if (state.hasVaultData) {
    return 'Sepolia live'
  }

  if (state.hasSystemData) {
    return 'Sepolia read-only'
  }

  return 'Sync required'
})

const dataSourceTone = computed(() => {
  if (!state.liveConfigReady) {
    return 'danger'
  }

  if (state.hasVaultData) {
    return 'success'
  }

  if (state.hasSystemData) {
    return 'warning'
  }

  return 'neutral'
})

const hasPendingTransaction = computed(() => Boolean(state.transaction.pendingAction))

function setAction(tone, title, message, metadata = {}) {
  state.lastAction = {
    tone,
    title,
    message,
    txHash: metadata.txHash || '',
    txUrl: metadata.txUrl || '',
  }
}

function shortHash(hash) {
  if (!hash) {
    return ''
  }

  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function normalizeAmount(amount) {
  const numeric = Number(amount)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Number(numeric.toFixed(6))
}

function normalizeError(error) {
  const message =
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    'The transaction could not be completed.'

  return message.replace('execution reverted: ', '')
}

function resetVaultState() {
  state.vault = emptyVaultState()
  state.hasVaultData = false
}

function clearLiquidationPreview() {
  state.liquidationPreview = emptyLiquidationPreview()
}

function beginTransaction(actionKey, tx, submittedTitle) {
  state.transaction = {
    pendingAction: actionKey,
    hash: tx.hash,
    url: getTransactionExplorerUrl(tx.hash),
  }

  setAction(
    'neutral',
    `${submittedTitle} submitted`,
    `Waiting for Sepolia confirmation. Tx ${shortHash(tx.hash)} is now pending.`,
    {
      txHash: tx.hash,
      txUrl: state.transaction.url,
    },
  )
}

function finishTransaction() {
  state.transaction = {
    ...state.transaction,
    pendingAction: '',
  }
}

function isActionPending(actionKey) {
  return state.transaction.pendingAction === actionKey
}

function ensureLiveWritesReady(actionLabel) {
  if (!state.liveConfigReady) {
    setAction(
      'danger',
      `${actionLabel} unavailable`,
      'Sepolia contract addresses are missing from the frontend configuration.',
    )
    return false
  }

  if (hasPendingTransaction.value) {
    setAction(
      'warning',
      'Transaction pending',
      'Wait for the current Sepolia transaction to confirm before sending another one.',
      {
        txHash: state.transaction.hash,
        txUrl: state.transaction.url,
      },
    )
    return false
  }

  if (!walletState.isConnected || walletState.mode !== 'metamask') {
    setAction(
      'warning',
      `${actionLabel} unavailable`,
      'Connect MetaMask before sending a live MoonUSD transaction.',
    )
    return false
  }

  if (!isSepolia.value) {
    setAction(
      'warning',
      `${actionLabel} unavailable`,
      'Switch MetaMask to Sepolia before sending a live MoonUSD transaction.',
    )
    return false
  }

  return true
}

export async function refreshFromChain(options = {}) {
  const { silent = false } = options

  state.liveConfigReady = isLiveConfigReady()

  if (!state.liveConfigReady) {
    state.hasSystemData = false
    resetVaultState()

    if (!silent) {
      setAction(
        'danger',
        'Config missing',
        'The frontend is missing Sepolia contract addresses. Check frontend/.env.local.',
      )
    }

    return false
  }

  if (activeRefresh) {
    return activeRefresh
  }

  state.isSyncing = true

  activeRefresh = (async () => {
    try {
      const nextSystem = await readSystemState()
      state.system = {
        ...state.system,
        ...nextSystem,
      }
      state.hasSystemData = true

      if (walletState.mode === 'metamask' && walletState.address && isSepolia.value) {
        const nextVault = await readVaultState(walletState.address)
        state.vault = {
          ...emptyVaultState(),
          ...nextVault,
        }
        state.hasVaultData = true

        if (!silent) {
          setAction(
            'success',
            'Sepolia data refreshed',
            'Live system metrics and your personal vault balances were reloaded from Sepolia.',
          )
        }
      } else {
        resetVaultState()

        if (!silent) {
          setAction(
            'warning',
            'System data loaded',
            'Live protocol metrics are loaded. Connect MetaMask on Sepolia to load your personal vault.',
          )
        }
      }

      return true
    } catch (error) {
      state.hasSystemData = false
      resetVaultState()

      if (!silent) {
        setAction('danger', 'Sepolia sync failed', normalizeError(error))
      }

      return false
    } finally {
      state.isSyncing = false
      activeRefresh = null
    }
  })()

  return activeRefresh
}

function startWalletWatcher() {
  if (watcherStarted) {
    return
  }

  watcherStarted = true

  watch(
    () => [walletState.address, walletState.chainId, walletState.mode],
    () => {
      void refreshFromChain({ silent: true })
    },
    { immediate: true },
  )
}

async function runTransaction(actionKey, submittedTitle, confirmedTitle, confirmedMessage, callback) {
  if (!ensureLiveWritesReady(submittedTitle)) {
    return false
  }

  try {
    const tx = await callback()
    beginTransaction(actionKey, tx, submittedTitle)
    await tx.wait()
    finishTransaction()
    try {
      await refreshFromChain({ silent: true })
    } catch {
      // The transaction already confirmed on-chain. Keep the success state even if the refresh fails.
    }
    setAction('success', confirmedTitle, confirmedMessage(tx.hash), {
      txHash: tx.hash,
      txUrl: getTransactionExplorerUrl(tx.hash),
    })
    return true
  } catch (error) {
    finishTransaction()
    setAction('warning', `${submittedTitle} failed`, normalizeError(error))
    return false
  }
}

async function previewLiquidation(targetAddress, burnAmount) {
  if (!targetAddress) {
    clearLiquidationPreview()
    return null
  }

  state.liquidationPreview = {
    ...state.liquidationPreview,
    targetAddress,
    burnAmount: burnAmount || '',
    isLoading: true,
    error: '',
  }

  try {
    const preview = await readLiquidationPreview(targetAddress, burnAmount || 0)
    state.liquidationPreview = {
      targetAddress,
      burnAmount: burnAmount || '',
      isLoading: false,
      error: '',
      data: preview,
    }
    return preview
  } catch (error) {
    state.liquidationPreview = {
      targetAddress,
      burnAmount: burnAmount || '',
      isLoading: false,
      error: normalizeError(error),
      data: null,
    }
    return null
  }
}

async function deposit(amount) {
  const numeric = normalizeAmount(amount)

  if (!numeric) {
    setAction('warning', 'Invalid deposit', 'Enter a positive ETH amount before depositing.')
    return false
  }

  return runTransaction(
    'deposit',
    'Deposit',
    'Deposit confirmed',
    (hash) => `Deposit confirmed on Sepolia. Tx ${shortHash(hash)} is on Etherscan.`,
    () => depositCollateralOnChain(numeric),
  )
}

async function mint(amount) {
  const numeric = normalizeAmount(amount)

  if (!numeric) {
    setAction('warning', 'Invalid mint amount', 'Enter a positive MoonUSD amount to mint.')
    return false
  }

  return runTransaction(
    'mint',
    'Mint',
    'Mint confirmed',
    (hash) => `MoonUSD mint confirmed on Sepolia. Tx ${shortHash(hash)} is on Etherscan.`,
    () => mintMoonUsdOnChain(numeric),
  )
}

async function burn(amount) {
  const numeric = normalizeAmount(amount)

  if (!numeric) {
    setAction('warning', 'Invalid burn amount', 'Enter a positive MoonUSD amount to burn.')
    return false
  }

  return runTransaction(
    'burn',
    'Burn',
    'Burn confirmed',
    (hash) => `MoonUSD burn confirmed on Sepolia. Tx ${shortHash(hash)} is on Etherscan.`,
    () =>
      burnAndRedeemOnChain({
        burnAmount: numeric,
        redeemAmount: 0,
      }),
  )
}

async function redeem(amount) {
  const numeric = normalizeAmount(amount)

  if (!numeric) {
    setAction('warning', 'Invalid redeem amount', 'Enter a positive ETH amount to redeem.')
    return false
  }

  return runTransaction(
    'redeem',
    'Redeem',
    'Redeem confirmed',
    (hash) => `ETH redeem confirmed on Sepolia. Tx ${shortHash(hash)} is on Etherscan.`,
    () =>
      burnAndRedeemOnChain({
        burnAmount: 0,
        redeemAmount: numeric,
      }),
  )
}

async function liquidate(targetAddress, burnAmount) {
  const numeric = normalizeAmount(burnAmount)

  if (!targetAddress) {
    setAction('warning', 'Invalid liquidation target', 'Enter the target vault address first.')
    return false
  }

  if (!numeric) {
    setAction('warning', 'Invalid liquidation amount', 'Enter a positive MoonUSD amount to burn.')
    return false
  }

  const didSucceed = await runTransaction(
    'liquidate',
    'Liquidation',
    'Liquidation confirmed',
    (hash) => `Liquidation confirmed on Sepolia. Tx ${shortHash(hash)} is on Etherscan.`,
    () => liquidateVaultOnChain(targetAddress, numeric),
  )

  if (didSucceed) {
    clearLiquidationPreview()
  }

  return didSucceed
}

export function useMoonUsd() {
  startWalletWatcher()

  return {
    state,
    collateralValueUsd,
    collateralRatio,
    maxMintableMoonUsd,
    redeemableEth,
    pegStatus,
    healthTone,
    dataSourceLabel,
    dataSourceTone,
    hasPendingTransaction,
    isActionPending,
    previewLiquidation,
    clearLiquidationPreview,
    refreshFromChain,
    deploymentConfig: MOONUSD_CONFIG,
    deposit,
    mint,
    burn,
    redeem,
    liquidate,
  }
}
