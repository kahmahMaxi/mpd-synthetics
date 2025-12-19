/**
 * @title Create Index Market
 * @notice Creates a GMX V2 market for IndexToken (DFI) using USDC as collateral
 * @dev This script creates a market with IndexToken as indexToken and USDC as both longToken and shortToken
 *      Run with: npx hardhat run scripts/createIndexMarket.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as keys from "../utils/keys";
import { DEFAULT_MARKET_TYPE, getMarketKey, getOnchainMarkets } from "../utils/market";
import { hashString } from "../utils/hash";
import * as fs from "fs";
import * as path from "path";

const TOKENS_DIR = path.resolve(__dirname, "..", "config", "tokens");

interface TokenConfig {
  symbol: string;
  decimals: number;
  address: string;
}

function loadTokenConfig(symbol: string): TokenConfig {
  const tokenPath = path.join(TOKENS_DIR, `${symbol.toLowerCase()}.json`);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Token config not found: ${tokenPath}`);
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CREATE INDEX MARKET");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { execute, get, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // =====================================================
  // STEP 1: Load Deployed Contracts
  // =====================================================
  console.log("📦 Loading deployed contracts...\n");

  // Load MarketFactory
  let marketFactory;
  try {
    marketFactory = await get("MarketFactory");
    console.log(`✅ MarketFactory: ${marketFactory.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load MarketFactory: ${error.message}`);
  }

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

  // Load USDC
  let usdcAddress: string;
  let usdcDecimals: number;
  try {
    // Try to load from config file first
    const usdcConfig = loadTokenConfig("USDC");
    usdcAddress = usdcConfig.address;
    usdcDecimals = usdcConfig.decimals;
    console.log(`✅ USDC: ${usdcAddress} (${usdcDecimals} decimals)`);
  } catch (error: any) {
    // Fallback: try to get from deployments or gmx.getTokens()
    try {
      const tokens = await hre.gmx.getTokens();
      if (tokens.USDC && tokens.USDC.address) {
        usdcAddress = tokens.USDC.address;
        usdcDecimals = tokens.USDC.decimals;
        console.log(`✅ USDC: ${usdcAddress} (${usdcDecimals} decimals)`);
      } else {
        throw new Error("USDC not found in token configs");
      }
    } catch (fallbackError: any) {
      throw new Error(`Failed to load USDC. Ensure it's deployed or configured. Error: ${fallbackError.message}`);
    }
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

  if (!usdcAddress || usdcAddress === hre.ethers.constants.AddressZero) {
    throw new Error("❌ USDC address is zero");
  }
  console.log("✅ USDC address is valid");

  // Check token decimals
  const indexTokenContract = await hre.ethers.getContractAt("IndexToken", indexToken.address);
  const indexTokenDecimals = await indexTokenContract.decimals();

  if (indexTokenDecimals !== 18) {
    throw new Error(`❌ IndexToken must have 18 decimals, got ${indexTokenDecimals}`);
  }
  console.log(`✅ IndexToken decimals: ${indexTokenDecimals}`);

  if (usdcDecimals !== 6) {
    console.log(`⚠️  Warning: USDC has ${usdcDecimals} decimals (expected 6)`);
  } else {
    console.log(`✅ USDC decimals: ${usdcDecimals}`);
  }

  // Check oracle mapping exists
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  const priceFeedKey = keys.priceFeedKey(indexToken.address);
  const registeredOracle = await dataStoreContract.getAddress(priceFeedKey);

  if (!registeredOracle || registeredOracle === hre.ethers.constants.AddressZero) {
    throw new Error(
      `❌ Oracle not registered for IndexToken. Run registerIndexOracle.ts first.\n` +
        `   Token: ${indexToken.address}\n` +
        `   Key: ${priceFeedKey}`
    );
  }
  console.log(`✅ Oracle registered: ${registeredOracle}`);

  // Check if market already exists
  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  const existingMarkets = await getOnchainMarkets(read, dataStore.address);
  const existingMarket = existingMarkets[marketKey];

  if (existingMarket) {
    console.log(`⚠️  Market already exists!`);
    console.log(`   Market Token (GM): ${existingMarket.marketToken}`);
    console.log(`   Index Token: ${existingMarket.indexToken}`);
    console.log(`   Long Token: ${existingMarket.longToken}`);
    console.log(`   Short Token: ${existingMarket.shortToken}`);
    console.log(`\n   Skipping market creation.\n`);

    // Print summary with existing market
    printSummary(indexToken.address, usdcAddress, existingMarket.marketToken, marketKey, true);
    return;
  }
  console.log("✅ Market does not exist yet\n");

  // =====================================================
  // STEP 3: Verify MARKET_KEEPER Role
  // =====================================================
  console.log("🔐 Verifying MARKET_KEEPER role...\n");

  const roleStore = await get("RoleStore");
  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);
  const MARKET_KEEPER_ROLE = hashString("MARKET_KEEPER");
  const hasMarketKeeper = await roleStoreContract.hasRole(deployer, MARKET_KEEPER_ROLE);

  if (!hasMarketKeeper) {
    console.log("⚠️  Deployer does not have MARKET_KEEPER role. Granting...\n");
    const ROLE_ADMIN = hashString("ROLE_ADMIN");
    const hasRoleAdmin = await roleStoreContract.hasRole(deployer, ROLE_ADMIN);

    if (hasRoleAdmin) {
      const grantTx = await roleStoreContract.grantRole(deployer, MARKET_KEEPER_ROLE);
      await grantTx.wait();
      console.log("✅ MARKET_KEEPER role granted\n");
    } else {
      throw new Error("Deployer needs MARKET_KEEPER role but doesn't have ROLE_ADMIN to grant it");
    }
  } else {
    console.log("✅ Deployer has MARKET_KEEPER role\n");
  }

  // =====================================================
  // STEP 4: Create Market
  // =====================================================
  console.log("📝 Creating market...\n");
  console.log(`   Market Name: DFI / USDC`);
  console.log(`   Index Token: ${indexToken.address} (DFI)`);
  console.log(`   Long Token:  ${usdcAddress} (USDC)`);
  console.log(`   Short Token: ${usdcAddress} (USDC)`);
  console.log(`   Market Type: ${DEFAULT_MARKET_TYPE}\n`);

  try {
    const tx = await execute(
      "MarketFactory",
      { from: deployer, log: true },
      "createMarket",
      indexToken.address,
      usdcAddress,
      usdcAddress,
      DEFAULT_MARKET_TYPE
    );

    // execute() already waits for the transaction, so we just log the hash
    const txHash = tx.transactionHash || tx.hash || "unknown";
    console.log(`✅ Market creation transaction: ${txHash}\n`);
    console.log("✅ Transaction confirmed\n");
  } catch (error: any) {
    // Extract error data from nested structure (ethers wraps errors)
    const errorData = error.data || error.error?.data || error.reason?.data || "";
    const errorMessage = error.message || error.error?.message || error.reason?.message || "";

    // Check if error is MarketAlreadyExists
    const isMarketExistsError =
      errorMessage.includes("already exists") ||
      errorMessage.includes("MarketTokenAlreadyExists") ||
      errorMessage.includes("MarketAlreadyExists") ||
      (typeof errorData === "string" && errorData.includes("0x25e34fa1"));

    if (isMarketExistsError) {
      console.log(`⚠️  Market already exists! Extracting market address from error...\n`);

      // Try to extract market address from error data
      // Error format: MarketAlreadyExists(bytes32 salt, address existingMarketAddress)
      // Error selector: 0x25e34fa1 (4 bytes) + salt (32 bytes) + address (32 bytes, last 20 bytes are the address)
      let marketAddress = null;
      if (typeof errorData === "string" && errorData.length >= 138) {
        // Extract address from last 40 hex chars (20 bytes)
        marketAddress = "0x" + errorData.slice(-40);
        console.log(`   Existing Market Token: ${marketAddress}\n`);
      }

      // Verify the market exists in DataStore
      try {
        const updatedMarkets = await getOnchainMarkets(read, dataStore.address);
        const foundMarket = Object.values(updatedMarkets).find((m: any) => {
          if (marketAddress) {
            return m.marketToken.toLowerCase() === marketAddress.toLowerCase();
          }
          // If we couldn't extract address, check by market key
          return (
            m.indexToken.toLowerCase() === indexToken.address.toLowerCase() &&
            m.longToken.toLowerCase() === usdcAddress.toLowerCase() &&
            m.shortToken.toLowerCase() === usdcAddress.toLowerCase()
          );
        });

        if (foundMarket) {
          console.log(`✅ Found existing market in DataStore!`);
          console.log(`   Market Token (GM): ${foundMarket.marketToken}`);
          console.log(`   Index Token: ${foundMarket.indexToken}`);
          console.log(`   Long Token: ${foundMarket.longToken}`);
          console.log(`   Short Token: ${foundMarket.shortToken}\n`);

          // Print summary and return
          printSummary(indexToken.address, usdcAddress, foundMarket.marketToken, marketKey, true);
          return;
        }
      } catch (verifyError: any) {
        console.log(`⚠️  Could not verify market: ${verifyError.message}\n`);
      }

      if (marketAddress) {
        console.log(`⚠️  Market exists at ${marketAddress} but not found in DataStore query.`);
        console.log(`   This may be a timing issue. Market was likely created successfully.\n`);

        // Print summary with the address we extracted
        printSummary(indexToken.address, usdcAddress, marketAddress, marketKey, true);
        return;
      }

      console.log(`⚠️  Market exists but could not extract address. Skipping creation.\n`);
      return;
    } else {
      // Check if error data contains MarketAlreadyExists selector (fallback check)
      const errorData = error.data || error.error?.data || error.reason?.data || "";
      if (typeof errorData === "string" && errorData.includes("0x25e34fa1")) {
        console.log(`⚠️  Market already exists (detected from error data)! Extracting market address...\n`);
        const marketAddress = "0x" + errorData.slice(-40);
        console.log(`   Existing Market Token: ${marketAddress}\n`);

        // Print summary with extracted address
        printSummary(indexToken.address, usdcAddress, marketAddress, marketKey, true);
        return;
      }

      throw new Error(`❌ Failed to create market: ${errorMessage || error.message || "Unknown error"}`);
    }
  }

  // =====================================================
  // STEP 4: Verify Market Creation
  // =====================================================
  console.log("🔍 Verifying market creation...\n");

  // Refresh markets from DataStore
  const updatedMarkets = await getOnchainMarkets(read, dataStore.address);
  const createdMarket = updatedMarkets[marketKey];

  if (!createdMarket) {
    throw new Error(
      `❌ Market was created but not found in DataStore!\n` +
        `   Market Key: ${marketKey}\n` +
        `   This may indicate a problem with the market creation transaction.`
    );
  }

  console.log(`✅ Market found in DataStore!`);
  console.log(`   Market Token (GM): ${createdMarket.marketToken}`);
  console.log(`   Index Token: ${createdMarket.indexToken}`);
  console.log(`   Long Token: ${createdMarket.longToken}`);
  console.log(`   Short Token: ${createdMarket.shortToken}\n`);

  // Verify addresses match
  if (createdMarket.indexToken.toLowerCase() !== indexToken.address.toLowerCase()) {
    throw new Error(`❌ Index token mismatch!`);
  }
  if (createdMarket.longToken.toLowerCase() !== usdcAddress.toLowerCase()) {
    throw new Error(`❌ Long token mismatch!`);
  }
  if (createdMarket.shortToken.toLowerCase() !== usdcAddress.toLowerCase()) {
    throw new Error(`❌ Short token mismatch!`);
  }

  console.log("✅ All token addresses match\n");

  // =====================================================
  // STEP 5: Summary
  // =====================================================
  printSummary(indexToken.address, usdcAddress, createdMarket.marketToken, marketKey, false);
}

function printSummary(
  indexToken: string,
  usdcAddress: string,
  marketToken: string,
  marketKey: string,
  isExisting: boolean
) {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" MARKET CREATION SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ Market Information                                                 │");
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ Market Name:    ${"DFI / USDC".padEnd(58)} │`);
  console.log(`│ Market Key:     ${marketKey.padEnd(58)} │`);
  console.log(`│ Market Token:   ${marketToken.padEnd(58)} │`);
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ Index Token:    ${indexToken.padEnd(58)} │`);
  console.log(`│ Long Token:     ${usdcAddress.padEnd(58)} │`);
  console.log(`│ Short Token:    ${usdcAddress.padEnd(58)} │`);
  console.log("└────────────────────────────────────────────────────────────────────┘\n");

  if (isExisting) {
    console.log("⚠️  Market already existed - no action taken\n");
  } else {
    console.log("══════════════════════════════════════════════════════════════════════");
    console.log(" ✅ INDEX MARKET CREATION COMPLETE!");
    console.log("══════════════════════════════════════════════════════════════════════\n");
  }

  console.log("📝 Next Steps:");
  console.log("   1. Configure market parameters (funding, borrowing, limits)");
  console.log("   2. Seed initial liquidity to the market");
  console.log("   3. Test market operations (deposits, trades, withdrawals)");
  console.log("   4. Verify GM token functionality\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
