export const SEPOLIA_CHAIN_ID = '0xaa36a7'

function getInjectedProvider() {
  if (typeof window === 'undefined') {
    return null
  }

  const injected = window.ethereum
  if (!injected) {
    return null
  }

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.find((provider) => provider.isMetaMask) || injected.providers[0]
  }

  return injected
}

export function hasInjectedWallet() {
  return Boolean(getInjectedProvider())
}

export async function getConnectedAccount() {
  const provider = getInjectedProvider()

  if (!provider) {
    return null
  }

  const accounts = await provider.request({ method: 'eth_accounts' })
  const chainId = await provider.request({ method: 'eth_chainId' })

  if (!accounts.length) {
    return null
  }

  return {
    account: accounts[0],
    chainId,
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
  }
}

export async function connectMetaMask() {
  const provider = getInjectedProvider()

  if (!provider) {
    throw new Error('MetaMask is not installed in this browser.')
  }

  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  const chainId = await provider.request({ method: 'eth_chainId' })

  return {
    account: accounts[0],
    chainId,
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
  }
}

export async function ensureSepoliaNetwork() {
  const provider = getInjectedProvider()

  if (!provider) {
    throw new Error('MetaMask is not installed in this browser.')
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    })
  } catch (error) {
    if (error.code !== 4902) {
      throw error
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: SEPOLIA_CHAIN_ID,
          chainName: 'Ethereum Sepolia',
          nativeCurrency: {
            name: 'Sepolia ETH',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: ['https://rpc.sepolia.org'],
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        },
      ],
    })
  }

  return {
    chainId: SEPOLIA_CHAIN_ID,
    isSepolia: true,
  }
}

export function getWalletProvider() {
  return getInjectedProvider()
}
