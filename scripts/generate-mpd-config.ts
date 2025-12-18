// --- MPD Integration Start ---
/**
 * @title MPD Token Config Generator (TypeScript)
 * @notice Generates tokens.mpd.json from mpd-token deployment files
 * @dev Run with: npx ts-node scripts/generate-mpd-config.ts [network]
 *
 * Examples:
 *   npx ts-node scripts/generate-mpd-config.ts local
 *   npx ts-node scripts/generate-mpd-config.ts localhost
 *   npx ts-node scripts/generate-mpd-config.ts arbitrumSepolia
 */

import * as fs from "fs";
import * as path from "path";
import { MPDConfigShape, DEFAULT_MPD_CONFIG } from "../config/tokens.mpd.constants";

// Get network from command line args (default: local)
const network: string = process.argv[2] || "local";

// Paths
const mpdTokenDeploymentsDir: string = path.join(__dirname, "..", "..", "mpd-token", "deployments");
const outputPath: string = path.join(__dirname, "..", "config", "tokens.mpd.json");

interface DeploymentData {
  MPDToken?: string;
  esMPD?: string;
  Vester?: string;
  deployer?: string;
  network?: string;
  timestamp?: string;
  vestingDuration?: number;
}

// Determine source file name
const sourceFileName = `${network}.json`;
const sourcePath: string = path.join(mpdTokenDeploymentsDir, sourceFileName);

console.log("=".repeat(60));
console.log("MPD Token Config Generator (TypeScript)");
console.log("=".repeat(60));
console.log("Network:", network);
console.log("Source: ", sourcePath);
console.log("Output: ", outputPath);
console.log("=".repeat(60));

// Check if source file exists
if (!fs.existsSync(sourcePath)) {
  console.error(`\n❌ Error: Source file not found: ${sourcePath}`);
  console.error(`\nAvailable deployment files:`);

  if (fs.existsSync(mpdTokenDeploymentsDir)) {
    const files: string[] = fs.readdirSync(mpdTokenDeploymentsDir).filter((f: string) => f.endsWith(".json"));
    files.forEach((f: string) => console.log(`   - ${f}`));
  } else {
    console.error(`   Deployments directory not found: ${mpdTokenDeploymentsDir}`);
  }

  process.exit(1);
}

// Read source deployment
console.log("\n📂 Reading deployment data...");
const deploymentRaw: string = fs.readFileSync(sourcePath, "utf8");
const deployment: DeploymentData = JSON.parse(deploymentRaw);

// Validate required fields
const requiredFields: (keyof DeploymentData)[] = ["MPDToken", "esMPD", "Vester"];
const warnings: string[] = [];

for (const field of requiredFields) {
  if (!deployment[field]) {
    console.warn(`\n⚠️  Warning: Missing field: ${field} - using empty string`);
    warnings.push(`Missing ${field}`);
  }
}

// Generate config
console.log("📝 Generating config...");
const config: MPDConfigShape = {
  network: deployment.network || network,
  MPDToken: deployment.MPDToken || "",
  esMPD: deployment.esMPD || "",
  Vester: deployment.Vester || "",
  deployer: deployment.deployer,
  timestamp: deployment.timestamp,
  vestingDuration: deployment.vestingDuration,
  addresses: {
    mpd: deployment.MPDToken || "",
    esMpd: deployment.esMPD || "",
    vester: deployment.Vester || "",
  },
  meta: {
    source: `../../mpd-token/deployments/${sourceFileName}`,
    generated: new Date().toISOString(),
  },
};

// Write output
fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

console.log("\n✅ Config generated successfully!");
if (warnings.length > 0) {
  console.log(`\n⚠️  Warnings: ${warnings.join(", ")}`);
}
console.log("\n📋 Contents:");
console.log(JSON.stringify(config, null, 2));
console.log("\n" + "=".repeat(60));

// --- MPD Integration End ---
