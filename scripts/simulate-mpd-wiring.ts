// --- MPD Integration Start ---
/**
 * @title Simulate MPD Wiring
 * @notice Simulates DataStore writes and displays expected MPD token → reward component wiring
 * @dev Run with: npx ts-node scripts/simulate-mpd-wiring.ts
 *
 * This script:
 * 1. Loads deploy-config.mpd.json
 * 2. Simulates DataStore writes
 * 3. Logs expected MPD token → reward component wiring
 * 4. Outputs a clear table showing token usage
 * 5. No on-chain deploy
 */

import * as fs from "fs";
import * as path from "path";

// Types (matching generate-deploy-config-with-mpd.ts)
interface DataStoreInjection {
  type: "SET_ADDRESS" | "SET_UINT";
  key: string;
  keyHash: string;
  value: string | number;
  description: string;
}

interface TokenInfo {
  symbol: string;
  address: string;
  description: string;
}

interface DeployConfigMPD {
  source: string;
  generatedAt: string;
  network: string;
  tokens: {
    governanceToken: TokenInfo;
    escrowedToken: TokenInfo;
    vester: TokenInfo;
  };
  parameters: {
    vestingDuration: number;
    deployer: string;
  };
  dataStoreInjections: DataStoreInjection[];
  deploymentOrder: any[];
}

// Constants
const CONFIG_PATH = path.resolve(__dirname, "..", "config", "deploy-config.mpd.json");

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
  const line = "═".repeat(70);
  console.log("\n" + colors.cyan + line);
  console.log(" " + title);
  console.log(line + colors.reset);
}

function subheader(title: string) {
  console.log("\n" + colors.yellow + "─".repeat(50));
  console.log(" " + title);
  console.log("─".repeat(50) + colors.reset);
}

// Simulated DataStore
class SimulatedDataStore {
  private addressStore: Map<string, string> = new Map();
  private uintStore: Map<string, number> = new Map();

  setAddress(key: string, value: string): void {
    this.addressStore.set(key, value);
    log(`   [SET_ADDRESS] ${key} = ${value}`, colors.green);
  }

  setUint(key: string, value: number): void {
    this.uintStore.set(key, value);
    log(`   [SET_UINT] ${key} = ${value}`, colors.green);
  }

  getAddress(key: string): string | undefined {
    return this.addressStore.get(key);
  }

  getUint(key: string): number | undefined {
    return this.uintStore.get(key);
  }

  getAllAddresses(): Map<string, string> {
    return this.addressStore;
  }

  getAllUints(): Map<string, number> {
    return this.uintStore;
  }
}

// Main function
async function main() {
  header("MPD TOKEN WIRING SIMULATION");
  log("This is a simulation - no on-chain actions will be performed.\n", colors.dim);

  // Step 1: Load deploy config
  log("📂 Loading deploy config from:", colors.blue);
  log(`   ${CONFIG_PATH}`, colors.dim);

  if (!fs.existsSync(CONFIG_PATH)) {
    log("\n❌ ERROR: Deploy config not found!", colors.red);
    log("   Please run generate-deploy-config-with-mpd.ts first.", colors.dim);
    process.exit(1);
  }

  let config: DeployConfigMPD;
  try {
    const configRaw = fs.readFileSync(CONFIG_PATH, "utf8");
    config = JSON.parse(configRaw);
  } catch (error) {
    log(`\n❌ ERROR: Failed to parse config: ${error}`, colors.red);
    process.exit(1);
  }

  // Step 2: Validate configuration
  subheader("CONFIGURATION VALIDATION");

  const mpdToken = config.tokens.governanceToken.address;
  const esMpdToken = config.tokens.escrowedToken.address;
  const vester = config.tokens.vester.address;

  if (!mpdToken || !esMpdToken || !vester) {
    log("❌ Missing token addresses in configuration", colors.red);
    process.exit(1);
  }

  log(`   ✅ MPD Token: ${mpdToken}`, colors.green);
  log(`   ✅ esMPD Token: ${esMpdToken}`, colors.green);
  log(`   ✅ Vester: ${vester}`, colors.green);
  log(`   ✅ Vesting Duration: ${config.parameters.vestingDuration}s`, colors.green);

  // Step 3: Simulate DataStore writes
  subheader("SIMULATING DATASTORE WRITES");

  const dataStore = new SimulatedDataStore();

  for (const injection of config.dataStoreInjections) {
    if (injection.type === "SET_ADDRESS") {
      dataStore.setAddress(injection.key, injection.value as string);
    } else if (injection.type === "SET_UINT") {
      dataStore.setUint(injection.key, injection.value as number);
    }
  }

  // Step 4: Display token wiring table
  subheader("MPD TOKEN → REWARD COMPONENT WIRING");

  console.log();
  log("┌────────────────────────────┬────────────────────────────────────────────────┐", colors.cyan);
  log("│ Component                  │ Token Used                                     │", colors.cyan);
  log("├────────────────────────────┼────────────────────────────────────────────────┤", colors.cyan);

  const wiringTable = [
    { component: "FeeDistributor", token: "MPD / esMPD", addresses: `${shortenAddr(mpdToken)} / ${shortenAddr(esMpdToken)}` },
    { component: "RewardDistributor", token: "MPD", addresses: shortenAddr(mpdToken) },
    { component: "RewardRouter", token: "MPD / esMPD / Vester", addresses: `${shortenAddr(mpdToken)} / ${shortenAddr(esMpdToken)} / ${shortenAddr(vester)}` },
    { component: "Vester", token: "esMPD → MPD", addresses: `${shortenAddr(esMpdToken)} → ${shortenAddr(mpdToken)}` },
    { component: "RewardTracker", token: "MPD (staking)", addresses: shortenAddr(mpdToken) },
    { component: "ExtendedMpdTracker", token: "MPD (fees)", addresses: shortenAddr(mpdToken) },
  ];

  for (const row of wiringTable) {
    const compPadded = row.component.padEnd(26);
    const tokenPadded = `${row.token} (${row.addresses})`.padEnd(46);
    log(`│ ${compPadded} │ ${tokenPadded} │`, colors.reset);
  }

  log("└────────────────────────────┴────────────────────────────────────────────────┘", colors.cyan);

  // Step 5: Display DataStore state
  subheader("SIMULATED DATASTORE STATE");

  log("\n   📍 Address Entries:", colors.blue);
  for (const [key, value] of dataStore.getAllAddresses()) {
    log(`      ${key}: ${value}`, colors.dim);
  }

  log("\n   📊 Uint Entries:", colors.blue);
  for (const [key, value] of dataStore.getAllUints()) {
    log(`      ${key}: ${value}`, colors.dim);
  }

  // Step 6: Display substitution summary
  subheader("TOKEN SUBSTITUTION SUMMARY");

  log("\n   GMX → MPD Substitutions in Contracts:", colors.magenta);
  log("   ┌─────────────────────────────────────────────────────────────────────┐", colors.dim);
  log("   │ Location                        │ Original    │ MPD Replacement     │", colors.dim);
  log("   ├─────────────────────────────────┼─────────────┼─────────────────────┤", colors.dim);
  log("   │ FeeDistributor constructor      │ _gmx        │ MPDToken address    │", colors.dim);
  log("   │ FeeDistributor constructor      │ _esGmx      │ esMPD address       │", colors.dim);
  log("   │ DataStore key                   │ GMX_TOKEN   │ MPD_TOKEN           │", colors.dim);
  log("   │ DataStore key                   │ ES_GMX_TOKEN│ ES_MPD_TOKEN        │", colors.dim);
  log("   │ DataStore key                   │ ESGMX_VESTER│ MPD_VESTER          │", colors.dim);
  log("   └─────────────────────────────────┴─────────────┴─────────────────────┘", colors.dim);

  // Step 7: Next steps checklist
  subheader("DEPLOYMENT CHECKLIST");

  const checklist = [
    "✓ Deploy MPDToken, esMPD, Vester contracts (mpd-token repo)",
    "✓ Generate tokens.mpd.json with deployed addresses",
    "✓ Generate deploy-config.mpd.json with DataStore injections",
    "○ Deploy gmx-synthetics contracts with --mpdConfig flag",
    "○ Write DataStore injections (MPD_TOKEN, ES_MPD_TOKEN, MPD_VESTER)",
    "○ Configure FeeDistributor with MPD/esMPD addresses",
    "○ Set up ExtendedMpdTracker for staking rewards",
    "○ Verify token wiring in test environment",
  ];

  for (const item of checklist) {
    const color = item.startsWith("✓") ? colors.green : colors.yellow;
    log(`   ${item}`, color);
  }

  // Summary
  header("SIMULATION COMPLETE");

  log("\n📋 Summary:", colors.bright);
  log(`   • Network: ${config.network}`, colors.green);
  log(`   • DataStore Injections: ${config.dataStoreInjections.length}`, colors.green);
  log(`   • Contracts with MPD substitutions: 1 (FeeDistributor)`, colors.green);

  log("\n⚠️  IMPORTANT:", colors.yellow);
  log("   This was a SIMULATION. No on-chain actions were performed.", colors.dim);
  log("   To deploy, run: npx hardhat deploy --network <network> --mpdConfig config/deploy-config.mpd.json", colors.dim);

  log("\n✅ Simulation completed successfully with exit code 0\n", colors.green);

  process.exit(0);
}

/**
 * Shorten an address for display
 */
function shortenAddr(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
// --- MPD Integration End ---

