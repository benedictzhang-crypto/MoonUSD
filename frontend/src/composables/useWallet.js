import { computed, reactive } from 'vue'
import {
  connectMetaMask,
  getWalletProvider,
  ensureSepoliaNetwork,
  getConnectedAccount,
  hasInjectedWallet,
  SEPOLIA_CHAIN_ID,
} from '../services/web3/wallet'
import { formatAddress } from '../utils/formatters'

const walletState = reactive({
  isConnected: false,
  address: '',
  chainId: SEPOLIA_CHAIN_ID,
  mode: 'disconnected',
  isBusy: false,
  status: 'Connect MetaMask on Sepolia to read and write live MoonUSD vault data.',
})

let initialized = false
const DISCONNECTED_FLAG_KEY = 'moonusd-wallet-disconnected'

function hasLocalDisconnectFlag() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.sessionStorage.getItem(DISCONNECTED_FLAG_KEY) === '1'
}

function clearLocalDisconnectFlag() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(DISCONNECTED_FLAG_KEY)
}

function setLocalDisconnectFlag() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(DISCONNECTED_FLAG_KEY, '1')
}

function resetWalletState(status = 'Wallet disconnected. Connect MetaMask on Sepolia to keep using live data.') {
  walletState.isConnected = false
  walletState.address = ''
  walletState.chainId = SEPOLIA_CHAIN_ID
  walletState.mode = 'disconnected'
  walletState.status = status
}

function applyWalletSnapshot(snapshot) {
  clearLocalDisconnectFlag()
  walletState.isConnected = true
  walletState.address = snapshot.account
  walletState.chainId = snapshot.chainId
  walletState.mode = 'metamask'
  walletState.status = snapshot.isSepolia
    ? 'Wallet connected to Sepolia.'
    : 'Wallet connected. Please switch to Sepolia for contract calls.'
}

async function bootstrapWallet() {
  if (initialized || typeof window === 'undefined') {
    return
  }

  initialized = true

  const provider = getWalletProvider()

  if (!provider) {
    walletState.status = 'MetaMask is not installed in this browser.'
    return
  }

  try {
    const existing = hasLocalDisconnectFlag() ? null : await getConnectedAccount()

    if (existing) {
      applyWalletSnapshot(existing)
    }
  } catch (error) {
    walletState.status = error.message || 'Wallet connection check failed.'
  }

  provider.on?.('accountsChanged', (accounts) => {
    if (!accounts.length) {
      resetWalletState()
      return
    }

    if (hasLocalDisconnectFlag()) {
      return
    }

    walletState.isConnected = true
    walletState.address = accounts[0]
    walletState.mode = 'metamask'
    walletState.status = walletState.chainId === SEPOLIA_CHAIN_ID
      ? 'Wallet connected to Sepolia.'
      : 'Wallet connected. Please switch to Sepolia for contract calls.'
  })

  provider.on?.('chainChanged', (chainId) => {
    if (hasLocalDisconnectFlag()) {
      return
    }

    walletState.chainId = chainId
    walletState.status = chainId === SEPOLIA_CHAIN_ID
      ? 'Wallet connected to Sepolia.'
      : 'Wallet connected. Please switch to Sepolia for contract calls.'
  })
}

export function useWallet() {
  bootstrapWallet()

  const shortAddress = computed(() => formatAddress(walletState.address))
  const isSepolia = computed(() => walletState.chainId === SEPOLIA_CHAIN_ID)
  const canUseWallet = computed(() => hasInjectedWallet())
  const walletLabel = computed(() => {
    if (!walletState.isConnected) {
      return 'Not connected'
    }

    return 'MetaMask connected'
  })

  async function connectWallet() {
    if (!hasInjectedWallet()) {
      resetWalletState('MetaMask is not installed in this browser.')
      return
    }

    walletState.isBusy = true

    try {
      clearLocalDisconnectFlag()
      const snapshot = await connectMetaMask()
      applyWalletSnapshot(snapshot)
    } catch (error) {
      walletState.status =
        error?.code === 4001
          ? 'MetaMask connection request was rejected.'
          : error?.code === -32002
            ? 'A MetaMask connection request is already pending. Open the extension popup and complete it.'
            : error.message || 'Wallet connection failed.'
    } finally {
      walletState.isBusy = false
    }
  }

  function disconnectWallet() {
    setLocalDisconnectFlag()
    resetWalletState('Disconnected in MoonUSD. MetaMask may still show this site as connected until you revoke it there.')
  }

  async function switchToSepolia() {
    walletState.isBusy = true

    try {
      const network = await ensureSepoliaNetwork()
      walletState.chainId = network.chainId
      walletState.status = 'Sepolia network selected.'
    } catch (error) {
      walletState.status =
        error?.code === 4001
          ? 'Sepolia network switch was rejected in MetaMask.'
          : error.message || 'Could not switch to Sepolia.'
    } finally {
      walletState.isBusy = false
    }
  }

  return {
    walletState,
    shortAddress,
    isSepolia,
    canUseWallet,
    walletLabel,
    connectWallet,
    disconnectWallet,
    switchToSepolia,
  }
}
