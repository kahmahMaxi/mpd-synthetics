/**
 * @title Register Index Oracle
 * @notice Registers IndexPriceFeed for IndexToken (DFI) in GMX V2 DataStore
 * @dev This script maps priceFeedKey(IndexToken) → IndexPriceFeed address
 *      Run with: npx hardhat run scripts/registerIndexOracle.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as keys from "../utils/keys";
import { setAddressIfDifferent } from "../utils/dataStore";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" REGISTER INDEX ORACLE");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // =====================================================
  // STEP 1: Load Deployed Contracts
  // =====================================================
  console.log("📦 Loading deployed contracts...\n");

  // Load DataStore
  let dataStore;
  try {
    dataStore = await get("DataStore");
    console.log(`✅ DataStore: ${dataStore.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load DataStore: ${error.message}`);
  }

  // Load IndexToken
  let indexToken;
  try {
    indexToken = await get("IndexToken");
    console.log(`✅ IndexToken: ${indexToken.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load IndexToken. Ensure it's deployed first. Error: ${error.message}`);
  }

  // Load IndexPriceFeed
  let indexPriceFeed;
  try {
    indexPriceFeed = await get("IndexPriceFeed");
    console.log(`✅ IndexPriceFeed: ${indexPriceFeed.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load IndexPriceFeed. Ensure it's deployed first. Error: ${error.message}`);
  }

  // =====================================================
  // STEP 2: Safety Checks
  // =====================================================
  console.log("\n🔍 Performing safety checks...\n");

  // Check for zero addresses
  if (!indexToken.address || indexToken.address === hre.ethers.constants.AddressZero) {
    throw new Error("❌ IndexToken address is zero");
  }
  console.log("✅ IndexToken address is valid");

  if (!indexPriceFeed.address || indexPriceFeed.address === hre.ethers.constants.AddressZero) {
    throw new Error("❌ IndexPriceFeed address is zero");
  }
  console.log("✅ IndexPriceFeed address is valid");

  // Check if mapping already exists
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  const priceFeedKey = keys.priceFeedKey(indexToken.address);
  const existingOracle = await dataStoreContract.getAddress(priceFeedKey);

  if (existingOracle && existingOracle !== hre.ethers.constants.AddressZero) {
    if (existingOracle.toLowerCase() === indexPriceFeed.address.toLowerCase()) {
      console.log(`⚠️  Oracle already registered with the same address: ${existingOracle}`);
      console.log("   Skipping registration.\n");
    } else {
      console.log(`⚠️  WARNING: Oracle already registered with different address!`);
      console.log(`   Existing: ${existingOracle}`);
      console.log(`   New:      ${indexPriceFeed.address}`);
      console.log(`   This will overwrite the existing mapping.\n`);
    }
  } else {
    console.log("✅ No existing oracle mapping found\n");
  }

  // =====================================================
  // STEP 3: Register Oracle in DataStore
  // =====================================================
  console.log("📝 Registering IndexPriceFeed in DataStore...\n");
  console.log(`   Token:        ${indexToken.address}`);
  console.log(`   Price Feed:   ${indexPriceFeed.address}`);
  console.log(`   Key:          ${priceFeedKey}\n`);

  try {
    await setAddressIfDifferent(
      priceFeedKey,
      indexPriceFeed.address,
      `price feed for IndexToken (DFI)`
    );
    console.log("✅ Oracle registered successfully!\n");
  } catch (error: any) {
    if (error.message.includes("permission") || error.message.includes("role")) {
      throw new Error(
        `❌ Permission denied. Ensure deployer (${deployer}) has CONTROLLER role in DataStore.\n` +
        `   Error: ${error.message}`
      );
    }
    throw new Error(`❌ Failed to register oracle: ${error.message}`);
  }

  // =====================================================
  // STEP 4: Verification
  // =====================================================
  console.log("🔍 Verifying registration...\n");

  const registeredOracle = await dataStoreContract.getAddress(priceFeedKey);
  const expectedOracle = indexPriceFeed.address.toLowerCase();
  const actualOracle = registeredOracle.toLowerCase();

  if (actualOracle === expectedOracle) {
    console.log(`✅ Verification successful!`);
    console.log(`   Registered oracle: ${registeredOracle}\n`);
  } else {
    throw new Error(
      `❌ Verification failed!\n` +
      `   Expected: ${expectedOracle}\n` +
      `   Got:      ${actualOracle}`
    );
  }

  // =====================================================
  // STEP 5: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" REGISTRATION SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ Oracle Registration                                               │");
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ IndexToken:     ${indexToken.address.padEnd(58)} │`);
  console.log(`│ IndexPriceFeed: ${indexPriceFeed.address.padEnd(58)} │`);
  console.log(`│ DataStore:      ${dataStore.address.padEnd(58)} │`);
  console.log(`│ Key:            ${priceFeedKey.padEnd(58)} │`);
  console.log("└────────────────────────────────────────────────────────────────────┘\n");

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ INDEX ORACLE REGISTRATION COMPLETE!");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📝 Next Steps:");
  console.log("   1. Verify oracle price using: npx hardhat run scripts/getOraclePrice.ts");
  console.log("   2. Create GMX market using IndexToken as indexToken");
  console.log("   3. Seed testnet liquidity\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

