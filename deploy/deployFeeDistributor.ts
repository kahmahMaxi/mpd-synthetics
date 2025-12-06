import { grantRoleIfNotGranted } from "../utils/role";
import { createDeployFunction } from "../utils/deploy";
// --- MPD Reward Wiring Start ---
import { getRewardTokenAddress, getEsRewardTokenAddress, isMpdSystemConfigured } from "../utils/tokenAdapter";
// --- MPD Reward Wiring End ---

const constructorContracts = [
  "RoleStore",
  "FeeDistributorVault",
  "FeeHandler",
  "DataStore",
  "EventEmitter",
  "MultichainReader",
  "ClaimVault",
];

const func = createDeployFunction({
  contractName: "FeeDistributor",
  dependencyNames: constructorContracts,
  getDeployArgs: async ({ dependencyContracts, gmx, network }) => {
    const feeDistributorConfig = await gmx.getFeeDistributor();
    let gmxAddress = feeDistributorConfig.gmx;
    let esGmxAddress = feeDistributorConfig.esGmx;
    let wntAddress = feeDistributorConfig.wnt;

    // --- MPD Reward Wiring Start ---
    // Prefer MPD addresses if configured, fall back to GMX addresses
    if (isMpdSystemConfigured()) {
      console.log("[FeeDistributor] Using MPD token addresses");
      gmxAddress = getRewardTokenAddress(gmxAddress);
      esGmxAddress = getEsRewardTokenAddress(esGmxAddress);
    }
    // --- MPD Reward Wiring End ---

    if (network.name === "hardhat" || network.name === "localhost") {
      const tokens = await hre.gmx.getTokens();
      // --- MPD Reward Wiring Start ---
      // For hardhat network, prefer MPD if configured
      if (isMpdSystemConfigured()) {
        gmxAddress = getRewardTokenAddress(tokens.GMX?.address);
        esGmxAddress = getEsRewardTokenAddress(tokens.ESGMX?.address);
      } else {
        gmxAddress = tokens.GMX.address;
        esGmxAddress = tokens.ESGMX.address;
      }
      // --- MPD Reward Wiring End ---
      wntAddress = tokens.WETH.address;
    }
    if (!gmxAddress) {
      throw new Error("gmxAddress is not defined");
    }
    if (!esGmxAddress) {
      throw new Error("esGmxAddress is not defined");
    }
    if (!wntAddress) {
      throw new Error("wntAddress is not defined");
    }
    return constructorContracts
      .map((dependencyName) => dependencyContracts[dependencyName].address)
      .concat(gmxAddress)
      .concat(esGmxAddress)
      .concat(wntAddress);
  },
  libraryNames: ["FeeDistributorUtils", "ClaimUtils"],
  afterDeploy: async ({ deployedContract }) => {
    await grantRoleIfNotGranted(deployedContract, "CONTROLLER");
    await grantRoleIfNotGranted(deployedContract, "FEE_KEEPER");
  },
  // FeeDistributor should not be automatically re-deployed as the
  // new FeeDistributor would not be whitelisted for bridging GMX tokens
  // if a new FeeDistributor is deployed, action is required to whitelist it
  // after deployment
  id: "FeeDistributor_1",
});

func.skip = async (hre) => {
  if (["botanix", "avalancheFuji", "arbitrumSepolia"].includes(hre.network.name)) {
    return true;
  }

  return false;
};

export default func;
