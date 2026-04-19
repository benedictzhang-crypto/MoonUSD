// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {MoonUSDToken} from "./MoonUSDToken.sol";

contract MoonVault is ReentrancyGuard {
    error MoonVault__BreaksCollateralRatio(uint256 currentRatio, uint256 minimumRatio);
    error MoonVault__InsufficientCollateral();
    error MoonVault__InsufficientDebt();
    error MoonVault__InvalidPrice();
    error MoonVault__LiquidationNotImprovingPosition();
    error MoonVault__LiquidationTargetIsHealthy(uint256 currentRatio, uint256 minimumRatio);
    error MoonVault__LiquidationTooLarge(uint256 requestedBurnAmount, uint256 maxBurnAmount);
    error MoonVault__NeedsMoreThanZero();
    error MoonVault__SelfLiquidationNotAllowed();
    error MoonVault__TransferFailed();
    error MoonVault__ZeroAddress();

    uint256 public constant MIN_COLLATERAL_RATIO = 150;
    uint256 public constant LIQUIDATION_BONUS_PERCENT = 10;

    MoonUSDToken public immutable moonUsdToken;
    AggregatorV3Interface public immutable ethUsdPriceFeed;
    uint256 public immutable priceFeedScale;

    mapping(address user => uint256 amountWei) private s_collateralDeposited;
    mapping(address user => uint256 amountMoonUsd) private s_mintedDebt;

    event CollateralDeposited(address indexed user, uint256 amountWei);
    event CollateralRedeemed(address indexed user, uint256 amountWei);
    event LiquidationExecuted(
        address indexed liquidator,
        address indexed target,
        uint256 debtBurnedMoonUsd,
        uint256 collateralSeizedWei,
        uint256 resultingCollateralRatio
    );
    event MoonUsdBurned(address indexed user, uint256 amountMoonUsd);
    event MoonUsdMinted(address indexed user, uint256 amountMoonUsd);

    constructor(address tokenAddress, address priceFeedAddress) {
        if (tokenAddress == address(0) || priceFeedAddress == address(0)) {
            revert MoonVault__ZeroAddress();
        }

        moonUsdToken = MoonUSDToken(tokenAddress);
        ethUsdPriceFeed = AggregatorV3Interface(priceFeedAddress);
        priceFeedScale = 10 ** uint256(ethUsdPriceFeed.decimals());
    }

    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert MoonVault__NeedsMoreThanZero();
        }
        _;
    }

    function depositCollateral() external payable moreThanZero(msg.value) {
        s_collateralDeposited[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    function mint(uint256 amountMoonUsd) external moreThanZero(amountMoonUsd) nonReentrant {
        uint256 newDebt = s_mintedDebt[msg.sender] + amountMoonUsd;

        _revertIfCollateralRatioBroken(s_collateralDeposited[msg.sender], newDebt);

        s_mintedDebt[msg.sender] = newDebt;
        moonUsdToken.mint(msg.sender, amountMoonUsd);

        emit MoonUsdMinted(msg.sender, amountMoonUsd);
    }

    function burnAndRedeem(uint256 burnAmountMoonUsd, uint256 redeemAmountWei) external nonReentrant {
        if (burnAmountMoonUsd == 0 && redeemAmountWei == 0) {
            revert MoonVault__NeedsMoreThanZero();
        }

        uint256 updatedDebt = s_mintedDebt[msg.sender];
        uint256 updatedCollateral = s_collateralDeposited[msg.sender];

        if (burnAmountMoonUsd > 0) {
            if (burnAmountMoonUsd > updatedDebt) {
                revert MoonVault__InsufficientDebt();
            }

            updatedDebt -= burnAmountMoonUsd;
            s_mintedDebt[msg.sender] = updatedDebt;
            moonUsdToken.burn(msg.sender, burnAmountMoonUsd);

            emit MoonUsdBurned(msg.sender, burnAmountMoonUsd);
        }

        if (redeemAmountWei > 0) {
            if (redeemAmountWei > updatedCollateral) {
                revert MoonVault__InsufficientCollateral();
            }

            updatedCollateral -= redeemAmountWei;
            _revertIfCollateralRatioBroken(updatedCollateral, updatedDebt);

            s_collateralDeposited[msg.sender] = updatedCollateral;

            (bool success, ) = payable(msg.sender).call{value: redeemAmountWei}("");
            if (!success) {
                revert MoonVault__TransferFailed();
            }

            emit CollateralRedeemed(msg.sender, redeemAmountWei);
        }
    }

    function liquidate(address target, uint256 burnAmountMoonUsd)
        external
        moreThanZero(burnAmountMoonUsd)
        nonReentrant
    {
        if (target == address(0)) {
            revert MoonVault__ZeroAddress();
        }

        if (target == msg.sender) {
            revert MoonVault__SelfLiquidationNotAllowed();
        }

        uint256 targetDebt = s_mintedDebt[target];
        uint256 targetCollateral = s_collateralDeposited[target];

        if (targetDebt == 0) {
            revert MoonVault__InsufficientDebt();
        }

        if (targetCollateral == 0) {
            revert MoonVault__InsufficientCollateral();
        }

        if (burnAmountMoonUsd > targetDebt) {
            revert MoonVault__InsufficientDebt();
        }

        uint256 currentRatio = _calculateCollateralRatio(targetCollateral, targetDebt);
        if (currentRatio >= MIN_COLLATERAL_RATIO) {
            revert MoonVault__LiquidationTargetIsHealthy(currentRatio, MIN_COLLATERAL_RATIO);
        }

        uint256 collateralToSeizeWei;
        uint256 resultingRatio;

        if (burnAmountMoonUsd == targetDebt) {
            collateralToSeizeWei = targetCollateral;
            resultingRatio = type(uint256).max;
        } else {
            uint256 maxBurnAmount = _getMaxPartialLiquidationMoonUsd(targetCollateral);
            if (burnAmountMoonUsd > maxBurnAmount) {
                revert MoonVault__LiquidationTooLarge(burnAmountMoonUsd, maxBurnAmount);
            }

            collateralToSeizeWei = _getCollateralForDebtWithBonus(burnAmountMoonUsd);
            uint256 remainingCollateral = targetCollateral - collateralToSeizeWei;
            uint256 remainingDebt = targetDebt - burnAmountMoonUsd;
            resultingRatio = _calculateCollateralRatio(remainingCollateral, remainingDebt);

            if (resultingRatio <= currentRatio) {
                revert MoonVault__LiquidationNotImprovingPosition();
            }
        }

        s_mintedDebt[target] = targetDebt - burnAmountMoonUsd;
        s_collateralDeposited[target] = targetCollateral - collateralToSeizeWei;

        moonUsdToken.burn(msg.sender, burnAmountMoonUsd);

        (bool success, ) = payable(msg.sender).call{value: collateralToSeizeWei}("");
        if (!success) {
            revert MoonVault__TransferFailed();
        }

        emit LiquidationExecuted(msg.sender, target, burnAmountMoonUsd, collateralToSeizeWei, resultingRatio);
    }

    function getVault(address user)
        external
        view
        returns (uint256 collateralWei, uint256 mintedDebtMoonUsd, uint256 collateralValueUsd, uint256 collateralRatio)
    {
        collateralWei = s_collateralDeposited[user];
        mintedDebtMoonUsd = s_mintedDebt[user];
        collateralValueUsd = _getCollateralValueUsd(collateralWei);
        collateralRatio = _calculateCollateralRatio(collateralWei, mintedDebtMoonUsd);
    }

    function getCollateralDeposited(address user) external view returns (uint256) {
        return s_collateralDeposited[user];
    }

    function getMintedDebt(address user) external view returns (uint256) {
        return s_mintedDebt[user];
    }

    function getCollateralValueUsd(address user) external view returns (uint256) {
        return _getCollateralValueUsd(s_collateralDeposited[user]);
    }

    function getCollateralRatio(address user) external view returns (uint256) {
        return _calculateCollateralRatio(s_collateralDeposited[user], s_mintedDebt[user]);
    }

    function getEthPrice() external view returns (uint256) {
        return _getEthPrice();
    }

    function getMaxPartialLiquidationMoonUsd(address user) external view returns (uint256) {
        return _getMaxPartialLiquidationMoonUsd(s_collateralDeposited[user]);
    }

    function getLiquidationQuote(address user, uint256 burnAmountMoonUsd)
        external
        view
        returns (uint256 collateralToSeizeWei, uint256 resultingCollateralRatio, bool canLiquidate)
    {
        uint256 targetCollateral = s_collateralDeposited[user];
        uint256 targetDebt = s_mintedDebt[user];

        if (targetCollateral == 0 || targetDebt == 0 || burnAmountMoonUsd == 0) {
            return (0, 0, false);
        }

        uint256 currentRatio = _calculateCollateralRatio(targetCollateral, targetDebt);
        if (currentRatio >= MIN_COLLATERAL_RATIO || burnAmountMoonUsd > targetDebt) {
            return (0, currentRatio, false);
        }

        if (burnAmountMoonUsd == targetDebt) {
            return (targetCollateral, type(uint256).max, true);
        }

        uint256 maxBurnAmount = _getMaxPartialLiquidationMoonUsd(targetCollateral);
        if (burnAmountMoonUsd > maxBurnAmount) {
            return (0, currentRatio, false);
        }

        collateralToSeizeWei = _getCollateralForDebtWithBonus(burnAmountMoonUsd);
        uint256 remainingCollateral = targetCollateral - collateralToSeizeWei;
        uint256 remainingDebt = targetDebt - burnAmountMoonUsd;
        resultingCollateralRatio = _calculateCollateralRatio(remainingCollateral, remainingDebt);
        canLiquidate = resultingCollateralRatio > currentRatio;
    }

    function getTotalSystemCollateral() external view returns (uint256) {
        return address(this).balance;
    }

    function getTotalMoonUsdSupply() external view returns (uint256) {
        return moonUsdToken.totalSupply();
    }

    function _revertIfCollateralRatioBroken(uint256 collateralAmountWei, uint256 debtAmountMoonUsd) internal view {
        if (debtAmountMoonUsd == 0) {
            return;
        }

        uint256 collateralRatio = _calculateCollateralRatio(collateralAmountWei, debtAmountMoonUsd);
        if (collateralRatio < MIN_COLLATERAL_RATIO) {
            revert MoonVault__BreaksCollateralRatio(collateralRatio, MIN_COLLATERAL_RATIO);
        }
    }

    function _calculateCollateralRatio(uint256 collateralAmountWei, uint256 debtAmountMoonUsd)
        internal
        view
        returns (uint256)
    {
        if (debtAmountMoonUsd == 0) {
            return type(uint256).max;
        }

        uint256 collateralValueUsd = _getCollateralValueUsd(collateralAmountWei);
        return (collateralValueUsd * 100) / debtAmountMoonUsd;
    }

    function _getCollateralValueUsd(uint256 collateralAmountWei) internal view returns (uint256) {
        return (collateralAmountWei * _getEthPrice()) / priceFeedScale;
    }

    function _getCollateralForDebtWithBonus(uint256 debtAmountMoonUsd) internal view returns (uint256) {
        uint256 discountedDebtUsd = (debtAmountMoonUsd * (100 + LIQUIDATION_BONUS_PERCENT)) / 100;
        return (discountedDebtUsd * priceFeedScale) / _getEthPrice();
    }

    function _getMaxPartialLiquidationMoonUsd(uint256 collateralAmountWei) internal view returns (uint256) {
        if (collateralAmountWei == 0) {
            return 0;
        }

        uint256 collateralValueUsd = _getCollateralValueUsd(collateralAmountWei);
        return (collateralValueUsd * 100) / (100 + LIQUIDATION_BONUS_PERCENT);
    }

    function _getEthPrice() internal view returns (uint256) {
        (, int256 answer, , , ) = ethUsdPriceFeed.latestRoundData();
        if (answer <= 0) {
            revert MoonVault__InvalidPrice();
        }

        return uint256(answer);
    }
}
