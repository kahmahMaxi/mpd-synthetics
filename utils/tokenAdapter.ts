// --- MPD Reward Wiring Start ---
/**
 * @title Token Adapter
 * @notice Unified adapter for resolving MPD token addresses with fallback to GMX tokens
 * @dev Used by reward system components to prefer MPD/esMPD/Vester addresses
 */

import fs from "fs";
import path from "path";
import { MPDConfigShape, DEFAULT_MPD_CONFIG } from "../config/tokens.mpd.constants";

// Cached config to avoid repeated file reads
let cachedMpdConfig: MPDConfigShape | null = null;

/**
 * Load the MPD config from tokens.mpd.json
 * @param forceReload - If true, reload from disk even if cached
 * @returns The MPD configuration object
 */
function loadMpdConfigInternal(forceReload = false): MPDConfigShape {
  if (cachedMpdConfig && !forceReload) {
    return cachedMpdConfig;
  }

  let configPath: string;
  try {
    configPath = path.resolve(__dirname, "..", "config", "tokens.mpd.json");
  } catch {
    configPath = "./config/tokens.mpd.json";
  }

  if (!fs.existsSync(configPath)) {
    console.warn(`[TokenAdapter] MPD config not found: ${configPath}`);
    return DEFAULT_MPD_CONFIG;
  }

  try {
    const configRaw = fs.readFileSync(configPath, "utf8");
    cachedMpdConfig = JSON.parse(configRaw) as MPDConfigShape;
    return cachedMpdConfig;
  } catch (error) {
    console.error(`[TokenAdapter] Error loading MPD config: ${error}`);
    return DEFAULT_MPD_CONFIG;
  }
}

/**
 * Get MPD token address
 * @returns MPD token address or empty string if not configured
 */
export function getMpdAddress(): string {
  const config = loadMpdConfigInternal();
  const address = config.MPDToken || config.addresses?.mpd || "";
  
  if (!address) {
    console.warn("[TokenAdapter] MPD token address not configured");
  }
  
  return address;
}

/**
 * Get esMPD token address
 * @returns esMPD token address or empty string if not configured
 */
export function getEsMpdAddress(): string {
  const config = loadMpdConfigInternal();
  const address = config.esMPD || config.addresses?.esMpd || "";
  
  if (!address) {
    console.warn("[TokenAdapter] esMPD token address not configured");
  }
  
  return address;
}

/**
 * Get Vester contract address
 * @returns Vester address or empty string if not configured
 */
export function getVesterAddress(): string {
  const config = loadMpdConfigInternal();
  const address = config.Vester || config.addresses?.vester || "";
  
  if (!address) {
    console.warn("[TokenAdapter] Vester address not configured");
  }
  
  return address;
}

/**
 * Get vesting duration from config
 * @returns Vesting duration in seconds (default: 365 days)
 */
export function getVestingDuration(): number {
  const config = loadMpdConfigInternal();
  return config.vestingDuration || 31536000; // 365 days default
}

/**
 * Check if MPD system is fully configured
 * @returns true if all MPD addresses are available
 */
export function isMpdSystemConfigured(): boolean {
  const config = loadMpdConfigInternal();
  return !!(config.MPDToken && config.esMPD && config.Vester);
}

/**
 * Get reward token address - prefers MPD if configured, falls back to provided GMX address
 * @param gmxFallback - GMX token address to use if MPD not configured
 * @returns Token address (MPD preferred, GMX fallback)
 */
export function getRewardTokenAddress(gmxFallback?: string): string {
  const mpdAddress = getMpdAddress();
  if (mpdAddress) {
    return mpdAddress;
  }
  
  if (gmxFallback) {
    console.warn("[TokenAdapter] Using GMX fallback for reward token");
    return gmxFallback;
  }
  
  return "";
}

/**
 * Get escrowed reward token address - prefers esMPD if configured, falls back to provided esGMX address
 * @param esGmxFallback - esGMX token address to use if esMPD not configured
 * @returns Token address (esMPD preferred, esGMX fallback)
 */
export function getEsRewardTokenAddress(esGmxFallback?: string): string {
  const esMpdAddress = getEsMpdAddress();
  if (esMpdAddress) {
    return esMpdAddress;
  }
  
  if (esGmxFallback) {
    console.warn("[TokenAdapter] Using esGMX fallback for escrowed reward token");
    return esGmxFallback;
  }
  
  return "";
}

/**
 * Get vester address - prefers MPD Vester if configured, falls back to provided vester address
 * @param vesterFallback - Fallback vester address
 * @returns Vester address (MPD Vester preferred, fallback otherwise)
 */
export function getRewardVesterAddress(vesterFallback?: string): string {
  const vesterAddress = getVesterAddress();
  if (vesterAddress) {
    return vesterAddress;
  }
  
  if (vesterFallback) {
    console.warn("[TokenAdapter] Using fallback vester address");
    return vesterFallback;
  }
  
  return "";
}

/**
 * Get all MPD addresses as an object
 * @returns Object with mpd, esMpd, vester addresses
 */
export function getAllMpdAddresses(): { mpd: string; esMpd: string; vester: string } {
  return {
    mpd: getMpdAddress(),
    esMpd: getEsMpdAddress(),
    vester: getVesterAddress(),
  };
}

/**
 * Clear the cached MPD config (useful for testing or config reload)
 */
export function clearTokenAdapterCache(): void {
  cachedMpdConfig = null;
}

/**
 * Get the network from MPD config
 * @returns Network name or empty string
 */
export function getMpdNetwork(): string {
  const config = loadMpdConfigInternal();
  return config.network || "";
}

// --- MPD Reward Wiring End ---

