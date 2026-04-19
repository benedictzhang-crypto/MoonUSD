import { MOONUSD_CONFIG } from './contracts'

export const UNISWAP_APP_URL = 'https://app.uniswap.org'
export const UNISWAP_DOCS_URL = 'https://docs.uniswap.org'
export const DEFAULT_UNISWAP_FEE_PERCENT = 0.3
export const DEFAULT_UNISWAP_SELL_SIZES = [10, 100, 1000]

export function getMoonUsdTokenAddress() {
  return MOONUSD_CONFIG.stablecoinContract
}

export function getMoonUsdTokenEtherscanUrl() {
  if (!MOONUSD_CONFIG.stablecoinContract) {
    return ''
  }

  return `https://sepolia.etherscan.io/token/${MOONUSD_CONFIG.stablecoinContract}`
}

export function getMoonUsdSwapUrl(inputAmountEth = 0.05) {
  const url = new URL('/swap', UNISWAP_APP_URL)
  url.searchParams.set('field', 'input')
  url.searchParams.set('value', String(inputAmountEth))
  url.searchParams.set('inputCurrency', 'ETH')

  if (MOONUSD_CONFIG.stablecoinContract) {
    url.searchParams.set('outputCurrency', MOONUSD_CONFIG.stablecoinContract)
  }

  return url.toString()
}

export function calculateMoonUsdNeededForPeg(seedEth, ethPriceUsd) {
  const normalizedSeedEth = Number(seedEth)
  const normalizedEthPrice = Number(ethPriceUsd)

  if (
    !Number.isFinite(normalizedSeedEth) ||
    normalizedSeedEth <= 0 ||
    !Number.isFinite(normalizedEthPrice) ||
    normalizedEthPrice <= 0
  ) {
    return null
  }

  return normalizedSeedEth * normalizedEthPrice
}

export function calculatePoolDepthUsd(seedEth, ethPriceUsd) {
  const moonUsdNeeded = calculateMoonUsdNeededForPeg(seedEth, ethPriceUsd)

  if (!Number.isFinite(moonUsdNeeded)) {
    return null
  }

  return moonUsdNeeded * 2
}

export function simulateMoonUsdSale({
  reserveEth,
  reserveMoonUsd,
  sellAmountMoonUsd,
  feePercent = DEFAULT_UNISWAP_FEE_PERCENT,
  ethPriceUsd,
}) {
  const normalizedReserveEth = Number(reserveEth)
  const normalizedReserveMoonUsd = Number(reserveMoonUsd)
  const normalizedSellAmount = Number(sellAmountMoonUsd)
  const normalizedFeePercent = Number(feePercent)
  const normalizedEthPrice = Number(ethPriceUsd)

  if (
    !Number.isFinite(normalizedReserveEth) ||
    normalizedReserveEth <= 0 ||
    !Number.isFinite(normalizedReserveMoonUsd) ||
    normalizedReserveMoonUsd <= 0 ||
    !Number.isFinite(normalizedSellAmount) ||
    normalizedSellAmount <= 0 ||
    !Number.isFinite(normalizedFeePercent) ||
    normalizedFeePercent < 0 ||
    normalizedFeePercent >= 100 ||
    !Number.isFinite(normalizedEthPrice) ||
    normalizedEthPrice <= 0
  ) {
    return null
  }

  const feeMultiplier = 1 - normalizedFeePercent / 100
  const effectiveMoonUsdIn = normalizedSellAmount * feeMultiplier
  const constantProduct = normalizedReserveEth * normalizedReserveMoonUsd
  const newMoonUsdReserve = normalizedReserveMoonUsd + effectiveMoonUsdIn
  const newEthReserve = constantProduct / newMoonUsdReserve
  const ethOut = normalizedReserveEth - newEthReserve
  const averageExecutionPriceUsd = (ethOut * normalizedEthPrice) / normalizedSellAmount
  const priceImpactVsPegPercent = (1 - averageExecutionPriceUsd) * 100
  const postTradeMoonUsdPriceUsd = (newEthReserve / newMoonUsdReserve) * normalizedEthPrice

  return {
    sellAmountMoonUsd: normalizedSellAmount,
    ethOut,
    averageExecutionPriceUsd,
    priceImpactVsPegPercent,
    postTradeMoonUsdPriceUsd,
    newEthReserve,
    newMoonUsdReserve,
  }
}
