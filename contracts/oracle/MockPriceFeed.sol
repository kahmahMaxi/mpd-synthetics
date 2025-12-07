// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockPriceFeed
 * @notice Simple mock price feed for testing and local development
 * @dev Uses 8-decimal precision (e.g., 1 ETH = 2000 * 1e8)
 */
contract MockPriceFeed is Ownable {
    uint256 public price;
    uint8 public constant decimals = 8;

    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    /**
     * @param initialPrice Initial price in 8-decimal format (e.g., 2000 * 1e8 for $2000)
     */
    constructor(uint256 initialPrice) {
        price = initialPrice;
        emit PriceUpdated(0, initialPrice);
    }

    /**
     * @notice Update the price
     * @param newPrice New price in 8-decimal format
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = price;
        price = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }

    /**
     * @notice Get the latest price (Chainlink-compatible interface)
     * @return roundId Round ID (always 1 for mock)
     * @return answer Price in 8-decimal format
     * @return startedAt Timestamp when round started (block timestamp)
     * @return updatedAt Timestamp when round was updated (block timestamp)
     * @return answeredInRound Round ID (always 1 for mock)
     */
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
        return (1, int256(price), block.timestamp, block.timestamp, 1);
    }

    /**
     * @notice Get the latest answer (Chainlink-compatible interface)
     * @return answer Price in 8-decimal format
     */
    function latestAnswer() external view returns (int256) {
        return int256(price);
    }
}

