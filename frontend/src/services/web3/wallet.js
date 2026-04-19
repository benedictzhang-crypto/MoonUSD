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

  try {
    await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    })
  } catch (error) {
    // `wallet_requestPermissions` is preferred on extension because it
    // explicitly requests the `eth_accounts` permission, but some providers
    // or platforms only support `eth_requestAccounts`.
    if (![4001, -32002, 4200, -32601].includes(error?.code)) {
      throw error
    }

    if (error?.code === 4001 || error?.code === -32002) {
      throw error
    }
  }

  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  const chainId = await provider.request({ method: 'eth_chainId' })

  return {
    account: accounts[0],
    chainId,
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
  }
}

export async function disconnectMetaMask() {
  const provider = getInjectedProvider()

  if (!provider) {
    return {
      revoked: false,
      stillConnected: false,
      supportsRevoke: false,
    }
  }

  let supportsRevoke = true
  let revoked = false

  try {
    await provider.request({
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    })
    revoked = true
  } catch (error) {
    if ([4200, -32601].includes(error?.code)) {
      supportsRevoke = false
    } else {
      throw error
    }
  }

  const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => [])

  return {
    revoked: revoked || !accounts.length,
    stillConnected: accounts.length > 0,
    supportsRevoke,
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
