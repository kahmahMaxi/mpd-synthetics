/**
 * @title MPD Token Config Generator
 * @notice Generates tokens.mpd.json from mpd-token deployment files
 * @dev Run with: node scripts/generate-mpd-config.js [network]
 * 
 * Examples:
 *   node scripts/generate-mpd-config.js local
 *   node scripts/generate-mpd-config.js localhost
 *   node scripts/generate-mpd-config.js arbitrumSepolia
 */

const fs = require("fs");
const path = require("path");

// Get network from command line args (default: local)
const network = process.argv[2] || "local";

// Paths
const mpdTokenDeploymentsDir = path.join(__dirname, "..", "..", "mpd-token", "deployments");
const outputPath = path.join(__dirname, "..", "config", "tokens.mpd.json");

// Determine source file name
const sourceFileName = `${network}.json`;
const sourcePath = path.join(mpdTokenDeploymentsDir, sourceFileName);

console.log("=".repeat(60));
console.log("MPD Token Config Generator");
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
    const files = fs.readdirSync(mpdTokenDeploymentsDir).filter(f => f.endsWith(".json"));
    files.forEach(f => console.log(`   - ${f}`));
  } else {
    console.error(`   Deployments directory not found: ${mpdTokenDeploymentsDir}`);
  }
  
  process.exit(1);
}

// Read source deployment
console.log("\n📂 Reading deployment data...");
const deployment = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

// Validate required fields
const requiredFields = ["MPDToken", "esMPD", "Vester"];
for (const field of requiredFields) {
  if (!deployment[field]) {
    console.error(`\n❌ Error: Missing required field: ${field}`);
    process.exit(1);
  }
}

// Generate config
console.log("📝 Generating config...");
const config = {
  network: deployment.network || network,
  MPDToken: deployment.MPDToken,
  esMPD: deployment.esMPD,
  Vester: deployment.Vester,
  addresses: {
    mpd: deployment.MPDToken,
    esMpd: deployment.esMPD,
    vester: deployment.Vester,
  },
  meta: {
    source: `../../mpd-token/deployments/${sourceFileName}`,
    generated: new Date().toISOString(),
  },
};

// Write output
fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

console.log("\n✅ Config generated successfully!");
console.log("\n📋 Contents:");
console.log(JSON.stringify(config, null, 2));
console.log("\n" + "=".repeat(60));

