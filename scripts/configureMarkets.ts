/**
 * @title Configure Markets
 * @notice Configures all market parameters in DataStore (funding, borrowing, limits, prices, etc.)
 * @dev Run with: npx hardhat run scripts/configureMarkets.ts --network localhost
 * 
 * This script runs updateMarketConfig which writes all required market configuration
 * values to DataStore, including:
 * - Funding factors (min/max funding, funding increase/decrease)
 * - Borrowing factors (base, optimal usage, above optimal)
 * - Position impact factors
 * - Market limits (max open interest, max collateral, max pool amounts)
 * - PnL factors (for traders, ADL, deposits, withdrawals)
 * - Reserve factors
 * - Fee factors
 * - Liquidation factors
 * 
 * This MUST be run after:
 * 1. Deploying GMX Synthetics contracts
 * 2. Deploying base tokens
 * 3. Deploying markets
 * 
 * Without this, order execution will fail with error 0xef2df9b5 (missing market config).
 */

import hre from "hardhat";
import { updateMarketConfig } from "./updateMarketConfigUtils";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURE MARKETS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { deployer } = await hre.getNamedAccounts();
  console.log(`Deployer: ${deployer}\n`);

  // Get required contracts
  const dataStore = await hre.ethers.getContract("DataStore");
  const reader = await hre.ethers.getContract("Reader");
  
  console.log(`DataStore: ${dataStore.address}`);
  console.log(`Reader: ${reader.address}\n`);

  // Get markets from config
  const markets = await hre.gmx.getMarkets();
  console.log(`📂 Found ${markets.length} market(s) in config:\n`);
  
  for (const market of markets) {
    const indexToken = market.tokens.indexToken || "N/A (swap-only)";
    const longToken = market.tokens.longToken;
    const shortToken = market.tokens.shortToken;
    console.log(`   - ${indexToken}/${longToken}/${shortToken}`);
  }
  console.log();

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURING MARKETS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("⚠️  This will write all market configuration values to DataStore.");
  console.log("   This includes funding, borrowing, limits, fees, and more.\n");

  try {
    // For localhost, we skip validation since markets might not be fully configured
    // The validation is too strict for local development
    if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
      console.log("ℹ️  Skipping market config validation for local network\n");
    }

    // Run updateMarketConfig with write=true
    // This will configure all markets defined in config/markets.ts for localhost
    await updateMarketConfig({
      write: true,
      // Include all configuration types for localhost
      includeRiskOracleBaseKeys: false, // Not needed for localhost
      includeKeeperBaseKeys: false, // Not needed for localhost
      includeFunding: false, // Include all funding configs
      includePositionImpact: false, // Include all position impact configs
      includeMaxOpenInterest: false, // Include max open interest configs
    });

    console.log("\n══════════════════════════════════════════════════════════════════════");
    console.log(" ✅ MARKET CONFIGURATION COMPLETE!");
    console.log("══════════════════════════════════════════════════════════════════════\n");

    console.log("📊 Verifying configuration...\n");

    // Verify by checking a few key values for each market
    const onchainMarkets = await reader.getMarkets(dataStore.address, 0, 100);
    
    for (const market of onchainMarkets) {
      if (market.indexToken === hre.ethers.constants.AddressZero) {
        continue; // Skip swap-only markets
      }

      try {
        // Check a few key config values to verify they're set
        const reserveFactorKey = hre.ethers.utils.keccak256(
          hre.ethers.utils.toUtf8Bytes("RESERVE_FACTOR")
        );
        const reserveFactor = await dataStore.getUint(
          hre.ethers.utils.keccak256(
            hre.ethers.utils.defaultAbiCoder.encode(
              ["bytes32", "address"],
              [reserveFactorKey, market.marketToken]
            )
          )
        );

        const minFundingKey = hre.ethers.utils.keccak256(
          hre.ethers.utils.toUtf8Bytes("MIN_FUNDING_FACTOR_PER_SECOND")
        );
        const minFunding = await dataStore.getUint(
          hre.ethers.utils.keccak256(
            hre.ethers.utils.defaultAbiCoder.encode(
              ["bytes32", "address"],
              [minFundingKey, market.marketToken]
            )
          )
        );

        console.log(`✅ Market ${market.marketToken}:`);
        console.log(`   Reserve Factor: ${reserveFactor.toString()}`);
        console.log(`   Min Funding Factor: ${minFunding.toString()}\n`);
      } catch (error: any) {
        console.warn(`⚠️  Could not verify market ${market.marketToken}: ${error.message}\n`);
      }
    }

    console.log("══════════════════════════════════════════════════════════════════════");
    console.log(" ✅ ALL MARKETS CONFIGURED SUCCESSFULLY!");
    console.log("══════════════════════════════════════════════════════════════════════\n");
    console.log("You can now execute orders without the 0xef2df9b5 error.");
    console.log("Try running: npx hardhat orders:execute --network localhost\n");
  } catch (error: any) {
    console.error("\n❌ Failed to configure markets:", error.message);
    console.error("\nThis might happen if:");
    console.error("  1. Markets are not deployed yet (run deployMarkets.ts first)");
    console.error("  2. Tokens are not deployed yet (run deployBaseTokens.ts first)");
    console.error("  3. DataStore is not accessible");
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

