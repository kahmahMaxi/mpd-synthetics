/**
 * @title Deploy Markets
 * @notice Deploys GMX markets using MarketFactory and updates JSON configs
 * @dev Run with: npx hardhat run scripts/deployMarkets.ts --network localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
import { DEFAULT_MARKET_TYPE, getMarketKey, getOnchainMarkets } from "../utils/market";

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

const TOKENS_DIR = path.resolve(__dirname, "..", "config", "tokens");
const MARKETS_DIR = path.resolve(__dirname, "..", "config", "markets");
const MARKETS_CONFIG_PATH = path.resolve(__dirname, "..", "config", "deploy-config.markets.json");

async function loadTokenConfig(symbol: string): Promise<TokenConfig> {
  const tokenPath = path.join(TOKENS_DIR, `${symbol.toLowerCase()}.json`);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Token config not found: ${tokenPath}`);
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

async function loadMarketConfigs(): Promise<Array<{ file: string; config: MarketConfig }>> {
  // Ensure markets directory exists
  if (!fs.existsSync(MARKETS_DIR)) {
    fs.mkdirSync(MARKETS_DIR, { recursive: true });
  }

  // Create deploy-config.markets.json if it doesn't exist
  if (!fs.existsSync(MARKETS_CONFIG_PATH)) {
    console.log(`📝 Creating markets config file: deploy-config.markets.json`);
    const defaultMarketsConfig = {
      markets: [
        "config/markets/eth-usd.json",
        "config/markets/btc-usd.json",
        "config/markets/sol-usd.json",
        "config/markets/weth-usd.json",
      ],
      collateralTokens: [
        "config/tokens/usdc.json",
        "config/tokens/weth.json",
        "config/tokens/wbtc.json",
        "config/tokens/sol.json",
      ],
      generatedAt: new Date().toISOString(),
      network: hre.network.name,
    };
    fs.writeFileSync(MARKETS_CONFIG_PATH, JSON.stringify(defaultMarketsConfig, null, 2));
  }

  const marketsConfig = JSON.parse(fs.readFileSync(MARKETS_CONFIG_PATH, "utf8"));
  const marketFiles = marketsConfig.markets || [];

  // Market defaults based on file name
  const marketDefaults: Record<string, Partial<MarketConfig>> = {
    "config/markets/eth-usd.json": {
      marketTokenSymbol: "ETH-USD",
      marketTokenName: "ETH / USD Market",
      indexTokenSymbol: "WETH",
      longTokenSymbol: "WETH",
      shortTokenSymbol: "USDC",
      reserveFactor: "0.85",
      maxCumulativeDeltaDiff: "0.02",
      tokenDecimals: 18,
    },
    "config/markets/btc-usd.json": {
      marketTokenSymbol: "BTC-USD",
      marketTokenName: "BTC / USD Market",
      indexTokenSymbol: "WBTC",
      longTokenSymbol: "WBTC",
      shortTokenSymbol: "USDC",
      reserveFactor: "0.85",
      maxCumulativeDeltaDiff: "0.02",
      tokenDecimals: 8,
    },
    "config/markets/sol-usd.json": {
      marketTokenSymbol: "SOL-USD",
      marketTokenName: "SOL / USD Market",
      indexTokenSymbol: "SOL",
      longTokenSymbol: "SOL",
      shortTokenSymbol: "USDC",
      reserveFactor: "0.85",
      maxCumulativeDeltaDiff: "0.02",
      tokenDecimals: 18,
    },
    "config/markets/weth-usd.json": {
      marketTokenSymbol: "WETH-USD",
      marketTokenName: "WETH / USD Market",
      indexTokenSymbol: "WETH",
      longTokenSymbol: "WETH",
      shortTokenSymbol: "USDC",
      reserveFactor: "0.85",
      maxCumulativeDeltaDiff: "0.02",
      tokenDecimals: 18,
    },
  };

  const marketConfigs: Array<{ file: string; config: MarketConfig }> = [];

  for (const marketFile of marketFiles) {
    const marketPath = path.resolve(__dirname, "..", marketFile);
    
    // Create market config file if it doesn't exist
    let config: MarketConfig;
    if (!fs.existsSync(marketPath)) {
      console.log(`📝 Creating market config file: ${marketFile}`);
      const defaults = marketDefaults[marketFile];
      if (!defaults) {
        console.warn(`⚠️  No defaults found for ${marketFile}, skipping...`);
        continue;
      }
      config = {
        marketTokenSymbol: defaults.marketTokenSymbol!,
        marketTokenName: defaults.marketTokenName!,
        indexTokenSymbol: defaults.indexTokenSymbol!,
        longTokenSymbol: defaults.longTokenSymbol!,
        shortTokenSymbol: defaults.shortTokenSymbol!,
        reserveFactor: defaults.reserveFactor!,
        maxCumulativeDeltaDiff: defaults.maxCumulativeDeltaDiff!,
        tokenDecimals: defaults.tokenDecimals!,
        marketTokenAddress: "", // Will be filled after deployment
      };
      // Write initial config file
      fs.writeFileSync(marketPath, JSON.stringify(config, null, 2));
    } else {
      config = JSON.parse(fs.readFileSync(marketPath, "utf8"));
    }

    marketConfigs.push({ file: marketFile, config });
  }

  return marketConfigs;
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" DEPLOY MARKETS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { execute, get, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // Ensure MarketFactory is deployed
  const marketFactory = await get("MarketFactory");
  const dataStore = await get("DataStore");

  console.log(`📦 MarketFactory: ${marketFactory.address}`);
  console.log(`📦 DataStore: ${dataStore.address}\n`);

  // Load market configs
  console.log("📂 Loading market configs...");
  const marketConfigs = await loadMarketConfigs();
  console.log(`   Loaded ${marketConfigs.length} market configs\n`);

  // Load token configs and create address map
  const tokenAddresses: Record<string, string> = {};
  const tokenSymbols = new Set<string>();

  for (const { config } of marketConfigs) {
    tokenSymbols.add(config.indexTokenSymbol);
    tokenSymbols.add(config.longTokenSymbol);
    tokenSymbols.add(config.shortTokenSymbol);
  }

  console.log("📂 Loading token configs...");
  for (const symbol of tokenSymbols) {
    try {
      const tokenConfig = await loadTokenConfig(symbol);
      if (!tokenConfig.address || tokenConfig.address === "") {
        throw new Error(`Token ${symbol} has no address. Deploy tokens first.`);
      }
      tokenAddresses[symbol] = tokenConfig.address;
      console.log(`   ✅ ${symbol}: ${tokenConfig.address}`);
    } catch (error) {
      console.error(`   ❌ Failed to load ${symbol}:`, error);
      throw error;
    }
  }
  console.log();

  // Get existing markets
  const onchainMarketsByTokens = await getOnchainMarkets(read, dataStore.address);

  const results: Array<{
    marketTokenSymbol: string;
    indexToken: string;
    longToken: string;
    shortToken: string;
    address: string;
    status: string;
  }> = [];

  // Deploy markets
  for (const { file, config } of marketConfigs) {
    const indexToken = tokenAddresses[config.indexTokenSymbol];
    const longToken = tokenAddresses[config.longTokenSymbol];
    const shortToken = tokenAddresses[config.shortTokenSymbol];

    if (!indexToken || !longToken || !shortToken) {
      console.error(`❌ Missing token addresses for ${config.marketTokenSymbol}`);
      continue;
    }

    const marketKey = getMarketKey(indexToken, longToken, shortToken);
    const existingMarket = onchainMarketsByTokens[marketKey];

    if (existingMarket) {
      console.log(`♻️  Market ${config.marketTokenSymbol} already exists at ${existingMarket.marketToken}`);
      config.marketTokenAddress = existingMarket.marketToken;

      // Update config file
      const marketPath = path.resolve(__dirname, "..", file);
      fs.writeFileSync(marketPath, JSON.stringify(config, null, 2));

      results.push({
        marketTokenSymbol: config.marketTokenSymbol,
        indexToken: config.indexTokenSymbol,
        longToken: config.longTokenSymbol,
        shortToken: config.shortTokenSymbol,
        address: existingMarket.marketToken,
        status: "♻️  Reused",
      });
      continue;
    }

    console.log(`📦 Creating market ${config.marketTokenSymbol}...`);
    console.log(`   Index: ${config.indexTokenSymbol} (${indexToken})`);
    console.log(`   Long: ${config.longTokenSymbol} (${longToken})`);
    console.log(`   Short: ${config.shortTokenSymbol} (${shortToken})`);

    try {
      const tx = await execute(
        "MarketFactory",
        { from: deployer, log: true },
        "createMarket",
        indexToken,
        longToken,
        shortToken,
        DEFAULT_MARKET_TYPE
      );

      // Fetch the deployed market address
      const updatedMarkets = await getOnchainMarkets(read, dataStore.address);
      const deployedMarket = updatedMarkets[marketKey];

      if (!deployedMarket) {
        throw new Error(`Market was created but address not found in DataStore`);
      }

      config.marketTokenAddress = deployedMarket.marketToken;

      // Update config file
      const marketPath = path.resolve(__dirname, "..", file);
      fs.writeFileSync(marketPath, JSON.stringify(config, null, 2));

      results.push({
        marketTokenSymbol: config.marketTokenSymbol,
        indexToken: config.indexTokenSymbol,
        longToken: config.longTokenSymbol,
        shortToken: config.shortTokenSymbol,
        address: deployedMarket.marketToken,
        status: "✅ Deployed",
      });

      console.log(`   ✅ Market deployed at ${deployedMarket.marketToken}\n`);
    } catch (error) {
      console.error(`   ❌ Failed to deploy market:`, error);
      results.push({
        marketTokenSymbol: config.marketTokenSymbol,
        indexToken: config.indexTokenSymbol,
        longToken: config.longTokenSymbol,
        shortToken: config.shortTokenSymbol,
        address: "FAILED",
        status: "❌ Failed",
      });
    }
  }

  // Print summary table
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" DEPLOYMENT SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(
    "┌──────────────────┬──────────────┬──────────────┬──────────────┬──────────────────────────────────────────┬──────────────┐"
  );
  console.log(
    "│ MarketToken      │ IndexToken   │ LongToken    │ ShortToken   │ Address                                  │ Status       │"
  );
  console.log(
    "├──────────────────┼──────────────┼──────────────┼──────────────┼──────────────────────────────────────────┼──────────────┤"
  );

  for (const result of results) {
    const addressDisplay =
      result.address.length > 42
        ? result.address
        : result.address.slice(0, 10) + "..." + result.address.slice(-8);
    console.log(
      `│ ${result.marketTokenSymbol.padEnd(16)} │ ${result.indexToken.padEnd(12)} │ ${result.longToken.padEnd(12)} │ ${result.shortToken.padEnd(12)} │ ${addressDisplay.padEnd(40)} │ ${result.status.padEnd(12)} │`
    );
  }

  console.log(
    "└──────────────────┴──────────────┴──────────────┴──────────────┴──────────────────────────────────────────┴──────────────┘"
  );

  console.log("\n📝 Config files updated:");
  for (const { file } of marketConfigs) {
    console.log(`   ✅ ${file}`);
  }

  console.log("\n✅ Market deployment complete!");
  console.log("══════════════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

