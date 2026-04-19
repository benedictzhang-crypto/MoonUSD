// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

contract MockPriceFeed is AggregatorV3Interface {
    uint8 private immutable i_decimals;
    int256 private s_answer;
    uint80 private s_roundId;

    constructor(uint8 feedDecimals, int256 initialAnswer) {
        i_decimals = feedDecimals;
        s_answer = initialAnswer;
        s_roundId = 1;
    }

    function decimals() external view returns (uint8) {
        return i_decimals;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (s_roundId, s_answer, block.timestamp, block.timestamp, s_roundId);
    }

    function updateAnswer(int256 newAnswer) external {
        require(newAnswer > 0, "invalid price");

        s_answer = newAnswer;
        s_roundId += 1;
    }
}
