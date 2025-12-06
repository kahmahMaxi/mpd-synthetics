// --- MPD Integration Start ---
/**
 * @title Dry Run MPD Integration
 * @notice Simulates deployment with MPD token addresses without on-chain actions
 * @dev Run with: npx ts-node scripts/dry-run-integrate-mpd.ts
 *
 * This script:
 * 1. Loads deploy-config.mpd.json
 * 2. Validates all MPD addresses
 * 3. Prints what each deploy step would do
 * 4. Outputs a checklist of on-chain actions
 * 5. Exits with code 0 (no on-chain actions)
 */

import * as fs from "fs";
import * as path from "path";

// Types (matching generate-deploy-config-with-mpd.ts)
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
  deploymentOrder: DeployStep[];
}

interface TokenInfo {
  symbol: string;
  address: string;
  description: string;
}

interface DeployStep {
  contractName: string;
  dependencies: string[];
  tokenSubstitutions: TokenSubstitution[];
  roles: string[];
}

interface TokenSubstitution {
  field: string;
  originalKey: string;
  mpdKey: string;
  mpdAddress: string;
}

// Constants
const CONFIG_PATH = path.resolve(__dirname, "..", "config", "deploy-config.mpd.json");

// ANSI colors for terminal output
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

// Main function
async function main() {
  header("MPD DEX DEPLOYMENT DRY-RUN");
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

  // Step 2: Validate MPD addresses
  subheader("VALIDATION");

  const validationResults: { field: string; valid: boolean; value: string }[] = [];

  // Check governance token
  validationResults.push({
    field: "MPD Token (governanceToken)",
    valid: isValidAddress(config.tokens.governanceToken.address),
    value: config.tokens.governanceToken.address,
  });

  // Check escrowed token
  validationResults.push({
    field: "esMPD Token (escrowedToken)",
    valid: isValidAddress(config.tokens.escrowedToken.address),
    value: config.tokens.escrowedToken.address,
  });

  // Check vester
  validationResults.push({
    field: "Vester Contract",
    valid: isValidAddress(config.tokens.vester.address),
    value: config.tokens.vester.address,
  });

  let allValid = true;
  for (const result of validationResults) {
    if (result.valid) {
      log(`   ✅ ${result.field}`, colors.green);
      log(`      ${result.value}`, colors.dim);
    } else {
      log(`   ❌ ${result.field}: INVALID or EMPTY`, colors.red);
      allValid = false;
    }
  }

  if (!allValid) {
    log("\n❌ Validation failed. Please ensure all MPD addresses are configured.", colors.red);
    process.exit(1);
  }

  log("\n   All validations passed! ✓", colors.green);

  // Step 3: Print deployment configuration
  subheader("DEPLOYMENT CONFIGURATION");

  log(`   Network: ${config.network}`, colors.blue);
  log(`   Generated: ${config.generatedAt}`, colors.dim);
  log(`   Source: ${config.source}`, colors.dim);
  log(`   Vesting Duration: ${config.parameters.vestingDuration} seconds (${Math.floor(config.parameters.vestingDuration / 86400)} days)`, colors.blue);
  if (config.parameters.deployer) {
    log(`   Deployer: ${config.parameters.deployer}`, colors.blue);
  }

  // Step 4: Print deployment steps
  subheader("DEPLOYMENT STEPS (DRY-RUN)");

  for (let i = 0; i < config.deploymentOrder.length; i++) {
    const step = config.deploymentOrder[i];
    const stepNum = String(i + 1).padStart(2, "0");

    console.log();
    log(`${colors.bright}[Step ${stepNum}] ${step.contractName}${colors.reset}`);

    // Dependencies
    if (step.dependencies.length > 0) {
      log(`   Dependencies: ${step.dependencies.join(", ")}`, colors.dim);
    } else {
      log(`   Dependencies: (none)`, colors.dim);
    }

    // Constructor args with token substitutions
    if (step.tokenSubstitutions.length > 0) {
      log(`   ${colors.magenta}Token Substitutions:${colors.reset}`);
      for (const sub of step.tokenSubstitutions) {
        log(`      • ${sub.field}: ${sub.originalKey} → ${sub.mpdKey}`, colors.yellow);
        log(`        Address: ${sub.mpdAddress}`, colors.dim);
      }
    }

    // Roles to be granted
    if (step.roles.length > 0) {
      log(`   Roles to grant: ${step.roles.join(", ")}`, colors.cyan);
    }

    // Simulated constructor args
    const constructorArgs = buildConstructorArgs(step, config);
    if (constructorArgs.length > 0) {
      log(`   Constructor Args (simulated):`, colors.blue);
      for (const arg of constructorArgs) {
        log(`      ${arg}`, colors.dim);
      }
    }
  }

  // Step 5: Print on-chain action checklist
  subheader("ON-CHAIN ACTIONS CHECKLIST");

  const actions = buildActionChecklist(config);
  for (let i = 0; i < actions.length; i++) {
    log(`   ${String(i + 1).padStart(2, "0")}. ${actions[i]}`, colors.blue);
  }

  // Step 6: Summary
  header("DRY-RUN COMPLETE");

  log("\n📋 Summary:", colors.bright);
  log(`   • Total deployment steps: ${config.deploymentOrder.length}`, colors.green);
  log(`   • Contracts with MPD substitutions: ${config.deploymentOrder.filter(s => s.tokenSubstitutions.length > 0).length}`, colors.green);
  log(`   • Total roles to configure: ${countTotalRoles(config)}`, colors.green);
  log(`   • Network: ${config.network}`, colors.green);

  log("\n⚠️  IMPORTANT:", colors.yellow);
  log("   This was a DRY-RUN. No on-chain actions were performed.", colors.dim);
  log("   To deploy, use: npx hardhat deploy --network <network>", colors.dim);

  log("\n✅ Dry-run completed successfully with exit code 0\n", colors.green);

  process.exit(0);
}

/**
 * Check if address is valid (non-empty, starts with 0x, correct length)
 */
function isValidAddress(address: string): boolean {
  if (!address || address.trim() === "") return false;
  if (!address.startsWith("0x")) return false;
  if (address.length !== 42) return false;
  return true;
}

/**
 * Build simulated constructor arguments for a deploy step
 */
function buildConstructorArgs(step: DeployStep, config: DeployConfigMPD): string[] {
  const args: string[] = [];

  // Add dependency addresses (simulated)
  for (const dep of step.dependencies) {
    args.push(`${dep}: <deployed_address>`);
  }

  // Add token substitutions
  for (const sub of step.tokenSubstitutions) {
    args.push(`${sub.field}: ${sub.mpdAddress} (${sub.mpdKey})`);
  }

  return args;
}

/**
 * Build the checklist of on-chain actions
 */
function buildActionChecklist(config: DeployConfigMPD): string[] {
  const actions: string[] = [];

  // Deploy actions
  actions.push("Deploy RoleStore contract");
  actions.push("Deploy DataStore contract");
  actions.push("Deploy EventEmitter contract");

  // Grant admin roles
  actions.push("Grant ADMIN role to deployer");
  actions.push("Grant CONTROLLER role to Config contract");

  // Deploy vaults
  actions.push("Deploy DepositVault, WithdrawalVault, OrderVault");
  actions.push("Deploy FeeDistributorVault");

  // Oracle setup
  actions.push("Deploy Oracle with OracleStore");
  actions.push("Configure oracle signers");

  // Market infrastructure
  actions.push("Deploy MarketFactory");
  actions.push("Create initial markets (ETH/USD, BTC/USD, etc.)");

  // Handlers
  actions.push("Deploy DepositHandler, WithdrawalHandler, OrderHandler");
  actions.push("Grant CONTROLLER roles to handlers");

  // Fee system with MPD
  actions.push("Deploy FeeHandler");
  actions.push(`Deploy FeeDistributor with MPD token: ${config.tokens.governanceToken.address}`);
  actions.push(`  └─ GMX address replaced with MPD: ${config.tokens.governanceToken.address}`);
  actions.push(`  └─ esGMX address replaced with esMPD: ${config.tokens.escrowedToken.address}`);
  actions.push("Grant FEE_KEEPER role to FeeDistributor");

  // Router
  actions.push("Deploy ExchangeRouter");
  actions.push("Grant ROUTER_PLUGIN role");

  // GLV
  actions.push("Deploy GlvFactory and GlvRouter");
  actions.push("Grant GLV_KEEPER role");

  // Final setup
  actions.push("Configure initial market parameters");
  actions.push("Register Vester contract: " + config.tokens.vester.address);
  actions.push("Set vesting duration: " + config.parameters.vestingDuration + " seconds");

  return actions;
}

/**
 * Count total unique roles across all steps
 */
function countTotalRoles(config: DeployConfigMPD): number {
  const allRoles = new Set<string>();
  for (const step of config.deploymentOrder) {
    for (const role of step.roles) {
      allRoles.add(role);
    }
  }
  return allRoles.size;
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
// --- MPD Integration End ---

