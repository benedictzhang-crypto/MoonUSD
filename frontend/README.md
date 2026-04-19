# MoonUSD Frontend

Vue 3 + Vite frontend scaffold for the MoonUSD Stablecoin Project.

## Initialize Commands

```bash
cd /Users/benedict/Desktop/MoonUSD
mkdir -p frontend
cd frontend
npm install
npm run dev
```

## Run Commands

```bash
cd /Users/benedict/Desktop/MoonUSD/frontend
npm install
npm run dev
```

## Live Sepolia Configuration

1. Copy `.env.example` to `.env.local`
2. Add the deployed Sepolia addresses:

```bash
cp .env.example .env.local
```

Fill:

- `VITE_SEPOLIA_MOONUSD_TOKEN_ADDRESS`
- `VITE_SEPOLIA_MOONVAULT_ADDRESS`
- `VITE_SEPOLIA_RPC_URL` optionally, if you want read-only live data before connecting MetaMask

Without these values, the app stays in mock/demo mode.

## Build Command

```bash
cd /Users/benedict/Desktop/MoonUSD/frontend
npm run build
```

## File Tree

```text
MoonUSD/
├── README.md
└── frontend/
    ├── .gitignore
    ├── README.md
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.vue
        ├── main.js
        ├── assets/
        │   └── theme.css
        ├── components/
        │   ├── AppNavbar.vue
        │   ├── AppShell.vue
        │   ├── HeroPanel.vue
        │   ├── MetricCard.vue
        │   ├── StatusBadge.vue
        │   ├── VaultActionCard.vue
        │   └── WalletConnectButton.vue
        ├── composables/
        │   ├── useMoonUsd.js
        │   └── useWallet.js
        ├── data/
        │   └── mockData.js
        ├── router/
        │   └── index.js
        ├── services/
        │   └── web3/
        │       ├── moonusd.js
        │       └── wallet.js
        ├── utils/
        │   └── formatters.js
        └── views/
            ├── DashboardView.vue
            ├── HomeView.vue
            ├── NotFoundView.vue
            ├── StressTestView.vue
            └── VaultView.vue
```

## Pages

- `HomeView.vue`: landing page, project summary cards, wallet CTA, and product overview.
- `VaultView.vue`: interactive mock vault with deposit, mint, burn, redeem, and collateral ratio checks.
- `DashboardView.vue`: protocol overview with ETH price, collateral, supply, peg status, and health score.
- `StressTestView.vue`: demo-friendly sell buttons for attack scenarios with placeholder outputs.
- `NotFoundView.vue`: fallback route.

## Notes

- Wallet support is scaffolded for MetaMask and Sepolia.
- Contract functions are abstracted in `src/services/web3/moonusd.js`.
- Address and ABI config lives in `src/services/web3/contracts.js`.
- Mock state and live Sepolia state switching live in `src/composables/useMoonUsd.js`.
