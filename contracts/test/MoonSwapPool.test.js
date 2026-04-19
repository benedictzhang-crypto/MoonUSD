const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('MoonSwapPool', function () {
  async function deploySwapFixture() {
    const [owner, user, trader] = await ethers.getSigners()

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

    const MoonSwapPool = await ethers.getContractFactory('MoonSwapPool')
    const moonSwapPool = await MoonSwapPool.deploy(await moonUsdToken.getAddress())
    await moonSwapPool.waitForDeployment()

    for (const account of [owner, user, trader]) {
      await moonVault.connect(account).depositCollateral({ value: ethers.parseEther('5') })
      await moonVault.connect(account).mint(ethers.parseEther('6000'))
      await moonUsdToken.connect(account).approve(await moonSwapPool.getAddress(), ethers.MaxUint256)
    }

    return {
      owner,
      user,
      trader,
      moonUsdToken,
      moonVault,
      moonSwapPool,
    }
  }

  it('creates the initial ETH/MoonUSD pool and mints LP shares', async function () {
    const { owner, moonSwapPool } = await loadFixture(deploySwapFixture)

    await moonSwapPool
      .connect(owner)
      .addLiquidity(ethers.parseEther('3000'), 0, { value: ethers.parseEther('1') })

    const [reserveEth, reserveMoonUsd] = await moonSwapPool.getReserves()

    expect(reserveEth).to.equal(ethers.parseEther('1'))
    expect(reserveMoonUsd).to.equal(ethers.parseEther('3000'))
    expect(await moonSwapPool.totalLiquidityShares()).to.equal(ethers.parseEther('54.772255750516611345'))
    expect(await moonSwapPool.liquiditySharesOf(owner.address)).to.equal(
      await moonSwapPool.totalLiquidityShares(),
    )
  })

  it('adds later liquidity at the existing pool ratio', async function () {
    const { owner, user, moonSwapPool } = await loadFixture(deploySwapFixture)

    await moonSwapPool
      .connect(owner)
      .addLiquidity(ethers.parseEther('3000'), 0, { value: ethers.parseEther('1') })

    const quote = await moonSwapPool.quoteAddLiquidity(ethers.parseEther('0.5'))

    await moonSwapPool
      .connect(user)
      .addLiquidity(quote.requiredMoonUsdAmount, 0, { value: ethers.parseEther('0.5') })

    const [reserveEth, reserveMoonUsd] = await moonSwapPool.getReserves()

    expect(reserveEth).to.equal(ethers.parseEther('1.5'))
    expect(reserveMoonUsd).to.equal(ethers.parseEther('4500'))
    expect(await moonSwapPool.liquiditySharesOf(user.address)).to.equal(quote.liquiditySharesMinted)
  })

  it('swaps ETH for MoonUSD using the live pool reserves', async function () {
    const { owner, trader, moonSwapPool, moonUsdToken } = await loadFixture(deploySwapFixture)

    await moonSwapPool
      .connect(owner)
      .addLiquidity(ethers.parseEther('3000'), 0, { value: ethers.parseEther('1') })

    const quotedOut = await moonSwapPool.quoteSwapExactEthForMoonUsd(ethers.parseEther('0.1'))
    const tokenBalanceBefore = await moonUsdToken.balanceOf(trader.address)

    await moonSwapPool.connect(trader).swapExactEthForMoonUsd(quotedOut, {
      value: ethers.parseEther('0.1'),
    })

    const tokenBalanceAfter = await moonUsdToken.balanceOf(trader.address)
    const [reserveEth, reserveMoonUsd] = await moonSwapPool.getReserves()

    expect(tokenBalanceAfter - tokenBalanceBefore).to.equal(quotedOut)
    expect(reserveEth).to.equal(ethers.parseEther('1.1'))
    expect(reserveMoonUsd).to.equal(ethers.parseEther('3000') - quotedOut)
  })

  it('swaps MoonUSD for ETH using the live pool reserves', async function () {
    const { owner, trader, moonSwapPool } = await loadFixture(deploySwapFixture)

    await moonSwapPool
      .connect(owner)
      .addLiquidity(ethers.parseEther('3000'), 0, { value: ethers.parseEther('1') })

    const quotedOut = await moonSwapPool.quoteSwapExactMoonUsdForEth(ethers.parseEther('300'))
    const ethBalanceBefore = await ethers.provider.getBalance(trader.address)

    const tx = await moonSwapPool
      .connect(trader)
      .swapExactMoonUsdForEth(ethers.parseEther('300'), quotedOut)

    const receipt = await tx.wait()
    const gasSpent = receipt.gasUsed * receipt.gasPrice
    const ethBalanceAfter = await ethers.provider.getBalance(trader.address)
    const [reserveEth, reserveMoonUsd] = await moonSwapPool.getReserves()

    expect(ethBalanceAfter).to.equal(ethBalanceBefore + quotedOut - gasSpent)
    expect(reserveEth).to.equal(ethers.parseEther('1') - quotedOut)
    expect(reserveMoonUsd).to.equal(ethers.parseEther('3300'))
  })

  it('removes liquidity proportionally back to the LP provider', async function () {
    const { owner, moonSwapPool, moonUsdToken } = await loadFixture(deploySwapFixture)

    await moonSwapPool
      .connect(owner)
      .addLiquidity(ethers.parseEther('3000'), 0, { value: ethers.parseEther('1') })

    const shares = await moonSwapPool.liquiditySharesOf(owner.address)
    const tokenBalanceBefore = await moonUsdToken.balanceOf(owner.address)
    const ethBalanceBefore = await ethers.provider.getBalance(owner.address)

    const tx = await moonSwapPool.connect(owner).removeLiquidity(shares / 2n)
    const receipt = await tx.wait()
    const gasSpent = receipt.gasUsed * receipt.gasPrice

    const tokenBalanceAfter = await moonUsdToken.balanceOf(owner.address)
    const ethBalanceAfter = await ethers.provider.getBalance(owner.address)
    const [reserveEth, reserveMoonUsd] = await moonSwapPool.getReserves()

    expect(tokenBalanceAfter - tokenBalanceBefore).to.be.closeTo(ethers.parseEther('1500'), 100n)
    expect(ethBalanceAfter).to.be.closeTo(ethBalanceBefore + ethers.parseEther('0.5') - gasSpent, 1n)
    expect(reserveEth).to.be.closeTo(ethers.parseEther('0.5'), 1n)
    expect(reserveMoonUsd).to.be.closeTo(ethers.parseEther('1500'), 100n)
  })
})
