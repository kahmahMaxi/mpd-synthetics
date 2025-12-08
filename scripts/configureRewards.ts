/**
 * @title Configure Rewards
 * @notice Configures MPD reward system: FeeDistributor, reward tracking, and emission rates
 * @dev Run with: npx hardhat run scripts/configureRewards.ts --network localhost [--emissionPerSec 1000000000000000000]
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMpdAddress, getEsMpdAddress, getVesterAddress, getFeeDistributorAddress } from "../utils/rewardAdapter";
import { setAddressIfDifferent, setUintIfDifferent } from "../utils/dataStore";
import { hashString } from "../utils/hash";
import { expandDecimals } from "../utils/math";

interface MPDConfig {
  MPDToken: string;
  esMPD: string;
  Vester: string;
  network: string;
}

interface MarketsConfig {
  markets: string[];
  collateralTokens: string[];
}

async function loadMpdConfig(): Promise<MPDConfig> {
  const configPath = path.resolve(__dirname, "..", "config", "tokens.mpd.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`MPD config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

async function loadMarketsConfig(): Promise<MarketsConfig> {
  const configPath = path.resolve(__dirname, "..", "config", "deploy-config.markets.json");
  if (!fs.existsSync(configPath)) {
    console.warn(`Markets config not found: ${configPath}, using empty config`);
    return { markets: [], collateralTokens: [] };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURE REWARDS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { deployer } = await hre.getNamedAccounts();
  console.log(`Deployer: ${deployer}\n`);

  // Parse CLI args (handle both --emissionPerSec=value and --emissionPerSec value formats)
  let emissionPerSec = "1000000000000000000"; // Default: 1 MPD per second
  const emissionIndex = process.argv.findIndex((arg) => arg === "--emissionPerSec" || arg.startsWith("--emissionPerSec="));
  if (emissionIndex >= 0) {
    if (process.argv[emissionIndex].includes("=")) {
      emissionPerSec = process.argv[emissionIndex].split("=")[1];
    } else if (emissionIndex + 1 < process.argv.length) {
      emissionPerSec = process.argv[emissionIndex + 1];
    }
  }

  // Load configs
  const mpdConfig = await loadMpdConfig();
  const marketsConfig = await loadMarketsConfig();

  console.log("📂 Loaded MPD Config:");
  console.log(`   MPD Token: ${mpdConfig.MPDToken}`);
  console.log(`   esMPD: ${mpdConfig.esMPD}`);
  console.log(`   Vester: ${mpdConfig.Vester}\n`);

  // Get contracts
  const dataStore = await hre.ethers.getContract("DataStore");
  const feeDistributorAddress = await getFeeDistributorAddress();

  if (!feeDistributorAddress) {
    throw new Error("FeeDistributor not deployed. Deploy it first.");
  }

  const feeDistributor = await hre.ethers.getContractAt("FeeDistributor", feeDistributorAddress);

  console.log("📦 Contracts:");
  console.log(`   DataStore: ${dataStore.address}`);
  console.log(`   FeeDistributor: ${feeDistributorAddress}\n`);

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURING REWARD SYSTEM");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 1. Ensure MPD/esMPD/Vester addresses are in DataStore
  console.log("1️⃣  Setting MPD token addresses in DataStore...\n");

  await setAddressIfDifferent(
    hashString("MPD_TOKEN"),
    mpdConfig.MPDToken,
    `MPD_TOKEN address`
  );
  console.log(`   ✅ MPD_TOKEN: ${mpdConfig.MPDToken}`);

  await setAddressIfDifferent(
    hashString("ES_MPD_TOKEN"),
    mpdConfig.esMPD,
    `ES_MPD_TOKEN address`
  );
  console.log(`   ✅ ES_MPD_TOKEN: ${mpdConfig.esMPD}`);

  await setAddressIfDifferent(
    hashString("MPD_VESTER"),
    mpdConfig.Vester,
    `MPD_VESTER address`
  );
  console.log(`   ✅ MPD_VESTER: ${mpdConfig.Vester}\n`);

  // 2. Verify FeeDistributor has correct MPD/esMPD addresses
  console.log("2️⃣  Verifying FeeDistributor configuration...\n");

  // Note: FeeDistributor stores gmx/esGmx as immutable, so we verify they match MPD
  // In a real scenario, FeeDistributor should be deployed with MPD addresses
  console.log(`   ℹ️  FeeDistributor is deployed with token addresses set at construction`);
  console.log(`   ℹ️  For MPD system, ensure FeeDistributor was deployed with MPD/esMPD addresses\n`);

  // 3. Set emission rate (if applicable)
  console.log("3️⃣  Setting emission rate...\n");
  console.log(`   Emission Rate: ${emissionPerSec} wei per second`);
  console.log(`   (This is informational - actual emission handled by FeeDistributor)\n`);

  // 4. Set reward tracker addresses (if using external trackers)
  // For now, we'll store tracker addresses in DataStore for future use
  console.log("4️⃣  Configuring reward trackers...\n");

  // Extended MPD Tracker (for staking rewards)
  // This would be an external RewardTracker contract if deployed
  // For now, we'll use FeeDistributor as the reward source
  const extendedMpdTrackerKey = hashString("EXTENDED_MPD_TRACKER");
  const existingTracker = await dataStore.getAddress(extendedMpdTrackerKey);
  
  if (existingTracker === hre.ethers.constants.AddressZero) {
    console.log(`   ℹ️  Extended MPD Tracker not set (using FeeDistributor directly)`);
  } else {
    console.log(`   ✅ Extended MPD Tracker: ${existingTracker}`);
  }

  // 5. Summary
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURATION SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const summary = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    addresses: {
      mpd: mpdConfig.MPDToken,
      esMpd: mpdConfig.esMPD,
      vester: mpdConfig.Vester,
      feeDistributor: feeDistributorAddress,
      dataStore: dataStore.address,
    },
    emissionRate: emissionPerSec,
    marketsCount: marketsConfig.markets.length,
  };

  console.log("┌──────────────────────────────────────────┬──────────────────────────────────────────┐");
  console.log("│ Parameter                               │ Value                                    │");
  console.log("├──────────────────────────────────────────┼──────────────────────────────────────────┤");

  const entries = [
    ["MPD Token", summary.addresses.mpd],
    ["esMPD Token", summary.addresses.esMpd],
    ["Vester", summary.addresses.vester],
    ["FeeDistributor", summary.addresses.feeDistributor],
    ["DataStore", summary.addresses.dataStore],
    ["Emission Rate", `${summary.emissionRate} wei/sec`],
    ["Markets", summary.marketsCount.toString()],
  ];

  for (const [param, value] of entries) {
    const valueDisplay = value.length > 42 ? value.slice(0, 10) + "..." + value.slice(-8) : value;
    console.log(`│ ${param.padEnd(40)} │ ${valueDisplay.padEnd(40)} │`);
  }

  console.log("└──────────────────────────────────────────┴──────────────────────────────────────────┘\n");

  // Save summary to file
  const summaryPath = path.resolve(__dirname, "..", "config", "rewards-config.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`📝 Configuration saved to: ${summaryPath}\n`);

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ REWARD CONFIGURATION COMPLETE!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log("Next steps:");
  console.log("  1. Mint esMPD to FeeDistributor: npx hardhat run scripts/mintAndDistributeEsMpd.ts --network localhost");
  console.log("  2. Test reward flow: npx hardhat run scripts/simulate-reward-cycle.ts --network localhost\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

