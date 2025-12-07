/**
 * @title Set Oracle Prices
 * @notice Update prices in mock price feeds
 * @dev Run with: npx hardhat run scripts/setOraclePrices.ts --network localhost --eth 2400 --btc 98000 --sol 120 --usdc 1
 *      Or: npx hardhat oracle:set --eth 2400 --btc 98000 --sol 120 --usdc 1
 */

import hre from "hardhat";
import { parseArgs } from "util";

interface PriceArgs {
  eth?: string;
  btc?: string;
  sol?: string;
  usdc?: string;
}

const TOKEN_TO_FEED: Record<string, string> = {
  WETH: "WETHPriceFeed",
  WBTC: "WBTCPriceFeed",
  SOL: "SOLPriceFeed",
  USDC: "USDCPriceFeed",
};

async function main(taskArgs?: PriceArgs) {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" SET ORACLE PRICES");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  // Parse CLI arguments
  const args: PriceArgs = taskArgs || {};
  
  // If no task args provided, try to parse from process.argv
  if (!taskArgs || Object.keys(taskArgs).length === 0) {
    // Parse command line arguments manually
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--eth" && i + 1 < argv.length) {
        args.eth = argv[i + 1];
        i++;
      } else if (argv[i] === "--btc" && i + 1 < argv.length) {
        args.btc = argv[i + 1];
        i++;
      } else if (argv[i] === "--sol" && i + 1 < argv.length) {
        args.sol = argv[i + 1];
        i++;
      } else if (argv[i] === "--usdc" && i + 1 < argv.length) {
        args.usdc = argv[i + 1];
        i++;
      }
    }
  }
  
  // Fallback to environment variables
  if (!args.eth) args.eth = process.env.ETH;
  if (!args.btc) args.btc = process.env.BTC;
  if (!args.sol) args.sol = process.env.SOL;
  if (!args.usdc) args.usdc = process.env.USDC;

  const prices: Array<{ symbol: string; feedName: string; price: string; price8Dec: string }> = [];

  // Update prices
  if (args.eth) {
    const price = parseFloat(args.eth);
    const price8Dec = Math.floor(price * 1e8).toString();
    await updatePrice("WETH", "WETHPriceFeed", price8Dec, price.toString());
    prices.push({ symbol: "WETH", feedName: "WETHPriceFeed", price: price.toString(), price8Dec });
  }

  if (args.btc) {
    const price = parseFloat(args.btc);
    const price8Dec = Math.floor(price * 1e8).toString();
    await updatePrice("WBTC", "WBTCPriceFeed", price8Dec, price.toString());
    prices.push({ symbol: "WBTC", feedName: "WBTCPriceFeed", price: price.toString(), price8Dec });
  }

  if (args.sol) {
    const price = parseFloat(args.sol);
    const price8Dec = Math.floor(price * 1e8).toString();
    await updatePrice("SOL", "SOLPriceFeed", price8Dec, price.toString());
    prices.push({ symbol: "SOL", feedName: "SOLPriceFeed", price: price.toString(), price8Dec });
  }

  if (args.usdc) {
    const price = parseFloat(args.usdc);
    const price8Dec = Math.floor(price * 1e8).toString();
    await updatePrice("USDC", "USDCPriceFeed", price8Dec, price.toString());
    prices.push({ symbol: "USDC", feedName: "USDCPriceFeed", price: price.toString(), price8Dec });
  }

  if (prices.length === 0) {
    console.log("⚠️  No prices provided. Usage:");
    console.log("   npx hardhat run scripts/setOraclePrices.ts --network localhost --eth 2400 --btc 98000");
    console.log("   or");
    console.log("   npx hardhat oracle:set --eth 2400 --btc 98000 --sol 120 --usdc 1");
    return;
  }

  // Print summary table
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" PRICE UPDATE SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(
    "┌──────────┬──────────────────────────────────────────┬──────────────┬──────────────────┐"
  );
  console.log(
    "│ Symbol   │ Feed Address                             │ Price (USD)  │ Price (8-dec)    │"
  );
  console.log(
    "├──────────┼──────────────────────────────────────────┼──────────────┼──────────────────┤"
  );

  for (const priceInfo of prices) {
    const feed = await get(priceInfo.feedName);
    const feedDisplay =
      feed.address.length > 42 ? feed.address : feed.address.slice(0, 10) + "..." + feed.address.slice(-8);
    console.log(
      `│ ${priceInfo.symbol.padEnd(8)} │ ${feedDisplay.padEnd(40)} │ $${priceInfo.price.padEnd(12)} │ ${priceInfo.price8Dec.padEnd(16)} │`
    );
  }

  console.log(
    "└──────────┴──────────────────────────────────────────┴──────────────┴──────────────────┘"
  );

  console.log("\n✅ Prices updated successfully!");
  console.log("══════════════════════════════════════════════════════════════════════");
}

async function updatePrice(symbol: string, feedName: string, price8Dec: string, priceDisplay: string) {
  try {
    const feed = await hre.deployments.get(feedName);
    const feedContract = await hre.ethers.getContractAt("contracts/oracle/MockPriceFeed.sol:MockPriceFeed", feed.address);
    const [deployer] = await hre.ethers.getSigners();

    // Use deployer as signer (should be owner since we deployed with deployer)
    const signer = deployer;

    const tx = await feedContract.connect(signer).setPrice(price8Dec);
    await tx.wait();

    console.log(`✅ Updated ${symbol} price to $${priceDisplay} (${price8Dec} in 8-decimal format)`);
  } catch (error) {
    console.error(`❌ Failed to update ${symbol} price:`, error);
    throw error;
  }
}

// Export main for use as hardhat task
export { main };

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

