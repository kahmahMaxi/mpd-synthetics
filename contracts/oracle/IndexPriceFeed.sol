// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../chain/Chain.sol";
import "../utils/Precision.sol";
import "./IPriceFeed.sol";

/**
 * @title IndexPriceFeed
 * @notice Aggregates multiple Chainlink price feeds into a single weighted index price
 * @dev Implements Chainlink-compatible interface for GMX V2 compatibility
 * 
 * Price Calculation:
 * - All Chainlink feeds return prices in 8 decimals
 * - Weights are normalized to sum to 1e18 (100% in 18 decimals)
 * - Index price = Σ(price_i * weight_i) for all assets
 * - Final price is returned in 8 decimals (Chainlink standard)
 * 
 * Safety Checks:
 * - Reverts if any feed price is stale (exceeds heartbeat)
 * - Reverts if any feed returns zero or negative price
 * - Enforces weight sum equals 1e18
 */
contract IndexPriceFeed is IPriceFeed, Ownable {
    using SafeCast for uint256;
    using SafeCast for int256;

    /**
     * @notice Asset configuration for the index
     * @param feedAddress Chainlink price feed address
     * @param weight Weight of this asset (must sum to 1e18 across all assets)
     * @param maxHeartbeat Maximum allowed heartbeat duration in seconds
     */
    struct AssetConfig {
        address feedAddress;
        uint256 weight; // In 18 decimals (1e18 = 100%)
        uint256 maxHeartbeat; // Maximum allowed heartbeat in seconds
    }

    /**
     * @notice Index configuration
     * @param name Human-readable name of the index
     * @param description Human-readable description
     * @param assets Array of asset configurations
     * @param totalWeight Sum of all weights (must equal 1e18)
     */
    struct IndexConfig {
        string name;
        string description;
        AssetConfig[] assets;
        uint256 totalWeight;
    }

    IndexConfig public indexConfig;
    uint8 public constant decimals = 8; // Chainlink standard
    uint256 public constant version = 1;

    event AssetsUpdated(address[] feeds, uint256[] weights, uint256[] maxHeartbeats);
    event IndexNameUpdated(string oldName, string newName);
    event IndexDescriptionUpdated(string oldDescription, string newDescription);

    /**
     * @notice Constructor
     * @param _name Index name (e.g., "DeFi-5 Index")
     * @param _description Index description
     * @param _feeds Array of Chainlink price feed addresses
     * @param _weights Array of weights (must sum to 1e18)
     * @param _maxHeartbeats Array of max heartbeat durations in seconds
     */
    constructor(
        string memory _name,
        string memory _description,
        address[] memory _feeds,
        uint256[] memory _weights,
        uint256[] memory _maxHeartbeats
    ) {
        _setAssets(_feeds, _weights, _maxHeartbeats);
        indexConfig.name = _name;
        indexConfig.description = _description;
    }

    /**
     * @notice Update asset configuration
     * @param _feeds Array of Chainlink price feed addresses
     * @param _weights Array of weights (must sum to 1e18)
     * @param _maxHeartbeats Array of max heartbeat durations in seconds
     * @dev Only owner can call
     */
    function setAssets(
        address[] memory _feeds,
        uint256[] memory _weights,
        uint256[] memory _maxHeartbeats
    ) external onlyOwner {
        _setAssets(_feeds, _weights, _maxHeartbeats);
        emit AssetsUpdated(_feeds, _weights, _maxHeartbeats);
    }

    /**
     * @notice Update index name
     * @param _name New index name
     * @dev Only owner can call
     */
    function setName(string memory _name) external onlyOwner {
        string memory oldName = indexConfig.name;
        indexConfig.name = _name;
        emit IndexNameUpdated(oldName, _name);
    }

    /**
     * @notice Update index description
     * @param _description New index description
     * @dev Only owner can call
     */
    function setDescription(string memory _description) external onlyOwner {
        string memory oldDescription = indexConfig.description;
        indexConfig.description = _description;
        emit IndexDescriptionUpdated(oldDescription, _description);
    }

    /**
     * @notice Get the latest round data (Chainlink-compatible)
     * @return roundId Round ID (always 1 for index feed)
     * @return answer Index price in 8 decimals
     * @return startedAt Timestamp when round started (current block timestamp)
     * @return updatedAt Timestamp when round was updated (current block timestamp)
     * @return answeredInRound Round ID (always 1 for index feed)
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
        uint256 indexPrice = _getIndexPrice();
        uint256 timestamp = Chain.currentTimestamp();

        return (
            1, // roundId
            indexPrice.toInt256(), // answer
            timestamp, // startedAt
            timestamp, // updatedAt
            1 // answeredInRound
        );
    }

    /**
     * @notice Get the latest answer (Chainlink-compatible)
     * @return answer Index price in 8 decimals
     */
    function latestAnswer() external view returns (int256) {
        return _getIndexPrice().toInt256();
    }

    /**
     * @notice Get index description (Chainlink-compatible)
     * @return description Human-readable description
     */
    function description() external view returns (string memory) {
        return indexConfig.description;
    }

    /**
     * @notice Get number of assets in the index
     * @return count Number of assets
     */
    function getAssetCount() external view returns (uint256) {
        return indexConfig.assets.length;
    }

    /**
     * @notice Get asset configuration at index
     * @param index Asset index
     * @return asset Asset configuration
     */
    function getAsset(uint256 index) external view returns (AssetConfig memory) {
        require(index < indexConfig.assets.length, "IndexPriceFeed: invalid index");
        return indexConfig.assets[index];
    }

    /**
     * @notice Internal function to set assets
     * @param _feeds Array of Chainlink price feed addresses
     * @param _weights Array of weights (must sum to 1e18)
     * @param _maxHeartbeats Array of max heartbeat durations in seconds
     */
    function _setAssets(
        address[] memory _feeds,
        uint256[] memory _weights,
        uint256[] memory _maxHeartbeats
    ) internal {
        require(_feeds.length > 0, "IndexPriceFeed: empty feeds");
        require(_feeds.length == _weights.length, "IndexPriceFeed: feeds/weights length mismatch");
        require(_feeds.length == _maxHeartbeats.length, "IndexPriceFeed: feeds/heartbeats length mismatch");

        // Clear existing assets
        delete indexConfig.assets;

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < _feeds.length; i++) {
            require(_feeds[i] != address(0), "IndexPriceFeed: zero feed address");
            require(_weights[i] > 0, "IndexPriceFeed: zero weight");
            require(_maxHeartbeats[i] > 0, "IndexPriceFeed: zero heartbeat");

            // Verify feed implements IPriceFeed
            IPriceFeed feed = IPriceFeed(_feeds[i]);
            require(feed.decimals() == 8, "IndexPriceFeed: feed must have 8 decimals");

            indexConfig.assets.push(AssetConfig({
                feedAddress: _feeds[i],
                weight: _weights[i],
                maxHeartbeat: _maxHeartbeats[i]
            }));

            totalWeight += _weights[i];
        }

        require(totalWeight == Precision.WEI_PRECISION, "IndexPriceFeed: weights must sum to 1e18");
        indexConfig.totalWeight = totalWeight;
    }

    /**
     * @notice Internal function to calculate index price
     * @return indexPrice Index price in 8 decimals
     * @dev Aggregates weighted prices from all feeds
     */
    function _getIndexPrice() internal view returns (uint256) {
        require(indexConfig.assets.length > 0, "IndexPriceFeed: no assets configured");

        uint256 totalPrice = 0;
        uint256 currentTimestamp = Chain.currentTimestamp();

        for (uint256 i = 0; i < indexConfig.assets.length; i++) {
            AssetConfig memory asset = indexConfig.assets[i];
            IPriceFeed feed = IPriceFeed(asset.feedAddress);

            // Get latest round data from Chainlink feed
            (
                uint80 /* roundId */,
                int256 price,
                uint256 /* startedAt */,
                uint256 updatedAt,
                uint80 /* answeredInRound */
            ) = feed.latestRoundData();

            // Safety checks
            require(price > 0, "IndexPriceFeed: non-positive price");
            
            // Check heartbeat
            require(
                currentTimestamp >= updatedAt,
                "IndexPriceFeed: future timestamp"
            );
            require(
                currentTimestamp - updatedAt <= asset.maxHeartbeat,
                "IndexPriceFeed: stale price"
            );

            // All Chainlink feeds return prices in 8 decimals
            // Weight is in 18 decimals
            // Price contribution = price * weight / 1e18
            // Since price is in 8 decimals and weight is in 18 decimals:
            // contribution = (price * weight) / 1e18 = price * (weight / 1e18)
            // This gives us price contribution in 8 decimals
            uint256 priceUint = price.toUint256();
            uint256 contribution = Precision.mulDiv(
                priceUint,
                asset.weight,
                Precision.WEI_PRECISION
            );

            totalPrice += contribution;
        }

        return totalPrice;
    }
}

