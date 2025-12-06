// --- MPD Integration Start ---
/**
 * @title Generate Deploy Config with MPD
 * @notice Generates a deploy configuration JSON with MPD token addresses
 * @dev Run with: npx ts-node scripts/generate-deploy-config-with-mpd.ts
 *
 * This script:
 * 1. Reads config/tokens.mpd.json
 * 2. Validates that all MPD addresses are present
 * 3. Generates deploy-config.mpd.json with token fields replaced
 */

import * as fs from "fs";
import * as path from "path";

// Types
interface MPDConfig {
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

interface DataStoreInjection {
  type: "SET_ADDRESS" | "SET_UINT";
  key: string;
  keyHash: string;
  value: string | number;
  description: string;
}

interface DeployConfigMPD {
  // Source information
  source: string;
  generatedAt: string;
  network: string;

  // Token addresses (MPD system replaces GMX)
  tokens: {
    governanceToken: {
      symbol: string;
      address: string;
      description: string;
    };
    escrowedToken: {
      symbol: string;
      address: string;
      description: string;
    };
    vester: {
      symbol: string;
      address: string;
      description: string;
    };
  };

  // Deployment parameters
  parameters: {
    vestingDuration: number;
    deployer: string;
  };

  // DataStore injections for MPD token addresses
  dataStoreInjections: DataStoreInjection[];

  // Contract deployment order and config
  deploymentOrder: DeployStep[];
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
const CONFIG_PATH = path.resolve(__dirname, "..", "config", "tokens.mpd.json");
const OUTPUT_PATH = path.resolve(__dirname, "..", "config", "deploy-config.mpd.json");
const MPD_TOKEN_DEPLOYMENTS_PATH = path.resolve(__dirname, "..", "..", "mpd-token", "deployments", "local.json");

// Main function
async function main() {
  console.log("=".repeat(70));
  console.log("MPD Deploy Config Generator");
  console.log("=".repeat(70));

  // Step 1: Read and validate tokens.mpd.json
  console.log("\n📂 Reading MPD config from:", CONFIG_PATH);

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`\n❌ ERROR: MPD config not found at ${CONFIG_PATH}`);
    console.error("   Please run generate-mpd-config.ts first to create it.");
    process.exit(1);
  }

  let mpdConfig: MPDConfig;
  try {
    const configRaw = fs.readFileSync(CONFIG_PATH, "utf8");
    mpdConfig = JSON.parse(configRaw);
  } catch (error) {
    console.error(`\n❌ ERROR: Failed to parse MPD config: ${error}`);
    process.exit(1);
  }

  // Validate required fields
  console.log("\n🔍 Validating MPD addresses...");

  const requiredFields: (keyof MPDConfig)[] = ["MPDToken", "esMPD", "Vester"];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = mpdConfig[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    console.error("\n❌ ERROR: Missing or empty MPD addresses:");
    for (const field of missingFields) {
      console.error(`   - ${field}`);
    }
    console.error("\nPlease deploy MPD tokens first and run generate-mpd-config.ts");
    process.exit(1);
  }

  console.log("   ✅ MPDToken:", mpdConfig.MPDToken);
  console.log("   ✅ esMPD:", mpdConfig.esMPD);
  console.log("   ✅ Vester:", mpdConfig.Vester);

  // Step 2: Build deployment configuration
  console.log("\n📝 Building deploy configuration...");

  const deployConfig: DeployConfigMPD = {
    source: MPD_TOKEN_DEPLOYMENTS_PATH,
    generatedAt: new Date().toISOString(),
    network: mpdConfig.network || "localhost",

    tokens: {
      governanceToken: {
        symbol: "MPD",
        address: mpdConfig.MPDToken,
        description: "MPD governance token (replaces GMX)",
      },
      escrowedToken: {
        symbol: "esMPD",
        address: mpdConfig.esMPD,
        description: "Escrowed MPD token (replaces esGMX)",
      },
      vester: {
        symbol: "Vester",
        address: mpdConfig.Vester,
        description: "Vester contract for esMPD → MPD vesting",
      },
    },

    parameters: {
      vestingDuration: mpdConfig.vestingDuration || 31536000, // 365 days
      deployer: mpdConfig.deployer || "",
    },

    dataStoreInjections: buildDataStoreInjections(mpdConfig),

    deploymentOrder: buildDeploymentOrder(mpdConfig),
  };

  // Step 3: Write output
  console.log("\n💾 Writing deploy config to:", OUTPUT_PATH);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(deployConfig, null, 2));

  console.log("\n✅ Deploy config generated successfully!");
  console.log("\n📋 Summary:");
  console.log("   Network:", deployConfig.network);
  console.log("   MPD Token:", deployConfig.tokens.governanceToken.address);
  console.log("   esMPD Token:", deployConfig.tokens.escrowedToken.address);
  console.log("   Vester:", deployConfig.tokens.vester.address);
  console.log("   Vesting Duration:", deployConfig.parameters.vestingDuration, "seconds");
  console.log("   DataStore Injections:", deployConfig.dataStoreInjections.length);
  console.log("   Deployment Steps:", deployConfig.deploymentOrder.length);

  console.log("\n📦 DataStore Injections:");
  for (const injection of deployConfig.dataStoreInjections) {
    console.log(`   • ${injection.key}: ${injection.value}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("Next: Run dry-run-integrate-mpd.ts to preview deployment");
  console.log("=".repeat(70));
}

/**
 * Build DataStore injection tasks for MPD token addresses
 * These are written to DataStore during deployment to wire the reward system
 */
function buildDataStoreInjections(mpdConfig: MPDConfig): DataStoreInjection[] {
  return [
    {
      type: "SET_ADDRESS",
      key: "MPD_TOKEN",
      keyHash: "keccak256(abi.encode(\"MPD_TOKEN\"))",
      value: mpdConfig.MPDToken,
      description: "MPD governance token address (replaces GMX in reward system)",
    },
    {
      type: "SET_ADDRESS",
      key: "ES_MPD_TOKEN",
      keyHash: "keccak256(abi.encode(\"ES_MPD_TOKEN\"))",
      value: mpdConfig.esMPD,
      description: "Escrowed MPD token address (replaces esGMX in reward system)",
    },
    {
      type: "SET_ADDRESS",
      key: "MPD_VESTER",
      keyHash: "keccak256(abi.encode(\"MPD_VESTER\"))",
      value: mpdConfig.Vester,
      description: "MPD Vester contract address for esMPD → MPD vesting",
    },
    {
      type: "SET_UINT",
      key: "MPD_VESTING_DURATION",
      keyHash: "keccak256(abi.encode(\"MPD_VESTING_DURATION\"))",
      value: mpdConfig.vestingDuration || 31536000,
      description: "MPD vesting duration in seconds (default: 365 days)",
    },
  ];
}

/**
 * Build the deployment order with token substitutions
 */
function buildDeploymentOrder(mpdConfig: MPDConfig): DeployStep[] {
  return [
    // Core infrastructure (no token substitutions)
    {
      contractName: "RoleStore",
      dependencies: [],
      tokenSubstitutions: [],
      roles: ["ADMIN", "CONTROLLER"],
    },
    {
      contractName: "DataStore",
      dependencies: ["RoleStore"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },
    {
      contractName: "EventEmitter",
      dependencies: ["RoleStore"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },

    // Vaults
    {
      contractName: "DepositVault",
      dependencies: ["RoleStore"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },
    {
      contractName: "WithdrawalVault",
      dependencies: ["RoleStore"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },
    {
      contractName: "OrderVault",
      dependencies: ["RoleStore"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },
    {
      contractName: "FeeDistributorVault",
      dependencies: ["RoleStore"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },

    // Oracle
    {
      contractName: "Oracle",
      dependencies: ["RoleStore", "OracleStore"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },

    // Market infrastructure
    {
      contractName: "MarketFactory",
      dependencies: ["RoleStore", "DataStore", "EventEmitter"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER", "MARKET_KEEPER"],
    },

    // Handlers
    {
      contractName: "DepositHandler",
      dependencies: ["RoleStore", "DataStore", "EventEmitter", "DepositVault", "Oracle"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },
    {
      contractName: "WithdrawalHandler",
      dependencies: ["RoleStore", "DataStore", "EventEmitter", "WithdrawalVault", "Oracle"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },
    {
      contractName: "OrderHandler",
      dependencies: ["RoleStore", "DataStore", "EventEmitter", "OrderVault", "Oracle", "SwapHandler"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER"],
    },

    // Fee system (MPD token substitutions)
    {
      contractName: "FeeHandler",
      dependencies: ["RoleStore", "DataStore", "EventEmitter"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER", "FEE_KEEPER"],
    },
    {
      contractName: "FeeDistributor",
      dependencies: ["RoleStore", "DataStore", "EventEmitter", "FeeDistributorVault", "FeeHandler"],
      tokenSubstitutions: [
        {
          field: "gmxAddress",
          originalKey: "GMX",
          mpdKey: "MPDToken",
          mpdAddress: mpdConfig.MPDToken,
        },
        {
          field: "esGmxAddress",
          originalKey: "esGMX",
          mpdKey: "esMPD",
          mpdAddress: mpdConfig.esMPD,
        },
      ],
      roles: ["CONTROLLER", "FEE_KEEPER", "FEE_DISTRIBUTION_KEEPER"],
    },

    // Router
    {
      contractName: "ExchangeRouter",
      dependencies: [
        "Router",
        "RoleStore",
        "DataStore",
        "EventEmitter",
        "DepositHandler",
        "WithdrawalHandler",
        "OrderHandler",
      ],
      tokenSubstitutions: [],
      roles: ["CONTROLLER", "ROUTER_PLUGIN"],
    },

    // GLV (General Liquidity Vault)
    {
      contractName: "GlvFactory",
      dependencies: ["RoleStore", "DataStore", "EventEmitter"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER", "GLV_KEEPER"],
    },
    {
      contractName: "GlvRouter",
      dependencies: ["Router", "RoleStore", "DataStore", "EventEmitter", "GlvFactory"],
      tokenSubstitutions: [],
      roles: ["CONTROLLER", "ROUTER_PLUGIN"],
    },

    // Reader (no deployment, just verification)
    {
      contractName: "Reader",
      dependencies: [],
      tokenSubstitutions: [],
      roles: [],
    },
  ];
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
// --- MPD Integration End ---

