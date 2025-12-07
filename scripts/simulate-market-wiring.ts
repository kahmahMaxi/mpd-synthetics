/**
 * @title Simulate Market Wiring
 * @notice Simulates market deployment and wiring without on-chain actions
 * @dev Run with: npx ts-node scripts/simulate-market-wiring.ts
 */

import * as fs from "fs";
import * as path from "path";
import { hashString } from "../utils/hash";

interface TokenConfig {
  symbol: string;
  decimals: number;
  address: string;
  oracleId: string;
  priceFeedMultiplier: string;
  priceFeedDecimals: number;
  tokenType: "stable" | "volatile";
  isCollateralToken: boolean;
  isSwapToken: boolean;
}

interface MarketConfig {
  marketTokenSymbol: string;
  marketTokenName: string;
  indexTokenSymbol: string;
  longTokenSymbol: string;
  shortTokenSymbol: string;
  reserveFactor: string;
  maxCumulativeDeltaDiff: string;
  tokenDecimals: number;
  marketTokenAddress?: string;
}

interface MarketsDeployConfig {
  markets: string[];
  collateralTokens: string[];
  generatedAt: string;
  network: string;
}

interface MPDDeployConfig {
  tokens: {
    governanceToken: { symbol: string; address: string };
    escrowedToken: { symbol: string; address: string };
    vester: { symbol: string; address: string };
  };
}

const TOKENS_DIR = path.resolve(__dirname, "..", "config", "tokens");
const MARKETS_DIR = path.resolve(__dirname, "..", "config", "markets");
const MARKETS_CONFIG_PATH = path.resolve(__dirname, "..", "config", "deploy-config.markets.json");
const MPD_CONFIG_PATH = path.resolve(__dirname, "..", "config", "deploy-config.mpd.json");

function loadTokenConfig(symbol: string): TokenConfig {
  const tokenPath = path.join(TOKENS_DIR, `${symbol.toLowerCase()}.json`);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Token config not found: ${tokenPath}`);
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

function loadMarketConfig(marketFile: string): MarketConfig {
  const marketPath = path.resolve(__dirname, "..", marketFile);
  if (!fs.existsSync(marketPath)) {
    throw new Error(`Market config not found: ${marketPath}`);
  }
  return JSON.parse(fs.readFileSync(marketPath, "utf8"));
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" MARKET WIRING SIMULATION");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("This is a simulation - no on-chain actions will be performed.\n");

  // Load configs
  if (!fs.existsSync(MARKETS_CONFIG_PATH)) {
    console.error(`❌ Markets config not found: ${MARKETS_CONFIG_PATH}`);
    process.exit(1);
  }

  const marketsConfig: MarketsDeployConfig = JSON.parse(fs.readFileSync(MARKETS_CONFIG_PATH, "utf8"));
  console.log(`📂 Loaded markets config: ${marketsConfig.markets.length} markets\n`);

  let mpdConfig: MPDDeployConfig | null = null;
  if (fs.existsSync(MPD_CONFIG_PATH)) {
    mpdConfig = JSON.parse(fs.readFileSync(MPD_CONFIG_PATH, "utf8"));
    console.log(`📂 Loaded MPD config\n`);
  }

  // Load token configs
  const tokenAddresses: Record<string, string> = {};
  const tokenConfigs: Record<string, TokenConfig> = {};
  const tokenSymbols = new Set<string>();

  for (const marketFile of marketsConfig.markets) {
    const marketConfig = loadMarketConfig(marketFile);
    tokenSymbols.add(marketConfig.indexTokenSymbol);
    tokenSymbols.add(marketConfig.longTokenSymbol);
    tokenSymbols.add(marketConfig.shortTokenSymbol);
  }

  console.log("📂 Loading token configs...");
  for (const symbol of tokenSymbols) {
    try {
      const tokenConfig = loadTokenConfig(symbol);
      tokenConfigs[symbol] = tokenConfig;
      tokenAddresses[symbol] = tokenConfig.address || "(not deployed)";
      console.log(`   ${symbol}: ${tokenAddresses[symbol]}`);
    } catch (error) {
      console.error(`   ❌ Failed to load ${symbol}:`, error);
    }
  }
  console.log();

  // Process each market
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" MARKET CONFIGURATIONS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const marketTable: Array<{
    market: string;
    index: string;
    long: string;
    short: string;
    decimals: number;
    reserveFactor: string;
    maxCumulativeDeltaDiff: string;
  }> = [];

  for (const marketFile of marketsConfig.markets) {
    const marketConfig = loadMarketConfig(marketFile);
    const indexToken = tokenAddresses[marketConfig.indexTokenSymbol] || "(not deployed)";
    const longToken = tokenAddresses[marketConfig.longTokenSymbol] || "(not deployed)";
    const shortToken = tokenAddresses[marketConfig.shortTokenSymbol] || "(not deployed)";

    console.log(`📊 ${marketConfig.marketTokenSymbol} (${marketConfig.marketTokenName})`);
    console.log(`   Index Token: ${marketConfig.indexTokenSymbol} (${indexToken})`);
    console.log(`   Long Token: ${marketConfig.longTokenSymbol} (${longToken})`);
    console.log(`   Short Token: ${marketConfig.shortTokenSymbol} (${shortToken})`);
    console.log(`   Decimals: ${marketConfig.tokenDecimals}`);
    console.log(`   Reserve Factor: ${marketConfig.reserveFactor}`);
    console.log(`   Max Cumulative Delta Diff: ${marketConfig.maxCumulativeDeltaDiff}\n`);

    marketTable.push({
      market: marketConfig.marketTokenSymbol,
      index: marketConfig.indexTokenSymbol,
      long: marketConfig.longTokenSymbol,
      short: marketConfig.shortTokenSymbol,
      decimals: marketConfig.tokenDecimals,
      reserveFactor: marketConfig.reserveFactor,
      maxCumulativeDeltaDiff: marketConfig.maxCumulativeDeltaDiff,
    });
  }

  // Simulate DataStore injections
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" SIMULATED DATASTORE INJECTIONS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const marketFile of marketsConfig.markets) {
    const marketConfig = loadMarketConfig(marketFile);
    const indexToken = tokenAddresses[marketConfig.indexTokenSymbol];
    const longToken = tokenAddresses[marketConfig.longTokenSymbol];
    const shortToken = tokenAddresses[marketConfig.shortTokenSymbol];

    if (!indexToken || !longToken || !shortToken) {
      console.log(`⚠️  Skipping ${marketConfig.marketTokenSymbol} - tokens not deployed`);
      continue;
    }

    // Calculate market salt (simplified)
    const marketType = hashString("basic-v1");
    const marketSalt = hashString("MARKET_SALT");
    console.log(`📝 Market: ${marketConfig.marketTokenSymbol}`);
    console.log(`   [SET_ADDRESS] MARKET_TOKEN (${marketConfig.marketTokenSymbol}) = <calculated from salt>`);
    console.log(`   [SET_ADDRESS] INDEX_TOKEN (${marketConfig.indexTokenSymbol}) = ${indexToken}`);
    console.log(`   [SET_ADDRESS] LONG_TOKEN (${marketConfig.longTokenSymbol}) = ${longToken}`);
    console.log(`   [SET_ADDRESS] SHORT_TOKEN (${marketConfig.shortTokenSymbol}) = ${shortToken}`);
    console.log(`   [SET_BYTES32] MARKET_TYPE = ${marketType}`);
    console.log(`   [SET_BYTES32] MARKET_SALT = ${marketSalt}`);
    console.log();
  }

  // Oracle price feeds
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ORACLE PRICE FEED CONFIGURATIONS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const feedTable: Array<{
    token: string;
    oracleId: string;
    feedId: string;
    multiplier: string;
    decimals: number;
  }> = [];

  for (const symbol of tokenSymbols) {
    const tokenConfig = tokenConfigs[symbol];
    if (tokenConfig) {
      const feedId = hashString(`PRICE_FEED_${tokenConfig.oracleId}`);
      feedTable.push({
        token: symbol,
        oracleId: tokenConfig.oracleId,
        feedId: feedId,
        multiplier: tokenConfig.priceFeedMultiplier,
        decimals: tokenConfig.priceFeedDecimals,
      });
    }
  }

  console.log(
    "┌──────────┬───────────┬──────────────────────────────────────────┬──────────────────────────────────────┬───────────┐"
  );
  console.log(
    "│ Token    │ Oracle ID │ Feed ID (simulated)                      │ Multiplier                           │ Decimals  │"
  );
  console.log(
    "├──────────┼───────────┼──────────────────────────────────────────┼──────────────────────────────────────┼───────────┤"
  );

  for (const feed of feedTable) {
    const feedIdDisplay = feed.feedId.length > 42 ? feed.feedId.slice(0, 10) + "..." + feed.feedId.slice(-8) : feed.feedId;
    console.log(
      `│ ${feed.token.padEnd(8)} │ ${feed.oracleId.padEnd(9)} │ ${feedIdDisplay.padEnd(40)} │ ${feed.multiplier.padEnd(36)} │ ${feed.decimals.toString().padEnd(9)} │`
    );
  }

  console.log(
    "└──────────┴───────────┴──────────────────────────────────────────┴──────────────────────────────────────┴───────────┘"
  );

  // Summary table
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" MARKET SUMMARY TABLE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(
    "┌──────────────────┬──────────────┬──────────────┬──────────────┬───────────┬──────────────────────┬──────────────────────┐"
  );
  console.log(
    "│ Market           │ Index        │ Long         │ Short        │ Decimals  │ Reserve Factor       │ Max Cumulative Delta │"
  );
  console.log(
    "├──────────────────┼──────────────┼──────────────┼──────────────┼───────────┼──────────────────────┼──────────────────────┤"
  );

  for (const market of marketTable) {
    console.log(
      `│ ${market.market.padEnd(16)} │ ${market.index.padEnd(12)} │ ${market.long.padEnd(12)} │ ${market.short.padEnd(12)} │ ${market.decimals.toString().padEnd(9)} │ ${market.reserveFactor.padEnd(20)} │ ${market.maxCumulativeDeltaDiff.padEnd(20)} │`
    );
  }

  console.log(
    "└──────────────────┴──────────────┴──────────────┴──────────────┴───────────┴──────────────────────┴──────────────────────┘"
  );

  // MPD integration check
  if (mpdConfig) {
    console.log("\n══════════════════════════════════════════════════════════════════════");
    console.log(" MPD INTEGRATION");
    console.log("══════════════════════════════════════════════════════════════════════\n");
    console.log(`✅ MPD Token: ${mpdConfig.tokens.governanceToken.address}`);
    console.log(`✅ esMPD Token: ${mpdConfig.tokens.escrowedToken.address}`);
    console.log(`✅ Vester: ${mpdConfig.tokens.vester.address}`);
    console.log("\n💰 Fee flows will route to MPD reward system");
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" SIMULATION COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log("📋 Summary:");
  console.log(`   • Markets configured: ${marketsConfig.markets.length}`);
  console.log(`   • Tokens required: ${tokenSymbols.size}`);
  console.log(`   • Oracle feeds: ${feedTable.length}`);
  console.log("\n⚠️  This was a SIMULATION. No on-chain actions were performed.");
  console.log("   To deploy markets, run: npx hardhat run scripts/deployMarkets.ts --network localhost");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

