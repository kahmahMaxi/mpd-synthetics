// --- MPD Integration Start ---
/**
 * @title MPD Token Constants
 * @notice Typed constants for MPD DEX token system integration
 * @dev These constants define the keys used to reference MPD tokens in the config system.
 *      This is part of the GMX V2 fork for MPD DEX.
 */

/**
 * MPD Token Key Constants
 * @description Keys used to identify MPD tokens in configuration and data stores
 */
export const MPDConstants = {
  /** Key for the MPD governance token */
  MPD_TOKEN_KEY: "MPDToken",
  /** Key for the escrowed MPD token (non-transferable) */
  ES_MPD_TOKEN_KEY: "esMPDToken",
  /** Key for the MPD Vester contract */
  MPD_VESTER_KEY: "MPDVester",
  /** Key for MPD token in simple form */
  MPD: "MPD",
  /** Key for escrowed MPD in simple form */
  ES_MPD: "esMPD",
  /** Key for Vester in simple form */
  VESTER: "Vester",
} as const;

/**
 * Type representing the MPD constants object
 */
export type MPDConstantsType = typeof MPDConstants;

/**
 * Type for MPD token keys
 */
export type MPDTokenKey = keyof typeof MPDConstants;

/**
 * MPD Config Shape
 * @description Interface for the tokens.mpd.json structure
 */
export interface MPDConfigShape {
  network: string;
  MPDToken: string;
  esMPD: string;
  Vester: string;
  deployer?: string;
  timestamp?: string;
  vestingDuration?: number;
  addresses: {
    mpd: string;
    esMpd: string;
    vester: string;
  };
  meta?: {
    source: string;
    generated: string;
  };
}

/**
 * Default empty MPD config for fallback
 */
export const DEFAULT_MPD_CONFIG: MPDConfigShape = {
  network: "",
  MPDToken: "",
  esMPD: "",
  Vester: "",
  addresses: {
    mpd: "",
    esMpd: "",
    vester: "",
  },
};

// --- MPD Integration End ---

