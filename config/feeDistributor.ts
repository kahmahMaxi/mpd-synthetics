import { HardhatRuntimeEnvironment } from "hardhat/types";
// --- MPD Integration Start ---
import fs from "fs";
import path from "path";
import { MPDConfigShape, DEFAULT_MPD_CONFIG } from "./tokens.mpd.constants";
// --- MPD Integration End ---

export type FeeDistributorConfig = {
  feeDistributor?: string;
  // --- MPD Integration Start ---
  gmx?: string;
  esGmx?: string;
  wnt?: string;
  mpd?: string;
  esMpd?: string;
  // --- MPD Integration End ---
};

// --- MPD Integration Start ---
/**
 * Load MPD token addresses from tokens.mpd.json
 * @returns MPD config or default empty config
 */
function loadMpdConfig(): MPDConfigShape {
  try {
    const configPath = path.join(__dirname, "tokens.mpd.json");
    if (fs.existsSync(configPath)) {
      const configRaw = fs.readFileSync(configPath, "utf8");
      return JSON.parse(configRaw) as MPDConfigShape;
    }
  } catch (error) {
    console.warn("[FeeDistributor] Could not load MPD config:", error);
  }
  return DEFAULT_MPD_CONFIG;
}
// --- MPD Integration End ---

export default async function (hre: HardhatRuntimeEnvironment): Promise<FeeDistributorConfig> {
  // --- MPD Integration Start ---
  const mpdConfig = loadMpdConfig();
  // --- MPD Integration End ---

  const config: { [network: string]: FeeDistributorConfig } = {
    // --- MPD Integration Start ---
    hardhat: {
      // MPD tokens for local development
      mpd: mpdConfig.MPDToken || "",
      esMpd: mpdConfig.esMPD || "",
    },
    localhost: {
      // MPD tokens for localhost
      mpd: mpdConfig.MPDToken || "",
      esMpd: mpdConfig.esMPD || "",
    },
    // --- MPD Integration End ---
    arbitrum: {
      gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
      esGmx: "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA",
      wnt: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      // --- MPD Integration Start ---
      mpd: mpdConfig.MPDToken || "",
      esMpd: mpdConfig.esMPD || "",
      // --- MPD Integration End ---
    },
    avalanche: {
      gmx: "0x62edc0692BD897D2295872a9FFCac5425011c661",
      esGmx: "0xff1489227bbaac61a9209a08929e4c2a526ddd17",
      wnt: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      // --- MPD Integration Start ---
      mpd: mpdConfig.MPDToken || "",
      esMpd: mpdConfig.esMPD || "",
      // --- MPD Integration End ---
    },
    avalancheFuji: {
      gmx: "To be added",
      esGmx: "To be added",
      wnt: "To be added",
      // --- MPD Integration Start ---
      mpd: mpdConfig.MPDToken || "",
      esMpd: mpdConfig.esMPD || "",
      // --- MPD Integration End ---
    },
    arbitrumSepolia: {
      gmx: "To be added",
      esGmx: "To be added",
      wnt: "To be added",
      // --- MPD Integration Start ---
      mpd: mpdConfig.MPDToken || "",
      esMpd: mpdConfig.esMPD || "",
      // --- MPD Integration End ---
    },
  };

  const feeDistributorConfig: FeeDistributorConfig = config[hre.network.name];

  return feeDistributorConfig;
}
