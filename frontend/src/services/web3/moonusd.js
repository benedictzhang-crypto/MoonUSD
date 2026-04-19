import { ethers } from 'ethers'
import {
  hasLiveContractsConfig,
  MOONUSD_CONFIG,
  MOONUSD_TOKEN_ABI,
  MOONVAULT_ABI,
} from './contracts'
import { getWalletProvider } from './wallet'

export { MOONUSD_CONFIG }

const COLLATERAL_RATIO_WARNING = 170
const COLLATERAL_RATIO_HEALTHY = 200
const MAX_LOG_BLOCK_RANGE = 50_000

function getReadProviderError() {
  return new Error(
    'No Sepolia read provider is available. Connect MetaMask on Sepolia or set VITE_SEPOLIA_RPC_URL.',
  )
}

function getWriteProviderError() {
  return new Error('MetaMask on Sepolia is required for contract writes.')
}

function toFloat(value, decimals = 18) {
  return Number(ethers.formatUnits(value, decimals))
}

function getExplorerBaseUrl() {
  return 'https://sepolia.etherscan.io'
}

async function getReadProvider() {
  const injectedProvider = getWalletProvider()

  if (injectedProvider) {
    const browserProvider = new ethers.BrowserProvider(injectedProvider)
    const network = await browserProvider.getNetwork()

    if (Number(network.chainId) === MOONUSD_CONFIG.chainIdDecimal) {
      return browserProvider
    }
  }

  if (MOONUSD_CONFIG.rpcUrl) {
    return new ethers.JsonRpcProvider(MOONUSD_CONFIG.rpcUrl)
  }

  throw getReadProviderError()
}

async function getReadContracts() {
  if (!hasLiveContractsConfig()) {
    throw new Error(
      'Sepolia contract addresses are not configured yet. Fill frontend/.env.local after deployment.',
    )
  }

  const provider = await getReadProvider()

  return {
    provider,
    moonUsdToken: new ethers.Contract(
      MOONUSD_CONFIG.stablecoinContract,
      MOONUSD_TOKEN_ABI,
      provider,
    ),
    moonVault: new ethers.Contract(MOONUSD_CONFIG.vaultContract, MOONVAULT_ABI, provider),
  }
}

async function getWriteContracts() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw getWriteProviderError()
  }

  if (!hasLiveContractsConfig()) {
    throw new Error(
      'Sepolia contract addresses are not configured yet. Fill frontend/.env.local after deployment.',
    )
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const network = await provider.getNetwork()

  if (Number(network.chainId) !== MOONUSD_CONFIG.chainIdDecimal) {
    throw new Error('Switch MetaMask to Sepolia before sending MoonUSD transactions.')
  }

  const signer = await provider.getSigner()

  return {
    provider,
    signer,
    moonUsdToken: new ethers.Contract(MOONUSD_CONFIG.stablecoinContract, MOONUSD_TOKEN_ABI, signer),
    moonVault: new ethers.Contract(MOONUSD_CONFIG.vaultContract, MOONVAULT_ABI, signer),
  }
}

export function isLiveConfigReady() {
  return hasLiveContractsConfig()
}

async function getActiveVaultCount(provider, moonVault) {
  const latestBlock = await provider.getBlockNumber()
  const fromBlock = Math.max(latestBlock - MAX_LOG_BLOCK_RANGE, 0)
  const filter = moonVault.filters.CollateralDeposited()
  const logs = await moonVault.queryFilter(filter, fromBlock, latestBlock)

  if (!logs.length) {
    return 0
  }

  const uniqueUsers = [...new Set(logs.map((log) => log.args.user.toLowerCase()))]
  const vaults = await Promise.all(uniqueUsers.map((user) => moonVault.getVault(user)))

  return vaults.filter(
    (vault) => vault.collateralWei > 0n || vault.mintedDebtMoonUsd > 0n,
  ).length
}

function getHealthFromSystem({ totalCollateralEth, totalSupply, ethPrice }) {
  if (totalSupply <= 0) {
    return {
      pegPrice: null,
      healthScore: 100,
      statusLabel: 'No debt minted yet',
      systemCollateralRatio: Number.POSITIVE_INFINITY,
    }
  }

  const totalCollateralUsd = totalCollateralEth * ethPrice
  const systemCollateralRatio = (totalCollateralUsd / totalSupply) * 100
  const healthScore = Math.max(0, Math.min(100, Math.round((systemCollateralRatio / 3) * 1)))

  if (systemCollateralRatio >= COLLATERAL_RATIO_HEALTHY) {
    return {
      pegPrice: null,
      healthScore,
      statusLabel: 'Healthy collateral coverage',
      systemCollateralRatio,
    }
  }

  if (systemCollateralRatio >= COLLATERAL_RATIO_WARNING) {
    return {
      pegPrice: null,
      healthScore,
      statusLabel: 'Watch collateral coverage',
      systemCollateralRatio,
    }
  }

  return {
    pegPrice: null,
    healthScore,
    statusLabel: 'Collateral coverage tightening',
    systemCollateralRatio,
  }
}

export async function readSystemState() {
  const { provider, moonVault } = await getReadContracts()

  const [ethPriceRaw, totalCollateralRaw, totalSupplyRaw] = await Promise.all([
    moonVault.getEthPrice(),
    moonVault.getTotalSystemCollateral(),
    moonVault.getTotalMoonUsdSupply(),
  ])

  const ethPrice = Number(ethers.formatUnits(ethPriceRaw, 8))
  const totalCollateralEth = toFloat(totalCollateralRaw)
  const totalSupply = toFloat(totalSupplyRaw)
  let activeVaults = 0

  if (totalCollateralEth > 0 || totalSupply > 0) {
    try {
      activeVaults = await getActiveVaultCount(provider, moonVault)
    } catch {
      activeVaults = null
    }
  }

  const health = getHealthFromSystem({
    totalCollateralEth,
    totalSupply,
    ethPrice,
  })

  return {
    ethPrice,
    totalCollateralEth,
    totalSupply,
    activeVaults,
    pegPrice: health.pegPrice,
    healthScore: health.healthScore,
    statusLabel: health.statusLabel,
    systemCollateralRatio: health.systemCollateralRatio,
  }
}

export async function readVaultState(account) {
  if (!account) {
    throw new Error('A connected wallet address is required to read the vault state.')
  }

  const { provider, moonUsdToken, moonVault } = await getReadContracts()

  const [walletEthRaw, walletMoonUsdRaw, vaultSnapshot] = await Promise.all([
    provider.getBalance(account),
    moonUsdToken.balanceOf(account),
    moonVault.getVault(account),
  ])

  const collateralRatio =
    vaultSnapshot.collateralRatio === ethers.MaxUint256
      ? Number.POSITIVE_INFINITY
      : Number(vaultSnapshot.collateralRatio)

  return {
    walletEth: toFloat(walletEthRaw),
    walletMoonUsd: toFloat(walletMoonUsdRaw),
    depositedEth: toFloat(vaultSnapshot.collateralWei),
    mintedMoonUsd: toFloat(vaultSnapshot.mintedDebtMoonUsd),
    collateralValueUsd: Number(ethers.formatUnits(vaultSnapshot.collateralValueUsd, 18)),
    collateralRatio,
  }
}

export async function readLiquidationPreview(targetAccount, burnAmountMoonUsd) {
  if (!ethers.isAddress(targetAccount)) {
    throw new Error('Enter a valid target wallet address for liquidation preview.')
  }

  const { moonVault } = await getReadContracts()
  const burnAmount = Number(burnAmountMoonUsd)
  const normalizedBurn = Number.isFinite(burnAmount) && burnAmount > 0 ? burnAmount : 0

  const [vaultSnapshot, maxPartialBurnRaw, quote] = await Promise.all([
    moonVault.getVault(targetAccount),
    moonVault.getMaxPartialLiquidationMoonUsd(targetAccount),
    normalizedBurn > 0
      ? moonVault.getLiquidationQuote(targetAccount, ethers.parseEther(String(normalizedBurn)))
      : Promise.resolve([0n, 0n, false]),
  ])

  const currentRatio =
    vaultSnapshot.collateralRatio === ethers.MaxUint256
      ? Number.POSITIVE_INFINITY
      : Number(vaultSnapshot.collateralRatio)

  const resultingRatio =
    quote.resultingCollateralRatio === ethers.MaxUint256
      ? Number.POSITIVE_INFINITY
      : Number(quote.resultingCollateralRatio)

  return {
    targetAddress: targetAccount,
    collateralEth: toFloat(vaultSnapshot.collateralWei),
    debtMoonUsd: toFloat(vaultSnapshot.mintedDebtMoonUsd),
    currentCollateralRatio: currentRatio,
    maxPartialBurnMoonUsd: toFloat(maxPartialBurnRaw),
    collateralToSeizeEth: toFloat(quote.collateralToSeizeWei),
    resultingCollateralRatio: resultingRatio,
    canLiquidate: Boolean(quote.canLiquidate),
  }
}

export async function depositCollateral(amountEth) {
  const { moonVault } = await getWriteContracts()
  return moonVault.depositCollateral({
    value: ethers.parseEther(String(amountEth)),
  })
}

export async function mintMoonUsd(amountMoonUsd) {
  const { moonVault } = await getWriteContracts()
  return moonVault.mint(ethers.parseEther(String(amountMoonUsd)))
}

export async function burnAndRedeem({ burnAmount, redeemAmount }) {
  const { moonVault } = await getWriteContracts()
  return moonVault.burnAndRedeem(
    ethers.parseEther(String(burnAmount || 0)),
    ethers.parseEther(String(redeemAmount || 0)),
  )
}

export async function liquidateVault(targetAccount, burnAmountMoonUsd) {
  const { moonVault } = await getWriteContracts()
  return moonVault.liquidate(targetAccount, ethers.parseEther(String(burnAmountMoonUsd)))
}

export function getTransactionExplorerUrl(hash) {
  return `${getExplorerBaseUrl()}/tx/${hash}`
}

export function getAddressExplorerUrl(address) {
  return `${getExplorerBaseUrl()}/address/${address}`
}
