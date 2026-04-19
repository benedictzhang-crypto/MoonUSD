# MoonUSD Submission Guide

## Project Summary

MoonUSD is an ETH-backed overcollateralized stablecoin prototype deployed on Ethereum Sepolia. Users deposit ETH into a vault, mint MoonUSD against that collateral, burn MoonUSD to reduce debt, redeem ETH, and interact with a simple ETH/MUSD swap pool for liquidity and price discovery demos.

## Public Links

- Frontend: [https://moonusd-frontend.vercel.app](https://moonusd-frontend.vercel.app)
- GitHub repository: `https://github.com/benedictzhang-crypto/MoonUSD.git`

## Sepolia Deployment

- MoonUSDToken: `0xFcbad99180D8289B52266fe91BE964BAb92Fa6AC`
- MoonVault: `0x0FA9A915540725aA72a0f759617192d22ecE8a08`
- MoonSwapPool: `0x6ef51eb91FE8a7e7e3d29970263681F7AC62cA07`
- Chainlink ETH/USD Price Feed: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Network: Sepolia (`11155111`)

## Main Technologies

- Solidity + OpenZeppelin
- Hardhat
- Chainlink price feed
- Vue 3 + Vite
- Vue Router
- Ethers.js
- MetaMask
- Vercel
- Sepolia Etherscan

## What To Demo

1. Open the homepage and introduce MoonUSD as a crypto-backed stablecoin prototype.
2. Go to Dashboard and show live Sepolia reads:
   - ETH price
   - total collateral
   - total MoonUSD supply
   - system collateral ratio
3. Go to Vault and run the core protocol loop:
   - deposit ETH
   - mint MoonUSD
   - burn MoonUSD
   - redeem ETH
4. Show the liquidation panel and explain how unhealthy vaults can be liquidated below the 150% minimum ratio.
5. Open the swap page and explain:
   - how ETH/MUSD pairing is initialized
   - how liquidity is added
   - how swaps demonstrate price impact and depth

## Peg And Stability Talking Points

- Target peg: `1 MUSD = 1 USD`
- Backing model: ETH collateral only
- Minimum collateral ratio: `150%`
- Price source: Chainlink Sepolia ETH/USD feed
- Stability mechanisms:
  - overcollateralization
  - redemption through burn + redeem
  - liquidation below the threshold
  - market liquidity through the ETH/MUSD pool

Important nuance for the presentation:

The protocol targets a 1 USD peg, but market price can deviate temporarily if liquidity is shallow or if there is sudden selling pressure. The design goal is that protocol-backed redemption value, overcollateralization, and liquidation pressure pull the system back toward the peg.

## Example Funding Plan For Demo

Recommended allocation from 80 project ETH:

- `55 ETH` in the vault as collateral
- `20 ETH` in the MoonSwapPool as initial liquidity
- `5 ETH` left in the wallet for gas and adjustments
- `18 ETH` held separately as backup

If ETH is around `$2,418.65`, then:

- `55 ETH` collateral is worth about `$133,000`
- minting `60,000 MUSD` gives a collateral ratio around `220%`
- pairing `20 ETH` with approximately `48,373 MUSD` starts the pool close to the 1 USD target

## Example Transactions Already Completed On Sepolia

- Deposit test: [0x128d24b61ce012969e446f4d1d04b86878f47f1c57333467467dccbde39d6205](https://sepolia.etherscan.io/tx/0x128d24b61ce012969e446f4d1d04b86878f47f1c57333467467dccbde39d6205)
- Mint test: [0x35d802d33c66848d158cd7b0a227309a1b0ac606e221039fbe3bf8f77aa340b0](https://sepolia.etherscan.io/tx/0x35d802d33c66848d158cd7b0a227309a1b0ac606e221039fbe3bf8f77aa340b0)
- Pool approval: [0x90b57561554e1f242df5ca73c23ffec1d0092bda2ac7fdbb0aa7e62597260b1e](https://sepolia.etherscan.io/tx/0x90b57561554e1f242df5ca73c23ffec1d0092bda2ac7fdbb0aa7e62597260b1e)
- Extra mint for pool seeding: [0xad8a2ef1fbefc34868aa3328593476ccb5c1b35ada7ae65c37a6f74fd1c32155](https://sepolia.etherscan.io/tx/0xad8a2ef1fbefc34868aa3328593476ccb5c1b35ada7ae65c37a6f74fd1c32155)
- Initial pool seed: [0x25bc14f9de1d53c9fe57745d91a380d0b6dbc9e9cf24225e964552c13a67d976](https://sepolia.etherscan.io/tx/0x25bc14f9de1d53c9fe57745d91a380d0b6dbc9e9cf24225e964552c13a67d976)

## Websites Used

- MetaMask for wallet connection and transaction signing
- Vercel for frontend hosting
- GitHub for source code management
- Sepolia Etherscan for contract and transaction inspection
- Chainlink for price oracle data
- Public Sepolia RPC for read access

## Important Limitations

- This is a course prototype, not a production protocol.
- The system uses only one collateral type.
- There is no governance, stability fee, or advanced risk engine yet.
- The AMM is intentionally simple and does not replace a production DEX.
- The contracts have not been professionally audited.
