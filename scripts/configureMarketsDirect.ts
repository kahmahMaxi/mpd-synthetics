/**
 * @title Configure Markets Directly
 * @notice Directly configures deployed markets by reading from DataStore
 * @dev Run with: npx hardhat run scripts/configureMarketsDirect.ts --network localhost
 * 
 * This script bypasses the config/markets.ts and directly configures all
 * deployed markets with default values from hardhatBaseMarketConfig.
 */

import hre from "hardhat";
import { updateMarketConfig } from "./updateMarketConfigUtils";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURE MARKETS DIRECTLY");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Force reload of markets config by clearing memoization
  // This ensures we get fresh market data
  if ((hre.gmx as any).getMarkets?.cache?.clear) {
    (hre.gmx as any).getMarkets.cache.clear();
  }
  if ((hre.gmx as any).getTokens?.cache?.clear) {
    (hre.gmx as any).getTokens.cache.clear();
  }

  const markets = await hre.gmx.getMarkets();
  const tokens = await hre.gmx.getTokens();

  console.log(`Found ${markets.length} market(s) in config`);
  console.log(`Found ${Object.keys(tokens).length} token(s) in config\n`);

  // Log markets and tokens for debugging
  console.log("Markets in config:");
  for (const market of markets) {
    const indexToken = market.tokens.indexToken || "N/A";
    const longToken = market.tokens.longToken;
    const shortToken = market.tokens.shortToken;
    console.log(`  - ${indexToken}/${longToken}/${shortToken}`);
  }
  console.log();

  console.log("Tokens in config:");
  for (const [symbol, token] of Object.entries(tokens)) {
    const address = (token as any).address || "NO ADDRESS";
    console.log(`  - ${symbol}: ${address}`);
  }
  console.log();

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" RUNNING UPDATE MARKET CONFIG");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  try {
    await updateMarketConfig({
      write: true,
      includeRiskOracleBaseKeys: false,
      includeKeeperBaseKeys: false,
      includeFunding: false,
      includePositionImpact: false,
      includeMaxOpenInterest: false,
    });

    console.log("\n══════════════════════════════════════════════════════════════════════");
    console.log(" ✅ MARKET CONFIGURATION COMPLETE!");
    console.log("══════════════════════════════════════════════════════════════════════\n");
    console.log("You can now execute orders without the 0xef2df9b5 error.");
    console.log("Try running: npx hardhat orders:execute --network localhost\n");
  } catch (error: any) {
    console.error("\n❌ Failed to configure markets:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

