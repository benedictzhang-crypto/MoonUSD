import { ethers } from 'ethers'
import {
  hasLiveSwapConfig,
  MOONSWAPPOOL_ABI,
  MOONUSD_CONFIG,
  MOONUSD_TOKEN_ABI,
  SEPOLIA_READ_RPC_URLS,
} from './contracts'
import { getWalletProvider } from './wallet'

const moonUsdInterface = new ethers.Interface(MOONUSD_TOKEN_ABI)
const moonSwapPoolInterface = new ethers.Interface(MOONSWAPPOOL_ABI)

function getExplorerBaseUrl() {
  return 'https://sepolia.etherscan.io'
}

function toFloat(value, decimals = 18) {
  return Number(ethers.formatUnits(value, decimals))
}

function getReadProviderError() {
  return new Error(
    'No Sepolia read provider is available. Connect MetaMask on Sepolia or set VITE_SEPOLIA_RPC_URL.',
  )
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

  for (const rpcUrl of SEPOLIA_READ_RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      await provider.getBlockNumber()
      return provider
    } catch {
      // Try the next read RPC.
    }
  }

  throw getReadProviderError()
}

async function getReadContracts() {
  if (!hasLiveSwapConfig()) {
    throw new Error('Sepolia swap pool address is not configured yet.')
  }

  const provider = await getReadProvider()

  return {
    provider,
    moonUsdToken: new ethers.Contract(
      MOONUSD_CONFIG.stablecoinContract,
      MOONUSD_TOKEN_ABI,
      provider,
    ),
    moonSwapPool: new ethers.Contract(MOONUSD_CONFIG.swapPoolContract, MOONSWAPPOOL_ABI, provider),
  }
}

async function getWriteContext() {
  const injectedProvider = getWalletProvider()

  if (!injectedProvider) {
    throw new Error('MetaMask on Sepolia is required for swap writes.')
  }

  if (!hasLiveSwapConfig()) {
    throw new Error('Sepolia swap pool address is not configured yet.')
  }

  await injectedProvider.request({ method: 'eth_requestAccounts' })

  const provider = new ethers.BrowserProvider(injectedProvider)
  const network = await provider.getNetwork()

  if (Number(network.chainId) !== MOONUSD_CONFIG.chainIdDecimal) {
    throw new Error('Switch MetaMask to Sepolia before using the swap demo.')
  }

  const signer = await provider.getSigner()
  const from = await signer.getAddress()

  return {
    injectedProvider,
    provider,
    from,
  }
}

async function sendMetaMaskTransaction({ to, data, value }) {
  const { injectedProvider, provider, from } = await getWriteContext()
  const txRequest = {
    from,
    to,
    data,
  }

  if (value && value > 0n) {
    txRequest.value = ethers.toBeHex(value)
  }

  const hash = await injectedProvider.request({
    method: 'eth_sendTransaction',
    params: [txRequest],
  })

  return {
    hash,
    wait: () => provider.waitForTransaction(hash),
  }
}

export function isLiveSwapReady() {
  return hasLiveSwapConfig()
}

export async function readMoonSwapState(account = '') {
  const { moonUsdToken, moonSwapPool } = await getReadContracts()

  const [reserves, totalLiquidityShares, feeBps] = await Promise.all([
    moonSwapPool.getReserves(),
    moonSwapPool.totalLiquidityShares(),
    moonSwapPool.FEE_BPS(),
  ])

  let walletMoonUsdAllowance = null
  let walletLiquidityShares = null

  if (account && ethers.isAddress(account)) {
    ;[walletMoonUsdAllowance, walletLiquidityShares] = await Promise.all([
      moonUsdToken.allowance(account, MOONUSD_CONFIG.swapPoolContract),
      moonSwapPool.liquiditySharesOf(account),
    ])
  }

  return {
    reserveEth: toFloat(reserves.reserveEthWei),
    reserveMoonUsd: toFloat(reserves.reserveMoonUsd),
    totalLiquidityShares: toFloat(totalLiquidityShares),
    walletMoonUsdAllowance: walletMoonUsdAllowance === null ? null : toFloat(walletMoonUsdAllowance),
    walletLiquidityShares: walletLiquidityShares === null ? null : toFloat(walletLiquidityShares),
    feePercent: Number(feeBps) / 100,
  }
}

export async function quoteMoonSwapAddLiquidity(ethAmount) {
  const { moonSwapPool } = await getReadContracts()
  const quote = await moonSwapPool.quoteAddLiquidity(ethers.parseEther(String(ethAmount)))

  return {
    requiredMoonUsd: toFloat(quote.requiredMoonUsdAmount),
    estimatedShares: toFloat(quote.liquiditySharesMinted),
  }
}

export async function quoteMoonSwapEthToMoonUsd(ethAmount) {
  const { moonSwapPool } = await getReadContracts()
  const moonUsdOut = await moonSwapPool.quoteSwapExactEthForMoonUsd(
    ethers.parseEther(String(ethAmount)),
  )

  return toFloat(moonUsdOut)
}

export async function quoteMoonSwapMoonUsdToEth(moonUsdAmount) {
  const { moonSwapPool } = await getReadContracts()
  const ethOut = await moonSwapPool.quoteSwapExactMoonUsdForEth(
    ethers.parseEther(String(moonUsdAmount)),
  )

  return toFloat(ethOut)
}

export async function approveMoonSwapSpend() {
  return sendMetaMaskTransaction({
    to: MOONUSD_CONFIG.stablecoinContract,
    data: moonUsdInterface.encodeFunctionData('approve', [
      MOONUSD_CONFIG.swapPoolContract,
      ethers.MaxUint256,
    ]),
  })
}

export async function addMoonSwapLiquidity(ethAmount, maxMoonUsdAmount, minLiquidityShares = 0) {
  return sendMetaMaskTransaction({
    to: MOONUSD_CONFIG.swapPoolContract,
    data: moonSwapPoolInterface.encodeFunctionData('addLiquidity', [
      ethers.parseEther(String(maxMoonUsdAmount)),
      ethers.parseEther(String(minLiquidityShares)),
    ]),
    value: ethers.parseEther(String(ethAmount)),
  })
}

export async function swapMoonSwapEthForMoonUsd(ethAmount, minMoonUsdOut) {
  return sendMetaMaskTransaction({
    to: MOONUSD_CONFIG.swapPoolContract,
    data: moonSwapPoolInterface.encodeFunctionData('swapExactEthForMoonUsd', [
      ethers.parseEther(String(minMoonUsdOut)),
    ]),
    value: ethers.parseEther(String(ethAmount)),
  })
}

export async function swapMoonSwapMoonUsdForEth(moonUsdAmount, minEthOut) {
  return sendMetaMaskTransaction({
    to: MOONUSD_CONFIG.swapPoolContract,
    data: moonSwapPoolInterface.encodeFunctionData('swapExactMoonUsdForEth', [
      ethers.parseEther(String(moonUsdAmount)),
      ethers.parseEther(String(minEthOut)),
    ]),
  })
}

export function getMoonSwapPoolExplorerUrl() {
  return `${getExplorerBaseUrl()}/address/${MOONUSD_CONFIG.swapPoolContract}`
}

export function getMoonSwapTransactionExplorerUrl(hash) {
  return `${getExplorerBaseUrl()}/tx/${hash}`
}
