/**
 * @title Create Index Market
 * @notice Creates a GMX V2 market for IndexToken (DFI) using USDC as collateral
 * @dev This script creates a market with IndexToken as indexToken and USDC as both longToken and shortToken
 *      Run with: npx hardhat run scripts/createIndexMarket.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as keys from "../utils/keys";
import { DEFAULT_MARKET_TYPE, getMarketKey, getOnchainMarkets } from "../utils/market";
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
    printSummary(
      indexToken.address,
      usdcAddress,
      existingMarket.marketToken,
      marketKey,
      true
    );
    return;
  }
  console.log("✅ Market does not exist yet\n");

  // =====================================================
  // STEP 3: Create Market
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

    console.log(`✅ Market creation transaction: ${tx.transactionHash}\n`);

    // Wait for transaction to be mined
    await tx.wait();
    console.log("✅ Transaction confirmed\n");
  } catch (error: any) {
    if (error.message.includes("already exists") || error.message.includes("MarketTokenAlreadyExists")) {
      console.log(`⚠️  Market may already exist. Checking DataStore...\n`);
    } else {
      throw new Error(`❌ Failed to create market: ${error.message}`);
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
  printSummary(
    indexToken.address,
    usdcAddress,
    createdMarket.marketToken,
    marketKey,
    false
  );
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

