# MoonUSD Stablecoin Project

MoonUSD is a course final project that implements a crypto-backed overcollateralized stablecoin prototype on Ethereum Sepolia.

The project includes:

- a Vue 3 + Vite frontend deployed on Vercel
- Solidity smart contracts deployed to Sepolia
- an ETH-collateralized vault with mint, burn, redeem, and liquidation flows
- a simple ETH/MUSD liquidity pool for pairing, liquidity, and swap demonstrations

## Live Links

- Frontend: [https://moonusd-frontend.vercel.app](https://moonusd-frontend.vercel.app)
- GitHub repository: `https://github.com/benedictzhang-crypto/MoonUSD.git`

## Sepolia Contracts

- MoonUSDToken: `0xFcbad99180D8289B52266fe91BE964BAb92Fa6AC`
- MoonVault: `0x0FA9A915540725aA72a0f759617192d22ecE8a08`
- MoonSwapPool: `0x6ef51eb91FE8a7e7e3d29970263681F7AC62cA07`
- Chainlink ETH/USD Feed: `0x694AA1769357215DE4FAC081bf1f309aDC325306`

## Repo Structure

- `frontend/` - Vue 3 + Vite app with MetaMask integration and Sepolia reads/writes
- `contracts/` - Hardhat workspace with Solidity contracts, tests, deployment scripts, and deployment records
- `docs/` - submission materials and the detailed final paper source

## Core Features

- Deposit ETH as collateral
- Mint MoonUSD against collateral
- Burn MoonUSD and redeem ETH
- Liquidate unhealthy vaults below the minimum collateral ratio
- Read live system state from Sepolia
- Add liquidity and swap in the custom MoonSwapPool

## Tooling

- Solidity `0.8.24`
- OpenZeppelin Contracts `5.2.0`
- Hardhat `2.22.17`
- Vue `3.5`
- Vite `5`
- Ethers `6`
- MetaMask
- Chainlink price feed on Sepolia
- Vercel for frontend hosting

## Quick Start

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Contracts:

```bash
cd contracts
npm install
npm test
```

Deploy to Sepolia:

```bash
cd contracts
npm run deploy:sepolia
npm run deploy:swap:sepolia
npm run sync:frontend:sepolia
```

## Documentation

- Detailed final paper source: [docs/MoonUSD-Final-Paper.md](docs/MoonUSD-Final-Paper.md)
- Submission guide: [docs/MoonUSD-Submission-Guide.md](docs/MoonUSD-Submission-Guide.md)
