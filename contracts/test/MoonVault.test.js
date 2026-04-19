const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('MoonVault', function () {
  async function deployMoonUsdFixture() {
    const [owner, user, liquidator] = await ethers.getSigners()

    const MockPriceFeed = await ethers.getContractFactory('MockPriceFeed')
    const mockPriceFeed = await MockPriceFeed.deploy(8, 3000n * 10n ** 8n)
    await mockPriceFeed.waitForDeployment()

    const MoonUSDToken = await ethers.getContractFactory('MoonUSDToken')
    const moonUsdToken = await MoonUSDToken.deploy(owner.address)
    await moonUsdToken.waitForDeployment()

    const MoonVault = await ethers.getContractFactory('MoonVault')
    const moonVault = await MoonVault.deploy(
      await moonUsdToken.getAddress(),
      await mockPriceFeed.getAddress(),
    )
    await moonVault.waitForDeployment()

    await moonUsdToken.setMinter(await moonVault.getAddress())

    return {
      owner,
      user,
      liquidator,
      moonUsdToken,
      moonVault,
      mockPriceFeed,
    }
  }

  it('stores ETH collateral when a user deposits', async function () {
    const { user, moonVault } = await loadFixture(deployMoonUsdFixture)
    const depositAmount = ethers.parseEther('1')

    await moonVault.connect(user).depositCollateral({ value: depositAmount })

    expect(await moonVault.getCollateralDeposited(user.address)).to.equal(depositAmount)
    expect(await moonVault.getTotalSystemCollateral()).to.equal(depositAmount)
  })

  it('allows minting only while the vault stays above the 150% minimum ratio', async function () {
    const { user, moonVault, moonUsdToken } = await loadFixture(deployMoonUsdFixture)
    const depositAmount = ethers.parseEther('1')

    await moonVault.connect(user).depositCollateral({ value: depositAmount })

    await expect(moonVault.connect(user).mint(ethers.parseEther('2000.01')))
      .to.be.revertedWithCustomError(moonVault, 'MoonVault__BreaksCollateralRatio')

    await moonVault.connect(user).mint(ethers.parseEther('2000'))

    expect(await moonUsdToken.balanceOf(user.address)).to.equal(ethers.parseEther('2000'))
    expect(await moonVault.getMintedDebt(user.address)).to.equal(ethers.parseEther('2000'))
    expect(await moonVault.getCollateralRatio(user.address)).to.equal(150n)
  })

  it('burns debt and redeems collateral in one call', async function () {
    const { user, moonVault, moonUsdToken } = await loadFixture(deployMoonUsdFixture)

    await moonVault.connect(user).depositCollateral({ value: ethers.parseEther('1') })
    await moonVault.connect(user).mint(ethers.parseEther('1500'))

    await moonVault
      .connect(user)
      .burnAndRedeem(ethers.parseEther('500'), ethers.parseEther('0.5'))

    expect(await moonUsdToken.balanceOf(user.address)).to.equal(ethers.parseEther('1000'))
    expect(await moonVault.getMintedDebt(user.address)).to.equal(ethers.parseEther('1000'))
    expect(await moonVault.getCollateralDeposited(user.address)).to.equal(ethers.parseEther('0.5'))
    expect(await moonVault.getTotalSystemCollateral()).to.equal(ethers.parseEther('0.5'))
  })

  it('shows a lower collateral ratio when ETH price falls', async function () {
    const { user, moonVault, mockPriceFeed } = await loadFixture(deployMoonUsdFixture)

    await moonVault.connect(user).depositCollateral({ value: ethers.parseEther('1') })
    await moonVault.connect(user).mint(ethers.parseEther('1500'))

    await mockPriceFeed.updateAnswer(2000n * 10n ** 8n)

    expect(await moonVault.getCollateralRatio(user.address)).to.equal(133n)
  })

  it('lets a user close the vault completely after burning all debt', async function () {
    const { user, moonVault, moonUsdToken } = await loadFixture(deployMoonUsdFixture)

    await moonVault.connect(user).depositCollateral({ value: ethers.parseEther('1') })
    await moonVault.connect(user).mint(ethers.parseEther('1000'))

    await moonVault
      .connect(user)
      .burnAndRedeem(ethers.parseEther('1000'), ethers.parseEther('1'))

    expect(await moonUsdToken.balanceOf(user.address)).to.equal(0n)
    expect(await moonVault.getMintedDebt(user.address)).to.equal(0n)
    expect(await moonVault.getCollateralDeposited(user.address)).to.equal(0n)
  })

  it('allows a liquidator to burn MoonUSD and seize discounted ETH from an unhealthy vault', async function () {
    const { user, liquidator, moonVault, moonUsdToken, mockPriceFeed } =
      await loadFixture(deployMoonUsdFixture)

    await moonVault.connect(user).depositCollateral({ value: ethers.parseEther('1') })
    await moonVault.connect(user).mint(ethers.parseEther('1800'))

    await moonVault.connect(liquidator).depositCollateral({ value: ethers.parseEther('2') })
    await moonVault.connect(liquidator).mint(ethers.parseEther('1000'))

    await mockPriceFeed.updateAnswer(2500n * 10n ** 8n)

    const burnAmount = ethers.parseEther('300')
    const quote = await moonVault.getLiquidationQuote(user.address, burnAmount)
    const liquidatorBalanceBefore = await ethers.provider.getBalance(liquidator.address)

    const tx = await moonVault.connect(liquidator).liquidate(user.address, burnAmount)
    const receipt = await tx.wait()
    const gasSpent = receipt.gasUsed * receipt.gasPrice

    const liquidatorBalanceAfter = await ethers.provider.getBalance(liquidator.address)
    const userVault = await moonVault.getVault(user.address)

    expect(await moonUsdToken.balanceOf(liquidator.address)).to.equal(ethers.parseEther('700'))
    expect(await moonVault.getMintedDebt(user.address)).to.equal(ethers.parseEther('1500'))
    expect(await moonVault.getCollateralDeposited(user.address)).to.equal(
      ethers.parseEther('1') - quote.collateralToSeizeWei,
    )
    expect(liquidatorBalanceAfter).to.equal(liquidatorBalanceBefore + quote.collateralToSeizeWei - gasSpent)
    expect(userVault.collateralRatio).to.be.gt(138n)
  })

  it('allows a full liquidation to close a deeply underwater vault', async function () {
    const { user, liquidator, moonVault, moonUsdToken, mockPriceFeed } =
      await loadFixture(deployMoonUsdFixture)

    await moonVault.connect(user).depositCollateral({ value: ethers.parseEther('1') })
    await moonVault.connect(user).mint(ethers.parseEther('2000'))

    await moonVault.connect(liquidator).depositCollateral({ value: ethers.parseEther('2') })
    await moonVault.connect(liquidator).mint(ethers.parseEther('2500'))

    await mockPriceFeed.updateAnswer(800n * 10n ** 8n)

    await moonVault.connect(liquidator).liquidate(user.address, ethers.parseEther('2000'))

    expect(await moonUsdToken.balanceOf(liquidator.address)).to.equal(ethers.parseEther('500'))
    expect(await moonVault.getMintedDebt(user.address)).to.equal(0n)
    expect(await moonVault.getCollateralDeposited(user.address)).to.equal(0n)
  })

  it('reverts liquidation when the target vault is still healthy', async function () {
    const { user, liquidator, moonVault } = await loadFixture(deployMoonUsdFixture)

    await moonVault.connect(user).depositCollateral({ value: ethers.parseEther('1') })
    await moonVault.connect(user).mint(ethers.parseEther('1000'))

    await moonVault.connect(liquidator).depositCollateral({ value: ethers.parseEther('1') })
    await moonVault.connect(liquidator).mint(ethers.parseEther('500'))

    await expect(moonVault.connect(liquidator).liquidate(user.address, ethers.parseEther('100')))
      .to.be.revertedWithCustomError(moonVault, 'MoonVault__LiquidationTargetIsHealthy')
  })
})
