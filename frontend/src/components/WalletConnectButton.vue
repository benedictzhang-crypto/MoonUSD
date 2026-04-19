<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWallet } from '../composables/useWallet'

const {
  walletState,
  shortAddress,
  isSepolia,
  canUseWallet,
  connectWallet,
  disconnectWallet,
  switchToSepolia,
} = useWallet()

const menuOpen = ref(false)
const menuRef = ref(null)

const buttonLabel = computed(() => {
  if (walletState.isBusy) {
    return walletState.isConnected ? 'Working...' : 'Connecting...'
  }

  if (!walletState.isConnected) {
    return 'Connect Wallet'
  }

  if (!isSepolia.value) {
    return 'Switch to Sepolia'
  }

  return shortAddress.value || 'Wallet'
})

const networkLabel = computed(() => (isSepolia.value ? 'Sepolia' : 'Wrong network'))

function closeMenu() {
  menuOpen.value = false
}

async function handleClick() {
  if (walletState.isBusy) {
    return
  }

  if (!canUseWallet.value) {
    window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer')
    return
  }

  if (!walletState.isConnected) {
    await connectWallet()
    return
  }

  if (!isSepolia.value) {
    await switchToSepolia()
    return
  }

  menuOpen.value = !menuOpen.value
}

async function handleSwitchToSepolia() {
  await switchToSepolia()
  if (isSepolia.value) {
    closeMenu()
  }
}

async function handleDisconnect() {
  await disconnectWallet()
  closeMenu()
}

function handleDocumentClick(event) {
  if (!menuRef.value?.contains(event.target)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div ref="menuRef" class="wallet-menu">
    <button
      class="button"
      type="button"
      :title="walletState.status"
      :disabled="walletState.isBusy"
      @click.stop="handleClick"
    >
      {{ buttonLabel }}
    </button>

    <div v-if="menuOpen && walletState.isConnected" class="wallet-popover">
      <div class="wallet-popover-row">
        <span>Address</span>
        <strong>{{ shortAddress }}</strong>
      </div>
      <div class="wallet-popover-row">
        <span>Network</span>
        <strong :class="{ warning: !isSepolia }">{{ networkLabel }}</strong>
      </div>
      <div class="wallet-popover-actions">
        <button
          v-if="!isSepolia"
          class="button-secondary popover-button"
          type="button"
          :disabled="walletState.isBusy"
          @click.stop="handleSwitchToSepolia"
        >
          Switch to Sepolia
        </button>
        <button
          class="button-ghost popover-button"
          type="button"
          :disabled="walletState.isBusy"
          @click.stop="handleDisconnect"
        >
          Disconnect
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-menu {
  position: relative;
}

.wallet-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 220px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(20, 20, 20, 0.08);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  display: grid;
  gap: 10px;
}

.wallet-popover-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.wallet-popover-row strong {
  color: var(--text);
  font-size: 0.95rem;
}

.wallet-popover-row .warning {
  color: #c97c00;
}

.wallet-popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.popover-button {
  padding: 10px 12px;
  font-size: 0.9rem;
}
</style>
