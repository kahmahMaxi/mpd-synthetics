// --- MPD Reward Wiring Start ---
/**
 * @title Reward Adapter
 * @notice Adapter functions for MPD reward system addresses
 * @dev Provides unified interface for getting MPD/esMPD/Vester/FeeDistributor addresses
 */

import {
  getMpdAddress as getMpdFromTokenAdapter,
  getEsMpdAddress as getEsMpdFromTokenAdapter,
  getVesterAddress as getVesterFromTokenAdapter,
} from "./tokenAdapter";

/**
 * Get MPD token address
 * @returns MPD token address
 */
export function getMpdAddress(): string {
  return getMpdFromTokenAdapter();
}

/**
 * Get esMPD token address
 * @returns esMPD token address
 */
export function getEsMpdAddress(): string {
  return getEsMpdFromTokenAdapter();
}

/**
 * Get Vester contract address
 * @returns Vester address
 */
export function getVesterAddress(): string {
  return getVesterFromTokenAdapter();
}

/**
 * Get FeeDistributor contract address
 * @returns FeeDistributor address or empty string if not deployed
 */
export async function getFeeDistributorAddress(): Promise<string> {
  try {
    const hre = await import("hardhat");
    const feeDistributor = await hre.default.deployments.get("FeeDistributor");
    return feeDistributor.address;
  } catch (error) {
    console.warn("[RewardAdapter] FeeDistributor not deployed:", error);
    return "";
  }
}

/**
 * Get all reward-related addresses
 * @returns Object with all addresses
 */
export async function getAllRewardAddresses(): Promise<{
  mpd: string;
  esMpd: string;
  vester: string;
  feeDistributor: string;
}> {
  return {
    mpd: getMpdAddress(),
    esMpd: getEsMpdAddress(),
    vester: getVesterAddress(),
    feeDistributor: await getFeeDistributorAddress(),
  };
}

// --- MPD Reward Wiring End ---

