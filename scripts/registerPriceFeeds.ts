/**
 * @title Register Price Feeds
 * @notice Deploys mock price feeds and registers them in DataStore
 * @dev Run with: npx hardhat run scripts/registerPriceFeeds.ts --network localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
import { expandDecimals } from "../utils/math";
import * as keys from "../utils/keys";
import { setAddressIfDifferent, setUintIfDifferent } from "../utils/dataStore";

const TOKENS_DIR = path.resolve(__dirname, "..", "config", "tokens");

interface TokenConfig {
  symbol: string;
  decimals: number;
  address: string;
  oracleId: string;
  priceFeedMultiplier: string;
  priceFeedDecimals: number;
}

// Initial prices in 8-decimal format
const INITIAL_PRICES: Record<string, number> = {
  WETH: 2000, // $2000 per ETH
  WBTC: 90000, // $90000 per BTC
  SOL: 120, // $120 per SOL
  USDC: 1, // $1 per USDC
};

function loadTokenConfig(symbol: string): TokenConfig {
  const tokenPath = path.join(TOKENS_DIR, `${symbol.toLowerCase()}.json`);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Token config not found: ${tokenPath}`);
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" REGISTER PRICE FEEDS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { deploy, get, log } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  const dataStore = await get("DataStore");
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);

  const tokens = ["WETH", "WBTC", "SOL", "USDC"];
  const deployedFeeds: Array<{
    symbol: string;
    tokenAddress: string;
    feedAddress: string;
    price: string;
  }> = [];

  console.log("📦 Deploying Mock Price Feeds...\n");

  for (const symbol of tokens) {
    const tokenConfig = loadTokenConfig(symbol);
    const tokenAddress = tokenConfig.address;

    if (!tokenAddress || tokenAddress === "") {
      log(`⚠️  Skipping ${symbol} - token not deployed`);
      continue;
    }

    const initialPrice = INITIAL_PRICES[symbol] * 1e8; // Convert to 8-decimal format
    const feedName = `${symbol}PriceFeed`;

    // Check if feed already deployed - but we need to redeploy with the correct contract
    // Delete existing deployment if it's the wrong contract type
    const existingFeed = await hre.deployments.getOrNull(feedName);
    let feedAddress: string;
    let newlyDeployed: boolean;

    // Always deploy new one with the correct contract to avoid conflicts
    const deployResult = await deploy(feedName, {
      from: deployer,
      log: true,
      contract: "contracts/oracle/MockPriceFeed.sol:MockPriceFeed",
      args: [initialPrice],
      force: true, // Force redeploy to ensure correct contract
    });
    feedAddress = deployResult.address;
    newlyDeployed = deployResult.newlyDeployed;
    log(`✅ Deployed ${feedName} at ${feedAddress}`);

    // Set price in feed if newly deployed
    if (newlyDeployed) {
      const feedContract = await hre.ethers.getContractAt("contracts/oracle/MockPriceFeed.sol:MockPriceFeed", feedAddress);
      await feedContract.setPrice(initialPrice);
      log(`   Set initial price: ${INITIAL_PRICES[symbol]} (${initialPrice} in 8-decimal format)`);
    }

    // Register feed in DataStore
    const priceFeedKey = keys.priceFeedKey(tokenAddress);
    await setAddressIfDifferent(priceFeedKey, feedAddress, `price feed for ${symbol}`);

    // Set price feed multiplier
    const multiplierKey = keys.priceFeedMultiplierKey(tokenAddress);
    const multiplier = tokenConfig.priceFeedMultiplier;
    await setUintIfDifferent(multiplierKey, multiplier, `price feed multiplier for ${symbol}`);

    // Set heartbeat duration (24 hours = 86400 seconds)
    const heartbeatKey = keys.priceFeedHeartbeatDurationKey(tokenAddress);
    await setUintIfDifferent(heartbeatKey, 86400, `price feed heartbeat for ${symbol}`);

    deployedFeeds.push({
      symbol,
      tokenAddress,
      feedAddress,
      price: INITIAL_PRICES[symbol].toString(),
    });

    log("");
  }

  // Print summary table
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" PRICE FEED REGISTRATION SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(
    "┌──────────┬──────────────────────────────────────────┬──────────────────────────────────────────┬──────────┐"
  );
  console.log(
    "│ Symbol   │ Token Address                           │ Feed Address                             │ Price    │"
  );
  console.log(
    "├──────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────┤"
  );

  for (const feed of deployedFeeds) {
    const tokenDisplay =
      feed.tokenAddress.length > 42
        ? feed.tokenAddress
        : feed.tokenAddress.slice(0, 10) + "..." + feed.tokenAddress.slice(-8);
    const feedDisplay =
      feed.feedAddress.length > 42 ? feed.feedAddress : feed.feedAddress.slice(0, 10) + "..." + feed.feedAddress.slice(-8);
    console.log(
      `│ ${feed.symbol.padEnd(8)} │ ${tokenDisplay.padEnd(40)} │ ${feedDisplay.padEnd(40)} │ $${feed.price.padEnd(8)} │`
    );
  }

  console.log(
    "└──────────┴──────────────────────────────────────────┴──────────────────────────────────────────┴──────────┘"
  );

  console.log("\n✅ Price feeds registered successfully!");
  console.log("══════════════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

