const fs = require('fs')
const path = require('path')
const hre = require('hardhat')

const DEFAULT_SEPOLIA_ETH_USD_FEED = '0x694AA1769357215DE4FAC081bf1f309aDC325306'

function writeDeploymentFile(networkName, deployment) {
  const deploymentsDir = path.join(__dirname, '..', 'deployments')
  fs.mkdirSync(deploymentsDir, { recursive: true })

  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`)
  fs.writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`)

  console.log(`Deployment file written to ${deploymentPath}`)
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const networkName = hre.network.name

  console.log(`Deploying MoonUSD contracts with ${deployer.address} on ${networkName}...`)

  let priceFeedAddress = process.env.ETH_USD_PRICE_FEED || ''

  if (networkName === 'hardhat' || networkName === 'localhost') {
    const MockPriceFeed = await hre.ethers.getContractFactory('MockPriceFeed')
    const mockPriceFeed = await MockPriceFeed.deploy(8, 3000n * 10n ** 8n)
    await mockPriceFeed.waitForDeployment()
    priceFeedAddress = await mockPriceFeed.getAddress()

    console.log(`MockPriceFeed deployed to ${priceFeedAddress}`)
  }

  if (networkName === 'sepolia' && !priceFeedAddress) {
    priceFeedAddress = DEFAULT_SEPOLIA_ETH_USD_FEED
  }

  if (!priceFeedAddress) {
    throw new Error('ETH_USD_PRICE_FEED is required for non-local deployments.')
  }

  const MoonUSDToken = await hre.ethers.getContractFactory('MoonUSDToken')
  const moonUsdToken = await MoonUSDToken.deploy(deployer.address)
  await moonUsdToken.waitForDeployment()

  const MoonVault = await hre.ethers.getContractFactory('MoonVault')
  const moonVault = await MoonVault.deploy(await moonUsdToken.getAddress(), priceFeedAddress)
  await moonVault.waitForDeployment()

  const setMinterTx = await moonUsdToken.setMinter(await moonVault.getAddress())
  await setMinterTx.wait()

  console.log('Deployment complete:')
  console.log(`MoonUSDToken: ${await moonUsdToken.getAddress()}`)
  console.log(`MoonVault: ${await moonVault.getAddress()}`)
  console.log(`ETH/USD price feed: ${priceFeedAddress}`)

  writeDeploymentFile(networkName, {
    network: networkName,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    moonUsdToken: await moonUsdToken.getAddress(),
    moonVault: await moonVault.getAddress(),
    ethUsdPriceFeed: priceFeedAddress,
    deployedAt: new Date().toISOString(),
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
