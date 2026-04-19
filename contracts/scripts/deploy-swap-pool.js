const fs = require('fs')
const path = require('path')
const hre = require('hardhat')

function loadDeploymentFile(networkName) {
  const deploymentPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`)

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`)
  }

  return {
    deploymentPath,
    deployment: JSON.parse(fs.readFileSync(deploymentPath, 'utf8')),
  }
}

async function main() {
  const networkName = hre.network.name
  const { deploymentPath, deployment } = loadDeploymentFile(networkName)

  if (!deployment.moonUsdToken) {
    throw new Error(`moonUsdToken address missing in ${deploymentPath}`)
  }

  const MoonSwapPool = await hre.ethers.getContractFactory('MoonSwapPool')
  const moonSwapPool = await MoonSwapPool.deploy(deployment.moonUsdToken)
  await moonSwapPool.waitForDeployment()

  deployment.moonSwapPool = await moonSwapPool.getAddress()
  deployment.updatedAt = new Date().toISOString()

  fs.writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`)

  console.log(`MoonSwapPool: ${deployment.moonSwapPool}`)
  console.log(`Deployment file updated: ${deploymentPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
