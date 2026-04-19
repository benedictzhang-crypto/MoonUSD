import { ethers } from 'ethers'

const env = import.meta.env
const cleanEnv = (value) => (typeof value === 'string' ? value.trim() : '')

export const MOONUSD_CONFIG = Object.freeze({
  networkName: 'Ethereum Sepolia',
  chainIdHex: '0xaa36a7',
  chainIdDecimal: Number(cleanEnv(env.VITE_SEPOLIA_CHAIN_ID) || 11155111),
  rpcUrl: cleanEnv(env.VITE_SEPOLIA_RPC_URL),
  stablecoinContract: cleanEnv(env.VITE_SEPOLIA_MOONUSD_TOKEN_ADDRESS),
  vaultContract: cleanEnv(env.VITE_SEPOLIA_MOONVAULT_ADDRESS),
  swapPoolContract: cleanEnv(env.VITE_SEPOLIA_MOONSWAPPOOL_ADDRESS),
})

export const MOONUSD_TOKEN_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]

export const MOONVAULT_ABI = [
  'event CollateralDeposited(address indexed user, uint256 amountWei)',
  'function depositCollateral() payable',
  'function liquidate(address target, uint256 burnAmountMoonUsd)',
  'function mint(uint256 amountMoonUsd)',
  'function burnAndRedeem(uint256 burnAmountMoonUsd, uint256 redeemAmountWei)',
  'function getVault(address user) view returns (uint256 collateralWei, uint256 mintedDebtMoonUsd, uint256 collateralValueUsd, uint256 collateralRatio)',
  'function getEthPrice() view returns (uint256)',
  'function getLiquidationQuote(address user, uint256 burnAmountMoonUsd) view returns (uint256 collateralToSeizeWei, uint256 resultingCollateralRatio, bool canLiquidate)',
  'function getMaxPartialLiquidationMoonUsd(address user) view returns (uint256)',
  'function getTotalSystemCollateral() view returns (uint256)',
  'function getTotalMoonUsdSupply() view returns (uint256)',
]

export const MOONSWAPPOOL_ABI = [
  'function FEE_BPS() view returns (uint256)',
  'function totalLiquidityShares() view returns (uint256)',
  'function liquiditySharesOf(address provider) view returns (uint256)',
  'function addLiquidity(uint256 maxMoonUsdAmount, uint256 minLiquidityShares) payable returns (uint256 moonUsdAmountUsed, uint256 liquiditySharesMinted)',
  'function removeLiquidity(uint256 liquiditySharesBurned) returns (uint256 ethAmountWei, uint256 moonUsdAmount)',
  'function swapExactEthForMoonUsd(uint256 minMoonUsdOut) payable returns (uint256 moonUsdOut)',
  'function swapExactMoonUsdForEth(uint256 moonUsdAmountIn, uint256 minEthOut) returns (uint256 ethOut)',
  'function getReserves() view returns (uint256 reserveEthWei, uint256 reserveMoonUsd)',
  'function quoteAddLiquidity(uint256 ethAmountWei) view returns (uint256 requiredMoonUsdAmount, uint256 liquiditySharesMinted)',
  'function quoteSwapExactEthForMoonUsd(uint256 ethAmountWei) view returns (uint256 moonUsdOut)',
  'function quoteSwapExactMoonUsdForEth(uint256 moonUsdAmountIn) view returns (uint256 ethOut)',
]

export function hasLiveContractsConfig() {
  return (
    ethers.isAddress(MOONUSD_CONFIG.stablecoinContract) &&
    ethers.isAddress(MOONUSD_CONFIG.vaultContract)
  )
}

export function hasLiveSwapConfig() {
  return (
    ethers.isAddress(MOONUSD_CONFIG.stablecoinContract) &&
    ethers.isAddress(MOONUSD_CONFIG.swapPoolContract)
  )
}
