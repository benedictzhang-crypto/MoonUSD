// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MoonSwapPool is ReentrancyGuard {
    error MoonSwapPool__InsufficientLiquidity();
    error MoonSwapPool__InsufficientOutputAmount(uint256 actualOutput, uint256 minimumOutput);
    error MoonSwapPool__InvalidTokenAddress();
    error MoonSwapPool__NeedsMoreThanZero();
    error MoonSwapPool__SlippageExceeded(uint256 requiredInput, uint256 maximumInput);
    error MoonSwapPool__TransferFailed();

    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable moonUsdToken;

    uint256 public totalLiquidityShares;
    mapping(address provider => uint256 shares) public liquiditySharesOf;

    event LiquidityAdded(
        address indexed provider,
        uint256 ethAmountWei,
        uint256 moonUsdAmount,
        uint256 liquiditySharesMinted
    );
    event LiquidityRemoved(
        address indexed provider,
        uint256 ethAmountWei,
        uint256 moonUsdAmount,
        uint256 liquiditySharesBurned
    );
    event SwapExecuted(
        address indexed trader,
        bool ethToMoonUsd,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address moonUsdTokenAddress) {
        if (moonUsdTokenAddress == address(0)) {
            revert MoonSwapPool__InvalidTokenAddress();
        }

        moonUsdToken = IERC20(moonUsdTokenAddress);
    }

    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert MoonSwapPool__NeedsMoreThanZero();
        }
        _;
    }

    function addLiquidity(uint256 maxMoonUsdAmount, uint256 minLiquidityShares)
        external
        payable
        nonReentrant
        moreThanZero(msg.value)
        moreThanZero(maxMoonUsdAmount)
        returns (uint256 moonUsdAmountUsed, uint256 liquiditySharesMinted)
    {
        uint256 reserveEthBefore = address(this).balance - msg.value;
        uint256 reserveMoonUsdBefore = moonUsdToken.balanceOf(address(this));

        if (reserveEthBefore == 0 || reserveMoonUsdBefore == 0 || totalLiquidityShares == 0) {
            moonUsdAmountUsed = maxMoonUsdAmount;
            liquiditySharesMinted = _sqrt(msg.value * moonUsdAmountUsed);
        } else {
            moonUsdAmountUsed = (msg.value * reserveMoonUsdBefore + reserveEthBefore - 1) / reserveEthBefore;

            if (moonUsdAmountUsed > maxMoonUsdAmount) {
                revert MoonSwapPool__SlippageExceeded(moonUsdAmountUsed, maxMoonUsdAmount);
            }

            uint256 ethSideShares = (msg.value * totalLiquidityShares) / reserveEthBefore;
            uint256 moonSideShares = (moonUsdAmountUsed * totalLiquidityShares) / reserveMoonUsdBefore;
            liquiditySharesMinted = ethSideShares < moonSideShares ? ethSideShares : moonSideShares;
        }

        if (liquiditySharesMinted == 0 || liquiditySharesMinted < minLiquidityShares) {
            revert MoonSwapPool__InsufficientOutputAmount(liquiditySharesMinted, minLiquidityShares);
        }

        bool didTransfer = moonUsdToken.transferFrom(msg.sender, address(this), moonUsdAmountUsed);
        if (!didTransfer) {
            revert MoonSwapPool__TransferFailed();
        }

        liquiditySharesOf[msg.sender] += liquiditySharesMinted;
        totalLiquidityShares += liquiditySharesMinted;

        emit LiquidityAdded(msg.sender, msg.value, moonUsdAmountUsed, liquiditySharesMinted);
    }

    function removeLiquidity(uint256 liquiditySharesBurned)
        external
        nonReentrant
        moreThanZero(liquiditySharesBurned)
        returns (uint256 ethAmountWei, uint256 moonUsdAmount)
    {
        uint256 providerShares = liquiditySharesOf[msg.sender];
        if (providerShares < liquiditySharesBurned || totalLiquidityShares == 0) {
            revert MoonSwapPool__InsufficientLiquidity();
        }

        uint256 reserveEth = address(this).balance;
        uint256 reserveMoonUsd = moonUsdToken.balanceOf(address(this));

        ethAmountWei = (reserveEth * liquiditySharesBurned) / totalLiquidityShares;
        moonUsdAmount = (reserveMoonUsd * liquiditySharesBurned) / totalLiquidityShares;

        liquiditySharesOf[msg.sender] = providerShares - liquiditySharesBurned;
        totalLiquidityShares -= liquiditySharesBurned;

        bool didTransferToken = moonUsdToken.transfer(msg.sender, moonUsdAmount);
        if (!didTransferToken) {
            revert MoonSwapPool__TransferFailed();
        }

        (bool didTransferEth, ) = payable(msg.sender).call{value: ethAmountWei}("");
        if (!didTransferEth) {
            revert MoonSwapPool__TransferFailed();
        }

        emit LiquidityRemoved(msg.sender, ethAmountWei, moonUsdAmount, liquiditySharesBurned);
    }

    function swapExactEthForMoonUsd(uint256 minMoonUsdOut)
        external
        payable
        nonReentrant
        moreThanZero(msg.value)
        returns (uint256 moonUsdOut)
    {
        uint256 reserveEthBefore = address(this).balance - msg.value;
        uint256 reserveMoonUsdBefore = moonUsdToken.balanceOf(address(this));

        if (reserveEthBefore == 0 || reserveMoonUsdBefore == 0) {
            revert MoonSwapPool__InsufficientLiquidity();
        }

        moonUsdOut = _getAmountOut(msg.value, reserveEthBefore, reserveMoonUsdBefore);
        if (moonUsdOut < minMoonUsdOut) {
            revert MoonSwapPool__InsufficientOutputAmount(moonUsdOut, minMoonUsdOut);
        }

        bool didTransfer = moonUsdToken.transfer(msg.sender, moonUsdOut);
        if (!didTransfer) {
            revert MoonSwapPool__TransferFailed();
        }

        emit SwapExecuted(msg.sender, true, msg.value, moonUsdOut);
    }

    function swapExactMoonUsdForEth(uint256 moonUsdAmountIn, uint256 minEthOut)
        external
        nonReentrant
        moreThanZero(moonUsdAmountIn)
        returns (uint256 ethOut)
    {
        uint256 reserveEthBefore = address(this).balance;
        uint256 reserveMoonUsdBefore = moonUsdToken.balanceOf(address(this));

        if (reserveEthBefore == 0 || reserveMoonUsdBefore == 0) {
            revert MoonSwapPool__InsufficientLiquidity();
        }

        ethOut = _getAmountOut(moonUsdAmountIn, reserveMoonUsdBefore, reserveEthBefore);
        if (ethOut < minEthOut) {
            revert MoonSwapPool__InsufficientOutputAmount(ethOut, minEthOut);
        }

        bool didPull = moonUsdToken.transferFrom(msg.sender, address(this), moonUsdAmountIn);
        if (!didPull) {
            revert MoonSwapPool__TransferFailed();
        }

        (bool didTransferEth, ) = payable(msg.sender).call{value: ethOut}("");
        if (!didTransferEth) {
            revert MoonSwapPool__TransferFailed();
        }

        emit SwapExecuted(msg.sender, false, moonUsdAmountIn, ethOut);
    }

    function getReserves() external view returns (uint256 reserveEthWei, uint256 reserveMoonUsd) {
        reserveEthWei = address(this).balance;
        reserveMoonUsd = moonUsdToken.balanceOf(address(this));
    }

    function quoteAddLiquidity(uint256 ethAmountWei)
        external
        view
        returns (uint256 requiredMoonUsdAmount, uint256 liquiditySharesMinted)
    {
        if (ethAmountWei == 0) {
            return (0, 0);
        }

        uint256 reserveEth = address(this).balance;
        uint256 reserveMoonUsd = moonUsdToken.balanceOf(address(this));

        if (reserveEth == 0 || reserveMoonUsd == 0 || totalLiquidityShares == 0) {
            return (0, 0);
        }

        requiredMoonUsdAmount = (ethAmountWei * reserveMoonUsd + reserveEth - 1) / reserveEth;
        uint256 ethSideShares = (ethAmountWei * totalLiquidityShares) / reserveEth;
        uint256 moonSideShares = (requiredMoonUsdAmount * totalLiquidityShares) / reserveMoonUsd;
        liquiditySharesMinted = ethSideShares < moonSideShares ? ethSideShares : moonSideShares;
    }

    function quoteSwapExactEthForMoonUsd(uint256 ethAmountWei) external view returns (uint256 moonUsdOut) {
        uint256 reserveEth = address(this).balance;
        uint256 reserveMoonUsd = moonUsdToken.balanceOf(address(this));

        if (ethAmountWei == 0 || reserveEth == 0 || reserveMoonUsd == 0) {
            return 0;
        }

        moonUsdOut = _getAmountOut(ethAmountWei, reserveEth, reserveMoonUsd);
    }

    function quoteSwapExactMoonUsdForEth(uint256 moonUsdAmountIn) external view returns (uint256 ethOut) {
        uint256 reserveEth = address(this).balance;
        uint256 reserveMoonUsd = moonUsdToken.balanceOf(address(this));

        if (moonUsdAmountIn == 0 || reserveEth == 0 || reserveMoonUsd == 0) {
            return 0;
        }

        ethOut = _getAmountOut(moonUsdAmountIn, reserveMoonUsd, reserveEth);
    }

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        internal
        pure
        returns (uint256 amountOut)
    {
        uint256 amountInWithFee = amountIn * (BPS_DENOMINATOR - FEE_BPS);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOMINATOR + amountInWithFee);
    }

    function _sqrt(uint256 value) internal pure returns (uint256 result) {
        if (value == 0) {
            return 0;
        }

        uint256 x = value;
        result = 1;

        if (x >> 128 > 0) {
            x >>= 128;
            result <<= 64;
        }
        if (x >> 64 > 0) {
            x >>= 64;
            result <<= 32;
        }
        if (x >> 32 > 0) {
            x >>= 32;
            result <<= 16;
        }
        if (x >> 16 > 0) {
            x >>= 16;
            result <<= 8;
        }
        if (x >> 8 > 0) {
            x >>= 8;
            result <<= 4;
        }
        if (x >> 4 > 0) {
            x >>= 4;
            result <<= 2;
        }
        if (x >> 2 > 0) {
            result <<= 1;
        }

        for (uint256 i = 0; i < 7; i++) {
            result = (result + value / result) >> 1;
        }

        uint256 roundedDown = value / result;
        return result < roundedDown ? result : roundedDown;
    }
}
