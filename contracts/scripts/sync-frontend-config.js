const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

function main() {
  const networkName = process.argv[2]

  if (!networkName) {
    throw new Error('Pass a network name such as "hardhat" or "sepolia".')
  }

  const deploymentPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`)
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`)
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
  const frontendEnvPath = path.join(__dirname, '..', '..', 'frontend', '.env.local')

  const lines = [
    `VITE_SEPOLIA_CHAIN_ID=${deployment.chainId}`,
    `VITE_SEPOLIA_MOONUSD_TOKEN_ADDRESS=${deployment.moonUsdToken}`,
    `VITE_SEPOLIA_MOONVAULT_ADDRESS=${deployment.moonVault}`,
  ]

  if (deployment.moonSwapPool) {
    lines.push(`VITE_SEPOLIA_MOONSWAPPOOL_ADDRESS=${deployment.moonSwapPool}`)
  }

  if (process.env.SEPOLIA_RPC_URL) {
    lines.push(`VITE_SEPOLIA_RPC_URL=${process.env.SEPOLIA_RPC_URL}`)
  }

  fs.writeFileSync(frontendEnvPath, `${lines.join('\n')}\n`)

  console.log(`Frontend config written to ${frontendEnvPath}`)
}

main()
