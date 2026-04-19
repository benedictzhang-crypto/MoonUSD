export function formatCurrency(value, currency = 'USD', maxFractionDigits = 2) {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: value % 1 === 0 ? 0 : Math.min(2, maxFractionDigits),
  }).format(value)
}

export function formatNumber(value, maxFractionDigits = 2) {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: value % 1 === 0 ? 0 : Math.min(2, maxFractionDigits),
  }).format(value)
}

export function formatEth(value, maxFractionDigits = 4) {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return `${formatNumber(value, maxFractionDigits)} ETH`
}

export function formatPercent(value, maxFractionDigits = 1) {
  if (value === Number.POSITIVE_INFINITY) {
    return '∞'
  }

  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return `${formatNumber(value, maxFractionDigits)}%`
}

export function formatAddress(address) {
  if (!address) {
    return ''
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
