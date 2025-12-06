// --- MPD Integration Start ---
/**
 * @title Validate MPD Wiring
 * @notice Validates that MPD tokens are correctly wired into the protocol
 * @dev Run with: npx hardhat run scripts/validate-mpd-wiring.ts --network localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";

interface ValidationResult {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
}

async function main() {
  console.log("═".repeat(70));
  console.log(" STEP 6: VALIDATION CHECKS");
  console.log("═".repeat(70));

  const [deployer, testUser] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Load deploy config
  const configPath = path.resolve(__dirname, "..", "config", "deploy-config.mpd.json");
  const deployConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Load mpd-token deployments
  const mpdDeploymentsPath = path.resolve(__dirname, "..", "..", "mpd-token", "deployments", "localhost.json");
  const mpdDeployments = JSON.parse(fs.readFileSync(mpdDeploymentsPath, "utf8"));

  console.log("\n📋 Expected MPD Addresses:");
  console.log("   MPDToken:", mpdDeployments.MPDToken);
  console.log("   esMPD:", mpdDeployments.esMPD);
  console.log("   Vester:", mpdDeployments.Vester);

  // Get DataStore contract
  const dataStoreDeployment = await hre.deployments.get("DataStore");
  const dataStore = await hre.ethers.getContractAt("DataStore", dataStoreDeployment.address);
  console.log("\n✅ DataStore at:", dataStore.address);

  const validationResults: ValidationResult[] = [];

  // Validation 1: DataStore entries
  console.log("\n" + "─".repeat(70));
  console.log(" DATASTORE VALIDATIONS");
  console.log("─".repeat(70));

  const keysToValidate = [
    { key: "MPD_TOKEN", expected: mpdDeployments.MPDToken },
    { key: "ES_MPD_TOKEN", expected: mpdDeployments.esMPD },
    { key: "MPD_VESTER", expected: mpdDeployments.Vester },
    { key: "MPD_VESTING_DURATION", expected: "31536000" },
  ];

  for (const { key, expected } of keysToValidate) {
    const keyHash = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], [key])
    );

    try {
      let actual: string;
      if (key === "MPD_VESTING_DURATION") {
        const value = await dataStore.getUint(keyHash);
        actual = value.toString();
      } else {
        actual = await dataStore.getAddress(keyHash);
      }

      const passed = actual.toLowerCase() === expected.toLowerCase();
      validationResults.push({ check: `DataStore.${key}`, expected, actual, passed });
      console.log(`   ${passed ? "✅" : "❌"} ${key}`);
      console.log(`      Expected: ${expected}`);
      console.log(`      Actual:   ${actual}`);
    } catch (e: any) {
      validationResults.push({ check: `DataStore.${key}`, expected, actual: "ERROR", passed: false });
      console.log(`   ❌ ${key}: Error reading - ${e.message}`);
    }
  }

  // Validation 2: Vester Configuration
  console.log("\n" + "─".repeat(70));
  console.log(" VESTER VALIDATIONS");
  console.log("─".repeat(70));

  const vesterAbi = [
    "function mpd() view returns (address)",
    "function esMpd() view returns (address)",
    "function vestingDuration() view returns (uint256)",
    "function owner() view returns (address)",
  ];

  try {
    const vester = new hre.ethers.Contract(mpdDeployments.Vester, vesterAbi, deployer);
    
    const storedMpd = await vester.mpd();
    const storedEsMpd = await vester.esMpd();
    const duration = await vester.vestingDuration();
    const owner = await vester.owner();

    const mpdMatch = storedMpd.toLowerCase() === mpdDeployments.MPDToken.toLowerCase();
    const esMpdMatch = storedEsMpd.toLowerCase() === mpdDeployments.esMPD.toLowerCase();
    const durationMatch = duration.eq(31536000);

    validationResults.push({ check: "Vester.mpd()", expected: mpdDeployments.MPDToken, actual: storedMpd, passed: mpdMatch });
    validationResults.push({ check: "Vester.esMpd()", expected: mpdDeployments.esMPD, actual: storedEsMpd, passed: esMpdMatch });
    validationResults.push({ check: "Vester.vestingDuration()", expected: "31536000", actual: duration.toString(), passed: durationMatch });

    console.log(`   ${mpdMatch ? "✅" : "❌"} Vester.mpd(): ${storedMpd}`);
    console.log(`   ${esMpdMatch ? "✅" : "❌"} Vester.esMpd(): ${storedEsMpd}`);
    console.log(`   ${durationMatch ? "✅" : "❌"} Vester.vestingDuration(): ${duration.toString()}`);
    console.log(`   ℹ️  Vester.owner(): ${owner}`);
  } catch (e: any) {
    console.log(`   ❌ Error reading Vester: ${e.message}`);
  }

  // Validation 3: MPD Token Configuration
  console.log("\n" + "─".repeat(70));
  console.log(" MPD TOKEN VALIDATIONS");
  console.log("─".repeat(70));

  const mpdTokenAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function owner() view returns (address)",
  ];

  const esMpdAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function owner() view returns (address)",
    "function isMinter(address) view returns (bool)",
  ];

  try {
    const mpdToken = new hre.ethers.Contract(mpdDeployments.MPDToken, mpdTokenAbi, deployer);
    const esMpd = new hre.ethers.Contract(mpdDeployments.esMPD, esMpdAbi, deployer);

    const mpdName = await mpdToken.name();
    const mpdSymbol = await mpdToken.symbol();
    const mpdDecimals = await mpdToken.decimals();

    const esMpdName = await esMpd.name();
    const esMpdSymbol = await esMpd.symbol();
    const esMpdDecimals = await esMpd.decimals();

    // Check if Vester is a minter for esMPD
    const vesterIsMinter = await esMpd.isMinter(mpdDeployments.Vester);

    console.log(`   ✅ MPD Token name: ${mpdName}`);
    console.log(`   ✅ MPD Token symbol: ${mpdSymbol}`);
    console.log(`   ✅ MPD Token decimals: ${mpdDecimals}`);
    console.log(`   ✅ esMPD name: ${esMpdName}`);
    console.log(`   ✅ esMPD symbol: ${esMpdSymbol}`);
    console.log(`   ✅ esMPD decimals: ${esMpdDecimals}`);
    console.log(`   ${vesterIsMinter ? "✅" : "❌"} Vester is esMPD minter: ${vesterIsMinter}`);

    validationResults.push({ check: "MPD.name()", expected: "MPD Token", actual: mpdName, passed: mpdName === "MPD Token" });
    validationResults.push({ check: "esMPD.name()", expected: "Escrowed MPD", actual: esMpdName, passed: esMpdName === "Escrowed MPD" });
    validationResults.push({ check: "Vester is esMPD minter", expected: "true", actual: vesterIsMinter.toString(), passed: vesterIsMinter });
  } catch (e: any) {
    console.log(`   ❌ Error reading tokens: ${e.message}`);
  }

  // Summary
  console.log("\n" + "═".repeat(70));
  console.log(" VALIDATION SUMMARY");
  console.log("═".repeat(70));

  const passCount = validationResults.filter(r => r.passed).length;
  const failCount = validationResults.filter(r => !r.passed).length;

  console.log(`\n   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (failCount > 0) {
    console.log("\n⚠️ Failed Checks:");
    validationResults.filter(r => !r.passed).forEach(r => {
      console.log(`   • ${r.check}`);
      console.log(`     Expected: ${r.expected}`);
      console.log(`     Actual:   ${r.actual}`);
    });
  }

  console.log("\n" + "═".repeat(70));
  
  if (failCount > 0) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
// --- MPD Integration End ---

