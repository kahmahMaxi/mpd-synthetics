/**
 * @title Register USDC Price Feed
 * @notice Registers USDC Chainlink price feed in GMX V2 DataStore
 * @dev This script configures USDC price feed for ChainlinkPriceFeedProvider
 *      Run with: npx hardhat run scripts/registerUsdcPriceFeed.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as keys from "../utils/keys";
import { setAddressIfDifferent, setUintIfDifferent } from "../utils/dataStore";
import { expandDecimals, decimalToFloat } from "../utils/math";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" REGISTER USDC PRICE FEED");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // =====================================================
  // STEP 1: Load Contracts and Config
  // =====================================================
  console.log("📦 Loading contracts and config...\n");

  const dataStore = await get("DataStore");
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  console.log(`✅ DataStore: ${dataStore.address}`);

  // Load USDC config
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;
  const usdcDecimals = usdcConfig.decimals || 6;

  // Load full token config for price feed details
  const tokens = await hre.gmx.getTokens();
  const usdcFullConfig = tokens.USDC;

  if (!usdcFullConfig || !usdcFullConfig.priceFeed) {
    throw new Error("USDC price feed configuration not found in config/tokens.ts");
  }

  const priceFeedAddress = usdcFullConfig.priceFeed.address;
  const priceFeedDecimals = usdcFullConfig.priceFeed.decimals || 8;
  const heartbeatDuration = usdcFullConfig.priceFeed.heartbeatDuration || 144 * 60 * 60;
  const stablePriceUsd = usdcFullConfig.priceFeed.stablePriceUsd;

  console.log(`✅ USDC: ${usdcAddress} (${usdcDecimals} decimals)`);
  console.log(`✅ Price Feed: ${priceFeedAddress} (${priceFeedDecimals} decimals)`);
  console.log(`✅ Heartbeat: ${heartbeatDuration} seconds\n`);

  // =====================================================
  // STEP 2: Check Permissions
  // =====================================================
  console.log("🔐 Checking permissions...\n");

  const roleStore = await get("RoleStore");
  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);
  const { hashString } = await import("../utils/hash");

  const CONTROLLER_ROLE = hashString("CONTROLLER");
  const ROLE_ADMIN = hashString("ROLE_ADMIN");

  let hasController = await roleStoreContract.hasRole(deployer, CONTROLLER_ROLE);
  const hasRoleAdmin = await roleStoreContract.hasRole(deployer, ROLE_ADMIN);

  if (!hasController) {
    if (hasRoleAdmin) {
      console.log("✅ Deployer has ROLE_ADMIN. Granting CONTROLLER role...\n");
      const grantTx = await roleStoreContract.grantRole(deployer, CONTROLLER_ROLE);
      await grantTx.wait();
      console.log("✅ CONTROLLER role granted\n");
      hasController = true;
    } else {
      throw new Error(
        `❌ Deployer does not have CONTROLLER or ROLE_ADMIN role.\n` +
          `   Run: npx hardhat deploy --tags Roles --network arbitrumSepolia`
      );
    }
  } else {
    console.log(`✅ Deployer has CONTROLLER role\n`);
  }

  // =====================================================
  // STEP 3: Register Price Feed
  // =====================================================
  console.log("📝 Registering USDC price feed in DataStore...\n");

  // Set price feed address
  const priceFeedKey = keys.priceFeedKey(usdcAddress);
  await setAddressIfDifferent(priceFeedKey, priceFeedAddress, "USDC price feed");

  // Calculate price feed multiplier
  // Multiplier = 10^(60 - priceFeedDecimals - tokenDecimals)
  // For USDC: 10^(60 - 8 - 6) = 10^46
  const priceFeedMultiplier = expandDecimals(1, 60 - priceFeedDecimals - usdcDecimals);
  const multiplierKey = keys.priceFeedMultiplierKey(usdcAddress);
  await setUintIfDifferent(multiplierKey, priceFeedMultiplier, "USDC price feed multiplier");

  // Set heartbeat duration
  const heartbeatKey = keys.priceFeedHeartbeatDurationKey(usdcAddress);
  await setUintIfDifferent(heartbeatKey, heartbeatDuration, "USDC price feed heartbeat duration");

  // Set stable price if configured
  if (stablePriceUsd) {
    const stablePriceKey = keys.stablePriceKey(usdcAddress);
    const stablePriceValue = decimalToFloat(stablePriceUsd);
    await setUintIfDifferent(stablePriceKey, stablePriceValue, "USDC stable price");
    console.log(`✅ Set stable price: ${stablePriceUsd} USD\n`);
  }

  console.log("✅ USDC price feed registered successfully!\n");

  // =====================================================
  // STEP 4: Verify
  // =====================================================
  console.log("🔍 Verifying registration...\n");

  const registeredFeed = await dataStoreContract.getAddress(priceFeedKey);
  const registeredMultiplier = await dataStoreContract.getUint(multiplierKey);
  const registeredHeartbeat = await dataStoreContract.getUint(heartbeatKey);

  console.log(`   Price Feed: ${registeredFeed}`);
  console.log(`   Multiplier: ${registeredMultiplier.toString()}`);
  console.log(`   Heartbeat: ${registeredHeartbeat.toString()} seconds\n`);

  if (registeredFeed.toLowerCase() === priceFeedAddress.toLowerCase()) {
    console.log("✅ Verification successful!\n");
  } else {
    throw new Error(`❌ Verification failed! Expected ${priceFeedAddress}, got ${registeredFeed}`);
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ USDC PRICE FEED REGISTRATION COMPLETE!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
