# MoonUSD Contracts

Minimal Hardhat project for the MoonUSD Stablecoin prototype.

## What is included

- `MoonUSDToken.sol` - ERC20 stablecoin minted and burned by the vault
- `MoonVault.sol` - ETH collateral vault with a 150% minimum collateral ratio
- `MockPriceFeed.sol` - local ETH/USD price feed for tests and local deployment
- `MoonVault.test.js` - first-pass protocol tests
- `deploy.js` - deploy script for local network and Sepolia

## Install

```bash
cd /Users/benedict/Desktop/MoonUSD/contracts
npm install
```

## Test

```bash
cd /Users/benedict/Desktop/MoonUSD/contracts
npm test
```

## Compile

```bash
cd /Users/benedict/Desktop/MoonUSD/contracts
npm run compile
```

## Local Deploy

```bash
cd /Users/benedict/Desktop/MoonUSD/contracts
npm run deploy:local
```

## Sepolia Deploy

1. Copy `.env.example` to `.env`
2. Fill in `PRIVATE_KEY`
3. Run:

```bash
cd /Users/benedict/Desktop/MoonUSD/contracts
npm run deploy:sepolia
```

## Sync Frontend Addresses

After deployment, write the contract addresses into the Vue app automatically:

```bash
cd /Users/benedict/Desktop/MoonUSD/contracts
npm run sync:frontend:sepolia
```

## Contract flow

1. Deposit ETH into the vault
2. Mint MoonUSD only if the position stays above 150%
3. Burn MoonUSD to reduce debt
4. Redeem ETH only if the position still stays healthy
