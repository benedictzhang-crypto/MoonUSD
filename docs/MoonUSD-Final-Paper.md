# MoonUSD Stablecoin Project Final Paper

## Abstract

MoonUSD is a course final project that explores how a crypto-backed stablecoin can be designed and demonstrated on Ethereum Sepolia using a minimal but complete architecture. The system targets a peg of 1 MoonUSD to 1 United States dollar, but unlike fiat-backed stablecoins, MoonUSD is backed by overcollateralized ETH locked inside an on-chain vault. Users can deposit ETH, mint MoonUSD, burn MoonUSD to reduce debt, redeem ETH, and interact with a simple ETH/MUSD liquidity pool that demonstrates initial pairing, liquidity provisioning, and swap behavior under market pressure.

The goal of the project is not to build a production-ready protocol. Instead, the goal is to create a technically honest, fully demoable prototype that shows the essential mechanics of an overcollateralized stablecoin. To make the prototype concrete, the project uses Solidity smart contracts, OpenZeppelin security primitives, Hardhat deployment scripts, the Chainlink ETH/USD price feed on Sepolia, a Vue 3 frontend, MetaMask wallet integration, and Vercel hosting. The final result demonstrates both protocol-level stability mechanisms and market-level trading behavior in a way that is easy to present in a classroom setting.

## 1. Problem Statement

One of the core problems in decentralized finance is volatility. ETH is useful as a reserve asset, but it is not stable enough to act as a predictable unit of account for everyday on-chain activity. A stablecoin solves that problem by giving users an asset that is easier to price, easier to lend, easier to trade against, and easier to use as a budgeting unit.

However, stablecoins themselves raise a second problem: how to maintain confidence in the peg. Some stablecoins rely on off-chain bank reserves. Others try to use algorithmic balancing without hard collateral support. This project focuses on a simpler and more transparent model: a crypto-backed overcollateralized stablecoin. In this design, every unit of outstanding MoonUSD is backed by more than 1 USD worth of ETH, creating a margin of safety if ETH price falls.

The course version of MoonUSD tries to answer the following question:

How can a student team build a realistic stablecoin prototype that demonstrates deposit, mint, burn, redeem, liquidation, and market trading using clean modern tooling without over-engineering the system?

## 2. Target Users and Personas

The project was designed with a few realistic user personas in mind.

### 2.1 The Stablecoin User

This user holds ETH but wants temporary access to dollar-like liquidity without selling their ETH position. They use the MoonVault to deposit ETH and mint MoonUSD against it. Their main concern is staying safely above the minimum collateral ratio while gaining access to a stable on-chain asset.

### 2.2 The Liquidity Provider

This user wants to help the system establish market depth. They provide ETH and MoonUSD to the MoonSwapPool and receive liquidity shares in return. Their main concern is how much liquidity they can add, what ratio is required, and how much price impact the pool can absorb.

### 2.3 The Liquidator

This user watches for unsafe vaults that fall below the minimum collateral ratio. They burn MoonUSD to liquidate unhealthy positions and seize discounted ETH collateral. Their role is important because it strengthens the protocol by removing bad debt and improving the overall safety of the system.

### 2.4 The Demo Evaluator

For a course final project, an additional important persona is the evaluator, such as a professor or judge. This user needs clear evidence that the prototype is real, deployed, and logically coherent. They are likely to test whether the stablecoin can handle minting, redemption, and sell pressure. The project therefore includes a dashboard, a vault flow, and a trading interface so the evaluator can inspect both protocol state and market behavior.

## 3. High-Level Architecture

MoonUSD is built as a small modular system with three contract layers and one frontend layer.

### 3.1 Smart Contract Layer

The on-chain system is composed of:

- `MoonUSDToken.sol`
- `MoonVault.sol`
- `MoonSwapPool.sol`

Each contract has a clear responsibility. The token contract implements the stablecoin itself. The vault contract manages ETH collateral and debt accounting. The swap pool provides a minimal automated market maker for ETH/MUSD trading and liquidity.

### 3.2 Oracle Layer

The vault reads ETH/USD market data from the Chainlink ETH/USD price feed on Sepolia:

- `0x694AA1769357215DE4FAC081bf1f309aDC325306`

This price feed is used to convert ETH collateral into USD value and to enforce the minimum collateral ratio.

### 3.3 Frontend Layer

The frontend is a Vue 3 + Vite single-page application with Vue Router. It includes the following views:

- Home
- Vault
- Dashboard
- Stress Test
- Swap / Uniswap-style demo page
- Not Found

The frontend reads live data from Sepolia and uses MetaMask for transaction signing.

### 3.4 Infrastructure Layer

The project uses:

- Hardhat for local development, testing, and deployment
- OpenZeppelin Contracts for audited base components
- Ethers.js for frontend blockchain interaction
- Vercel for public frontend hosting
- Sepolia Etherscan for contract and transaction inspection
- GitHub for source control and submission packaging

## 4. Contract Design In Detail

## 4.1 MoonUSDToken.sol

The `MoonUSDToken` contract is the ERC-20 stablecoin contract. It inherits from:

- `ERC20` from OpenZeppelin
- `Ownable` from OpenZeppelin

Using OpenZeppelin is important because it avoids re-implementing well-known token behavior and access control from scratch. For a course project, this is a practical engineering choice: the team can focus on the stablecoin logic instead of spending time rebuilding standard libraries.

The token is deployed with:

- name: `MoonUSD`
- symbol: `MUSD`

The contract stores a single `minter` address. Only that address may mint or burn tokens. In this project, the minter is the `MoonVault` contract. This creates a simple but important trust boundary:

- users cannot mint MoonUSD directly
- the deployer cannot arbitrarily mint from the frontend
- minting and burning are routed through vault rules

Key functions:

- `setMinter(address newMinter)`: owner-only function to assign the vault as the token minter
- `mint(address to, uint256 amount)`: callable only by the minter
- `burn(address from, uint256 amount)`: callable only by the minter

This design means MoonUSD supply always changes in response to vault logic, not from uncontrolled external calls.

## 4.2 MoonVault.sol

The `MoonVault` contract is the protocol core. It manages:

- ETH collateral deposits
- MoonUSD debt minting
- debt reduction through burning
- collateral redemption
- vault liquidation when undercollateralized

It inherits from `ReentrancyGuard` from OpenZeppelin. This is used to protect state-changing functions that transfer ETH or depend on token state transitions.

The main state variables are:

- `MIN_COLLATERAL_RATIO = 150`
- `LIQUIDATION_BONUS_PERCENT = 10`
- `moonUsdToken`
- `ethUsdPriceFeed`
- `priceFeedScale`
- `s_collateralDeposited[user]`
- `s_mintedDebt[user]`

The collateral and debt mappings track each user vault independently. This makes the protocol easy to reason about during a demo because the user can inspect their own vault state directly.

### 4.2.1 Deposit Flow

Users deposit collateral through:

- `depositCollateral() payable`

This function requires a non-zero ETH amount and records the deposit in `s_collateralDeposited`. No token minting happens here. Deposit and mint are intentionally separate actions so the demo clearly shows the two-step process: first lock collateral, then borrow against it.

### 4.2.2 Mint Flow

Users mint MoonUSD through:

- `mint(uint256 amountMoonUsd)`

Before updating debt, the vault calculates the new debt amount and checks whether the resulting collateral ratio would remain above the minimum threshold. If the new position would fall below `150%`, the transaction reverts.

This is the key safety rule of the protocol:

collateral ratio = collateral value in USD / debt in MUSD

If the ratio stays high enough, the vault records the new debt and calls the MoonUSD token contract to mint tokens to the user.

### 4.2.3 Burn And Redeem Flow

Users reduce debt and withdraw collateral through:

- `burnAndRedeem(uint256 burnAmountMoonUsd, uint256 redeemAmountWei)`

This function intentionally combines two related actions:

- burning MoonUSD to reduce debt
- redeeming ETH collateral

If the user wants only one of the two actions, the other amount can be zero. This creates a compact and demo-friendly design. A user can burn only, redeem only, or do both in a single transaction if the remaining position still satisfies the collateral requirement.

The redeem path checks:

- whether the requested ETH is available
- whether the remaining vault after redemption stays above the minimum ratio

Only then does it transfer ETH back to the user.

### 4.2.4 Price Feed Integration

The vault uses a Chainlink Aggregator interface to fetch the ETH/USD price. The price feed decimals are stored in `priceFeedScale`, allowing the contract to normalize values correctly.

This is important because collateral is stored in wei while the price feed returns ETH/USD with its own decimal precision. The vault translates these units into a consistent collateral value in USD terms.

Without this price conversion layer, the protocol would not know how much MoonUSD a user can safely mint.

### 4.2.5 Liquidation Flow

MoonUSD includes a real liquidation mechanism:

- `liquidate(address target, uint256 burnAmountMoonUsd)`

Liquidation can only occur when the target vault is below the `150%` minimum collateral ratio. The liquidator burns their own MoonUSD and receives ETH collateral plus a liquidation bonus. In this contract, the liquidation bonus is `10%`.

The contract also includes safeguards:

- zero-address checks
- self-liquidation prohibition
- healthy vault rejection
- maximum partial liquidation checks
- requirement that partial liquidation improves the target position

This is a thoughtful feature for a course prototype because it shows that the design does not stop at minting. It also addresses the question of what happens when the collateral value falls and a vault becomes unsafe.

### 4.2.6 Read Functions

The vault exposes several public read functions for the frontend:

- `getVault(address user)`
- `getCollateralDeposited(address user)`
- `getMintedDebt(address user)`
- `getCollateralValueUsd(address user)`
- `getCollateralRatio(address user)`
- `getEthPrice()`
- `getLiquidationQuote(address user, uint256 burnAmountMoonUsd)`
- `getTotalSystemCollateral()`
- `getTotalMoonUsdSupply()`

These functions are the reason the Dashboard and Vault pages can read live system information directly from Sepolia without any backend database.

## 4.3 MoonSwapPool.sol

The `MoonSwapPool` contract is a deliberately small automated market maker used for demonstration. It is not meant to compete with Uniswap. Instead, it gives the project its own controllable ETH/MUSD market layer so that liquidity, pairing, and selling pressure can be demonstrated even if external testnet DEX indexing is inconsistent.

The pool inherits from `ReentrancyGuard` and stores:

- a MoonUSD token reference
- `FEE_BPS = 30`
- `BPS_DENOMINATOR = 10_000`
- `totalLiquidityShares`
- `liquiditySharesOf[provider]`

The pool therefore charges a `0.30%` fee, similar to a standard AMM tier.

### 4.3.1 Liquidity Provision

The pool supports:

- `addLiquidity(uint256 maxMoonUsdAmount, uint256 minLiquidityShares)`
- `removeLiquidity(uint256 liquiditySharesBurned)`

For the very first liquidity deposit, the provider effectively sets the opening ETH/MUSD price by choosing the ETH and MoonUSD amounts added to the empty pool. This is why correct pairing is so important. If the pool starts with an imbalanced ratio, the market price will start off-peg.

For later deposits, the contract calculates the required MoonUSD amount from the current reserve ratio so that new liquidity enters proportionally.

Liquidity providers receive internal LP shares that represent their ownership percentage in the pool.

### 4.3.2 Swaps

The pool supports:

- `swapExactEthForMoonUsd(uint256 minMoonUsdOut)`
- `swapExactMoonUsdForEth(uint256 moonUsdAmountIn, uint256 minEthOut)`

The pricing formula is a constant-product AMM:

`x * y = k`

with a fee-adjusted `amountOut` calculation. This means larger trades create larger price impact, which is exactly what makes the pool useful for stress demonstrations. If someone sells a large amount of MoonUSD into a shallow pool, the pool price will move. This does not mean the protocol has failed. It means the market layer is reflecting liquidity depth, while the vault, redemption path, and liquidation rules continue to anchor fundamental backing.

### 4.3.3 Quote Functions

The pool exposes read-only quote functions:

- `quoteAddLiquidity`
- `quoteSwapExactEthForMoonUsd`
- `quoteSwapExactMoonUsdForEth`
- `getReserves`

These are used in the frontend to preview required MoonUSD, estimated shares, and expected swap output before a user confirms a MetaMask transaction.

## 5. Pegging, Pairing, And Stability

## 5.1 The Peg Target

The target of the protocol is:

- `1 MoonUSD = 1 USD`

This target is not enforced by a direct on-chain promise that every trade on a DEX will always clear at exactly one dollar. Instead, it is pursued through economic design.

## 5.2 Overcollateralization

MoonUSD is overcollateralized. Users must keep the value of their ETH collateral above `150%` of their outstanding MoonUSD debt.

Example:

- if a user wants to mint `100 MUSD`
- they must maintain at least `$150` worth of ETH collateral

This overcollateralization provides a safety buffer against ETH price declines.

## 5.3 Redemption Pressure

If MoonUSD were to trade below $1 in the market, users still know that MoonUSD is tied to a redeemable, collateral-backed system. By burning MoonUSD and reducing debt, or by acquiring MoonUSD and using it in the vault lifecycle, there is a fundamental on-chain relationship between MoonUSD and collateral value.

For classroom discussion, the simplest way to explain this is:

- the AMM price may move temporarily
- but the token is not unbacked
- it is attached to real vault accounting and collateral constraints

## 5.4 Liquidation Pressure

If ETH price falls and a vault becomes unsafe, liquidators can step in and burn MoonUSD to seize discounted ETH. This improves system health and removes undercollateralized debt from the system.

Liquidation is important because a collateralized stablecoin without liquidation is incomplete. The project includes this feature to show that stability is not based only on hope or market sentiment.

## 5.5 Pairing In The ETH/MUSD Pool

For the AMM pool to start near the peg, the initial liquidity must reflect the current ETH/USD price.

For example, if ETH is approximately `$2,418.65`, then:

- `1 ETH` should be paired with roughly `2,418.65 MUSD`
- `20 ETH` should be paired with roughly `48,373 MUSD`

If the initial pool is paired correctly, the starting AMM price will be near the intended peg. If the initial ratio is wrong, the pool price will immediately imply that MoonUSD is mispriced.

This is why pairing matters so much in the project presentation. The vault handles backing and safety. The pool handles market price discovery. Both matter, but they solve different problems.

## 5.6 Stress Testing

A useful classroom test is to simulate market selling pressure by examining trades such as:

- sell `10 MUSD`
- sell `100 MUSD`
- sell `1000 MUSD`

In a shallow pool, the price impact will be visible. In a deeper pool, the price movement will be smaller. This is not a contradiction to the peg model. It is a lesson that stablecoin design has two layers:

- protocol value support
- market liquidity depth

MoonUSD is designed to let both layers be discussed honestly.

## 6. Frontend Design And Real Interaction Flow

The frontend is built with:

- Vue 3
- Vite
- Vue Router
- Ethers.js

The main design goal was a clean and bright yellow-and-white interface that looks polished enough for demo day without unnecessary clutter.

### 6.1 Pages

The frontend includes:

- Home page: project identity, summary cards, wallet connection
- Vault page: deposit, mint, burn, redeem, liquidation
- Dashboard page: live ETH price, collateral, supply, collateral ratio, system health
- Stress Test page: scenario-style output for attack demonstrations
- Swap page: custom liquidity and swap demo
- Not Found page

### 6.2 MetaMask Integration

The web3 layer uses Ethers.js and MetaMask. The app supports:

- wallet connection
- Sepolia network checking
- live read calls
- transaction writes

The frontend reads from either:

- the injected MetaMask provider on Sepolia
- or a configured Sepolia RPC URL for read-only access

For writes, MetaMask on Sepolia is required. This is important because the app does not simulate writes with mock data anymore. The goal was to make the frontend as real as possible for the course demo.

### 6.3 Real Pages Rather Than Mock Screens

The final direction of the project was to remove mock-only behavior wherever possible and show actual chain data. That is why Dashboard values, Vault state, token balances, pool reserves, and transaction links are wired to Sepolia contracts instead of static placeholders.

## 7. Deployment Process

The smart contract deployment flow is intentionally simple and traceable.

### 7.1 Hardhat Configuration

The Hardhat project uses:

- Solidity `0.8.24`
- optimizer enabled with `200` runs
- Sepolia network configuration
- Etherscan API support

Environment variables include:

- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETH_USD_PRICE_FEED`
- `ETHERSCAN_API_KEY`

### 7.2 Token And Vault Deployment

The script `contracts/scripts/deploy.js` performs the main deployment sequence:

1. get the deployer account from Hardhat
2. determine the network name
3. choose the ETH/USD price feed
4. deploy `MoonUSDToken`
5. deploy `MoonVault`
6. call `setMinter()` on the token so the vault becomes the only minter
7. write deployment metadata to `contracts/deployments/<network>.json`

On Sepolia, the deployment record is saved in:

- `contracts/deployments/sepolia.json`

That file captures:

- network
- chain id
- deployer address
- token address
- vault address
- price feed address
- deployment timestamp

### 7.3 Swap Pool Deployment

The pool is deployed in a second step using:

- `contracts/scripts/deploy-swap-pool.js`

This script reads the existing deployment JSON, loads the MoonUSD token address, deploys `MoonSwapPool`, and updates the same JSON file with the pool address and update timestamp.

This is a practical design because it keeps all deployment metadata in one location.

### 7.4 Frontend Sync

The script:

- `contracts/scripts/sync-frontend-config.js`

reads the deployment JSON and writes the relevant addresses into:

- `frontend/.env.local`

This is how the deployed contract addresses are wired into the frontend. It avoids manual copying mistakes and keeps the Sepolia frontend aligned with the latest contract deployment.

### 7.5 Frontend Hosting

The frontend is deployed to Vercel at:

- [https://moonusd-frontend.vercel.app](https://moonusd-frontend.vercel.app)

The Vercel deployment uses frontend environment variables for:

- Sepolia chain ID
- MoonUSD token address
- MoonVault address
- MoonSwapPool address
- Sepolia RPC URL

This makes the hosted frontend behave like the local version while staying connected to the deployed Sepolia contracts.

## 8. Sepolia Deployment Details

At the time of this submission, the active Sepolia addresses are:

- MoonUSDToken: `0xFcbad99180D8289B52266fe91BE964BAb92Fa6AC`
- MoonVault: `0x0FA9A915540725aA72a0f759617192d22ecE8a08`
- MoonSwapPool: `0x6ef51eb91FE8a7e7e3d29970263681F7AC62cA07`
- Chainlink ETH/USD feed: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Deployer: `0x9a022CA3D7fcDfdC0C6B30fdc36Dd29089Ea5a32`

The deployment record shows:

- initial token and vault deployment timestamp: `2026-04-17T23:47:49.442Z`
- pool deployment update timestamp: `2026-04-18T17:24:49.798Z`

These values come from the local deployment record stored in the contracts workspace.

## 9. Demonstrated On-Chain Activity

Several real Sepolia transactions were already executed during integration and testing:

- Deposit ETH into the vault:
  - [0x128d24b61ce012969e446f4d1d04b86878f47f1c57333467467dccbde39d6205](https://sepolia.etherscan.io/tx/0x128d24b61ce012969e446f4d1d04b86878f47f1c57333467467dccbde39d6205)
- Mint MoonUSD from the vault:
  - [0x35d802d33c66848d158cd7b0a227309a1b0ac606e221039fbe3bf8f77aa340b0](https://sepolia.etherscan.io/tx/0x35d802d33c66848d158cd7b0a227309a1b0ac606e221039fbe3bf8f77aa340b0)
- Approve MoonUSD spending for the pool:
  - [0x90b57561554e1f242df5ca73c23ffec1d0092bda2ac7fdbb0aa7e62597260b1e](https://sepolia.etherscan.io/tx/0x90b57561554e1f242df5ca73c23ffec1d0092bda2ac7fdbb0aa7e62597260b1e)
- Mint additional MoonUSD for pool seeding:
  - [0xad8a2ef1fbefc34868aa3328593476ccb5c1b35ada7ae65c37a6f74fd1c32155](https://sepolia.etherscan.io/tx/0xad8a2ef1fbefc34868aa3328593476ccb5c1b35ada7ae65c37a6f74fd1c32155)
- Add initial pool liquidity:
  - [0x25bc14f9de1d53c9fe57745d91a380d0b6dbc9e9cf24225e964552c13a67d976](https://sepolia.etherscan.io/tx/0x25bc14f9de1d53c9fe57745d91a380d0b6dbc9e9cf24225e964552c13a67d976)

One successful integration seed added:

- `1 ETH`
- `2360.28 MUSD`

This initial seed was used to validate the real add-liquidity path and establish a working ETH/MUSD pool on Sepolia.

## 10. Revenue Model

Although MoonUSD is a course prototype and does not yet implement a full production business model, a realistic future revenue model can still be described.

### 10.1 Swap Fees

The MoonSwapPool already charges a `0.30%` fee on swaps. In a future version, part of that fee could be directed to:

- liquidity providers
- a protocol treasury
- a maintenance reserve

### 10.2 Stability Fee

The protocol could charge a small borrowing fee on minted MoonUSD positions. This would function similarly to a stability fee in other overcollateralized stablecoin systems.

### 10.3 Liquidation Incentive Design

The current `10%` liquidation bonus is designed as an incentive for third-party keepers. A production design could split liquidation economics between liquidators and a protocol reserve.

### 10.4 Premium Features Or Governance

In a more advanced version, the protocol could add governance-controlled parameters, treasury management, or vault types with different collateral rules.

For the course project, however, the focus stays on functional correctness and explainability rather than monetization.

## 11. Why OpenZeppelin Was Used

Using OpenZeppelin was one of the most practical engineering decisions in the project.

OpenZeppelin provided:

- `ERC20`
- `Ownable`
- `ReentrancyGuard`

These components reduce implementation risk and make the contract logic more readable. Instead of spending time rewriting standard token logic, the project used trusted building blocks and focused custom code on:

- stablecoin-specific mint and burn control
- collateral accounting
- liquidation rules
- AMM behavior

For a final project, this is exactly the right tradeoff: use well-known libraries for standard behavior and write original code only for the project-specific logic.

## 12. Websites, Platforms, And Services Used

The project relied on the following websites and services:

### 12.1 MetaMask

Used for:

- wallet connection
- Sepolia network selection
- transaction confirmation
- importing the MoonUSD token

### 12.2 Vercel

Used to deploy the Vue frontend and provide a public live demo URL.

### 12.3 GitHub

Used as the source code repository for the full project, including frontend, contracts, deployment scripts, and written documentation.

### 12.4 Sepolia Etherscan

Used to inspect:

- contract addresses
- wallet balances
- transaction history
- deployment records

### 12.5 Chainlink

Used as the ETH/USD oracle source for collateral valuation and mint safety checks.

### 12.6 Public Sepolia RPC Infrastructure

Used for frontend read access and Hardhat deployment access to the Sepolia network.

## 13. Suggested Live Demo Script

The strongest demo flow for the project is:

1. Open the home page and explain the idea in one sentence.
2. Open the Dashboard and show live Sepolia values.
3. Go to Vault and deposit a small amount of ETH.
4. Mint a small amount of MoonUSD.
5. Return to the Dashboard and show that system values changed.
6. Go back to Vault and burn some MoonUSD.
7. Redeem a small amount of ETH.
8. Open the swap page and explain how ETH/MUSD pairing works.
9. If the pool is ready, add liquidity or run a small swap.
10. Explain how larger sells increase slippage if the pool is shallow.

This sequence is effective because it demonstrates the full protocol loop:

deposit -> mint -> burn -> redeem -> trade

## 14. Limitations

MoonUSD is intentionally a prototype. Important limitations include:

- only one collateral type, ETH
- no governance module
- no interest rate model
- no multi-oracle fallback design
- no pause guardian or emergency shutdown
- no professional security audit
- no production-grade AMM routing or concentrated liquidity design
- no automated keeper network

These limitations are acceptable for a course project because the objective is to demonstrate the stablecoin mechanism clearly rather than launch a production protocol.

## 15. Future Work

The next steps after this prototype would be:

- verify contracts on Etherscan
- add fuller Hardhat test coverage for edge cases
- improve swap UX and slippage controls
- add backend analytics if desired
- integrate external DEX infrastructure where testnet support is reliable
- support deeper liquidity bootstrapping
- consider stability fees and governance parameters
- add monitoring and liquidation bots

## 16. Conclusion

MoonUSD demonstrates that a complete stablecoin prototype can be built with a small and understandable architecture. The project combines an ERC-20 stablecoin, an ETH-collateralized vault, a liquidation mechanism, a Chainlink price feed, and a minimal AMM into a coherent demo system deployed on Sepolia.

The project is intentionally modest in scope, but that is a strength rather than a weakness. Every major moving part is visible and explainable:

- where MoonUSD comes from
- what backs it
- how minting is limited
- how redemption works
- how unhealthy positions are resolved
- how the market price is paired in a pool
- why liquidity depth matters under stress

For a final project, MoonUSD succeeds because it is not only a concept. It is a real deployed prototype with live contracts, a public frontend, and an end-to-end stablecoin workflow that can be demonstrated in class.

## Appendix A: Live Links

- Frontend: [https://moonusd-frontend.vercel.app](https://moonusd-frontend.vercel.app)
- GitHub repository: `https://github.com/benedictzhang-crypto/MoonUSD.git`
- MoonUSDToken: [https://sepolia.etherscan.io/address/0xFcbad99180D8289B52266fe91BE964BAb92Fa6AC](https://sepolia.etherscan.io/address/0xFcbad99180D8289B52266fe91BE964BAb92Fa6AC)
- MoonVault: [https://sepolia.etherscan.io/address/0x0FA9A915540725aA72a0f759617192d22ecE8a08](https://sepolia.etherscan.io/address/0x0FA9A915540725aA72a0f759617192d22ecE8a08)
- MoonSwapPool: [https://sepolia.etherscan.io/address/0x6ef51eb91FE8a7e7e3d29970263681F7AC62cA07](https://sepolia.etherscan.io/address/0x6ef51eb91FE8a7e7e3d29970263681F7AC62cA07)

## Appendix B: Example Demo Capital Allocation

A balanced classroom demo allocation is:

- `18 ETH` untouched as backup
- `55 ETH` in the MoonVault as collateral
- `20 ETH` in the MoonSwapPool as initial liquidity
- `5 ETH` left in the wallet for gas and live adjustments

If ETH is around `$2,418.65`, then a reasonable target is:

- mint `60,000 MUSD`
- pair `20 ETH` with about `48,373 MUSD`
- keep the rest of the minted MoonUSD in the wallet for swaps, pool adjustment, and stress testing

This is a useful setup because it gives the project:

- strong collateral coverage
- visible pool depth
- enough wallet inventory for demonstrations
