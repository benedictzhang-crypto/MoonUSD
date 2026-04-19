export const protocolSummaryCards = [
  {
    label: 'Peg Target',
    value: '1 MoonUSD = 1 USD',
    detail: 'Dollar-targeted stablecoin prototype with a clean, demo-friendly UI.',
  },
  {
    label: 'Collateral Type',
    value: 'ETH only',
    detail: 'The first version uses Sepolia ETH as the sole collateral asset.',
  },
  {
    label: 'Minimum Collateral Ratio',
    value: '150%',
    detail: 'Users need at least 1.5x collateral value before minting MoonUSD.',
  },
  {
    label: 'Network',
    value: 'Ethereum Sepolia',
    detail: 'Built for a course prototype before mainnet-grade hardening.',
  },
]

export const homeSteps = [
  {
    title: 'Deposit ETH',
    text: 'Users lock Sepolia ETH into a vault as overcollateralized backing.',
  },
  {
    title: 'Mint MoonUSD',
    text: 'The protocol allows minting only when the 150% ratio stays healthy.',
  },
  {
    title: 'Manage Risk',
    text: 'Dashboard and vault views now surface live protocol state from Sepolia.',
  },
]
