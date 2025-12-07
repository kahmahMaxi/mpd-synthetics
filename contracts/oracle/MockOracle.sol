// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MockPriceFeed.sol";

/**
 * @title MockOracle
 * @notice Simple oracle that reads prices from MockPriceFeed contracts
 * @dev Maps token addresses to their price feed addresses
 */
contract MockOracle is Ownable {
    mapping(address => address) public priceFeeds; // token => priceFeed

    event PriceFeedRegistered(address indexed token, address indexed priceFeed);
    event PriceFeedRemoved(address indexed token);

    /**
     * @notice Register a price feed for a token
     * @param token Token address
     * @param priceFeed Price feed address
     */
    function registerPriceFeed(address token, address priceFeed) external onlyOwner {
        require(token != address(0), "MockOracle: invalid token");
        require(priceFeed != address(0), "MockOracle: invalid priceFeed");
        priceFeeds[token] = priceFeed;
        emit PriceFeedRegistered(token, priceFeed);
    }

    /**
     * @notice Remove a price feed for a token
     * @param token Token address
     */
    function removePriceFeed(address token) external onlyOwner {
        require(priceFeeds[token] != address(0), "MockOracle: priceFeed not registered");
        delete priceFeeds[token];
        emit PriceFeedRemoved(token);
    }

    /**
     * @notice Get the price for a token
     * @param token Token address
     * @return price Price in 8-decimal format, or 0 if not found
     */
    function getPrice(address token) external view returns (uint256) {
        address feed = priceFeeds[token];
        if (feed == address(0)) {
            return 0;
        }
        return MockPriceFeed(feed).price();
    }

    /**
     * @notice Get the price feed address for a token
     * @param token Token address
     * @return feed Price feed address, or address(0) if not registered
     */
    function getPriceFeed(address token) external view returns (address) {
        return priceFeeds[token];
    }

    /**
     * @notice Check if a token has a registered price feed
     * @param token Token address
     * @return hasFeed True if price feed is registered
     */
    function hasPriceFeed(address token) external view returns (bool) {
        return priceFeeds[token] != address(0);
    }
}

