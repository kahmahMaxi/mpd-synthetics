// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../data/DataStore.sol";

// --- MPD Integration Start ---
/**
 * @title MpdTokenConfig
 * @notice Configuration library for MPD Token system integration
 * @dev Provides functions for reading MPD, esMPD, and Vester addresses from DataStore.
 *      This mirrors the existing GMX config pattern but provides MPD-specific keys and getters.
 *      Part of the GMX V2 fork for MPD DEX.
 */
library MpdTokenConfig {
    // ============ MPD Token Keys ============

    /// @notice Key for the MPD governance token address
    bytes32 public constant MPD_TOKEN = keccak256(abi.encode("MPD_TOKEN"));

    /// @notice Key for the escrowed MPD (esMPD) token address
    bytes32 public constant ES_MPD_TOKEN = keccak256(abi.encode("ES_MPD_TOKEN"));

    /// @notice Key for the MPD Vester contract address
    bytes32 public constant MPD_VESTER = keccak256(abi.encode("MPD_VESTER"));

    /// @notice Key for the MPD vesting duration in seconds
    bytes32 public constant MPD_VESTING_DURATION = keccak256(abi.encode("MPD_VESTING_DURATION"));

    // ============ MPD Fee Distributor Keys ============

    /// @notice Key for the extended MPD tracker (staking tracker)
    bytes32 public constant EXTENDED_MPD_TRACKER = keccak256(abi.encode("EXTENDED_MPD_TRACKER"));

    /// @notice Key for MPD fee amount for a given chain
    bytes32 public constant FEE_DISTRIBUTOR_FEE_AMOUNT_MPD = keccak256(abi.encode("FEE_DISTRIBUTOR_FEE_AMOUNT_MPD"));

    /// @notice Key for total MPD fee amount across all chains
    bytes32 public constant FEE_DISTRIBUTOR_TOTAL_FEE_AMOUNT_MPD = keccak256(abi.encode("FEE_DISTRIBUTOR_TOTAL_FEE_AMOUNT_MPD"));

    /// @notice Key for staked MPD for a given chain
    bytes32 public constant FEE_DISTRIBUTOR_STAKED_MPD = keccak256(abi.encode("FEE_DISTRIBUTOR_STAKED_MPD"));

    /// @notice Key for total staked MPD across all chains
    bytes32 public constant FEE_DISTRIBUTOR_TOTAL_STAKED_MPD = keccak256(abi.encode("FEE_DISTRIBUTOR_TOTAL_STAKED_MPD"));

    /// @notice Key for MPD price for reward calculations
    bytes32 public constant FEE_DISTRIBUTOR_MPD_PRICE = keccak256(abi.encode("FEE_DISTRIBUTOR_MPD_PRICE"));

    /// @notice Key for max esMPD referral rewards amount
    bytes32 public constant FEE_DISTRIBUTOR_MAX_REFERRAL_REWARDS_ESMPD_AMOUNT = keccak256(abi.encode("FEE_DISTRIBUTOR_MAX_REFERRAL_REWARDS_ESMPD_AMOUNT"));

    // ============ Getters ============

    /**
     * @notice Get the MPD Token address from DataStore
     * @param dataStore The DataStore contract instance
     * @return The MPD Token address
     */
    function getMpdToken(DataStore dataStore) internal view returns (address) {
        return dataStore.getAddress(MPD_TOKEN);
    }

    /**
     * @notice Get the esMPD Token address from DataStore
     * @param dataStore The DataStore contract instance
     * @return The esMPD Token address
     */
    function getEsMpdToken(DataStore dataStore) internal view returns (address) {
        return dataStore.getAddress(ES_MPD_TOKEN);
    }

    /**
     * @notice Get the MPD Vester contract address from DataStore
     * @param dataStore The DataStore contract instance
     * @return The MPD Vester address
     */
    function getMpdVester(DataStore dataStore) internal view returns (address) {
        return dataStore.getAddress(MPD_VESTER);
    }

    /**
     * @notice Get the MPD vesting duration from DataStore
     * @param dataStore The DataStore contract instance
     * @return The vesting duration in seconds
     */
    function getMpdVestingDuration(DataStore dataStore) internal view returns (uint256) {
        return dataStore.getUint(MPD_VESTING_DURATION);
    }

    /**
     * @notice Get the extended MPD tracker address from DataStore
     * @param dataStore The DataStore contract instance
     * @return The extended MPD tracker address
     */
    function getExtendedMpdTracker(DataStore dataStore) internal view returns (address) {
        return dataStore.getAddress(EXTENDED_MPD_TRACKER);
    }

    /**
     * @notice Check if MPD token system is configured (all addresses are set)
     * @param dataStore The DataStore contract instance
     * @return True if all MPD addresses are configured, false otherwise
     */
    function isMpdConfigured(DataStore dataStore) internal view returns (bool) {
        return getMpdToken(dataStore) != address(0) &&
               getEsMpdToken(dataStore) != address(0) &&
               getMpdVester(dataStore) != address(0);
    }

    // ============ Key Generators ============

    /**
     * @notice Generate key for MPD fee amount for a specific chain
     * @param chainId The chain ID
     * @return The key for the MPD fee amount on that chain
     */
    function feeDistributorFeeAmountMpdKey(uint256 chainId) internal pure returns (bytes32) {
        return keccak256(abi.encode(FEE_DISTRIBUTOR_FEE_AMOUNT_MPD, chainId));
    }

    /**
     * @notice Generate key for staked MPD for a specific chain
     * @param chainId The chain ID
     * @return The key for staked MPD on that chain
     */
    function feeDistributorStakedMpdKey(uint256 chainId) internal pure returns (bytes32) {
        return keccak256(abi.encode(FEE_DISTRIBUTOR_STAKED_MPD, chainId));
    }
}
// --- MPD Integration End ---

