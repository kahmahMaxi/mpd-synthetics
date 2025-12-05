// --- MPD Integration Start ---
/**
 * @title MPD Token Adapter
 * @notice Utility functions for loading MPD token addresses and configs
 * @dev Provides fallback mechanisms and safe resolution for MPD token system
 */

import fs from "fs";
import path from "path";
import { MPDConstants, MPDConfigShape, DEFAULT_MPD_CONFIG } from "../config/tokens.mpd.constants";

// Cached config to avoid repeated file reads
let cachedMpdConfig: MPDConfigShape | null = null;

/**
 * Load the MPD config from tokens.mpd.json
 * @param forceReload - If true, reload from disk even if cached
 * @returns The MPD configuration object
 */
export function loadMpdConfig(forceReload = false): MPDConfigShape {
  if (cachedMpdConfig && !forceReload) {
    return cachedMpdConfig;
  }

  // Use require.resolve-style path resolution for compatibility
  let configPath: string;
  try {
    configPath = path.resolve(__dirname, "..", "config", "tokens.mpd.json");
  } catch {
    // Fallback for environments where __dirname might not be available
    configPath = "./config/tokens.mpd.json";
  }

  if (!fs.existsSync(configPath)) {
    console.warn(`[MPD Adapter] Config file not found: ${configPath}`);
    return DEFAULT_MPD_CONFIG;
  }

  try {
    const configRaw = fs.readFileSync(configPath, "utf8");
    cachedMpdConfig = JSON.parse(configRaw) as MPDConfigShape;
    return cachedMpdConfig;
  } catch (error) {
    console.error(`[MPD Adapter] Error loading config: ${error}`);
    return DEFAULT_MPD_CONFIG;
  }
}

/**
 * Get MPD token address by key
 * @param key - The key to look up (MPDToken, esMPD, Vester, or aliases)
 * @returns The token address or empty string if not found
 */
export function getMpdTokenAddress(key: string): string {
  const config = loadMpdConfig();

  // Direct key mapping
  switch (key) {
    case MPDConstants.MPD_TOKEN_KEY:
    case MPDConstants.MPD:
    case "mpd":
    case "MPD":
      return config.MPDToken || config.addresses?.mpd || "";

    case MPDConstants.ES_MPD_TOKEN_KEY:
    case MPDConstants.ES_MPD:
    case "esMPD":
    case "esmpd":
    case "esMpd":
      return config.esMPD || config.addresses?.esMpd || "";

    case MPDConstants.MPD_VESTER_KEY:
    case MPDConstants.VESTER:
    case "Vester":
    case "vester":
      return config.Vester || config.addresses?.vester || "";

    default:
      // Check if key exists directly in config
      if (key in config) {
        const value = (config as unknown as Record<string, unknown>)[key];
        return typeof value === "string" ? value : "";
      }
      return "";
  }
}

/**
 * Get a generic token address - checks MPD config first, then falls back
 * @param key - The token key to look up
 * @param fallbackConfig - Optional fallback config object to check
 * @returns The token address or empty string
 */
export function getTokenAddress(key: string, fallbackConfig?: Record<string, string>): string {
  // First, try MPD config for MPD-specific keys
  const mpdAddress = getMpdTokenAddress(key);
  if (mpdAddress) {
    return mpdAddress;
  }

  // Fallback to provided config
  if (fallbackConfig && key in fallbackConfig) {
    return fallbackConfig[key];
  }

  return "";
}

/**
 * Check if MPD config is available and valid
 * @returns true if MPD tokens are configured
 */
export function isMpdConfigured(): boolean {
  const config = loadMpdConfig();
  return !!(config.MPDToken && config.esMPD && config.Vester);
}

/**
 * Get all MPD token addresses as a flat object
 * @returns Object with all MPD token addresses
 */
export function getAllMpdAddresses(): Record<string, string> {
  const config = loadMpdConfig();
  return {
    MPDToken: config.MPDToken || "",
    esMPD: config.esMPD || "",
    Vester: config.Vester || "",
    mpd: config.addresses?.mpd || config.MPDToken || "",
    esMpd: config.addresses?.esMpd || config.esMPD || "",
    vester: config.addresses?.vester || config.Vester || "",
  };
}

/**
 * Clear the cached config (useful for testing)
 */
export function clearMpdConfigCache(): void {
  cachedMpdConfig = null;
}

/**
 * Get the MPD config network
 * @returns The network name from config
 */
export function getMpdNetwork(): string {
  const config = loadMpdConfig();
  return config.network || "";
}

/**
 * Get the vesting duration from config
 * @returns The vesting duration in seconds, or 0 if not set
 */
export function getVestingDuration(): number {
  const config = loadMpdConfig();
  return config.vestingDuration || 0;
}

// --- MPD Integration End ---

