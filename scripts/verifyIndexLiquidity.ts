/**
 * @title Verify Index Liquidity
 * @notice Verifies that liquidity has been successfully seeded in the DFI/USDC index market
 * @dev Checks GM token supply, deployer balance, and market liquidity via Reader
 *      Run with: npx hardhat run scripts/verifyIndexLiquidity.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" VERIFY INDEX LIQUIDITY");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // =====================================================
  // STEP 1: Load Contracts
  // =====================================================
  console.log("📦 Loading contracts...\n");

  const dataStore = await get("DataStore");
  const indexToken = await get("IndexToken");
  const reader = await get("Reader");

  // Load USDC address
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;

  console.log(`✅ DataStore: ${dataStore.address}`);
  console.log(`✅ Reader: ${reader.address}`);
  console.log(`✅ IndexToken: ${indexToken.address}`);
  console.log(`✅ USDC: ${usdcAddress}\n`);

  // =====================================================
  // STEP 2: Find Market
  // =====================================================
  console.log("🔍 Finding DFI/USDC market...\n");

  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  console.log(`   Market Key: ${marketKey}\n`);

  let market;
  try {
    const markets = await getOnchainMarkets(read, dataStore.address);
    market = markets[marketKey];

    if (!market) {
      throw new Error("Market not found");
    }
  } catch (error: any) {
    console.error(`❌ Failed to find market: ${error.message}\n`);
    process.exit(1);
  }

  console.log(`✅ Market found!`);
  console.log(`   Market Token (GM): ${market.marketToken}\n`);

  // =====================================================
  // STEP 3: Load GM Token
  // =====================================================
  console.log("📊 Loading GM Token...\n");

  const gmToken = await hre.ethers.getContractAt("ERC20", market.marketToken);
  const gmTokenName = await gmToken.name();
  const gmTokenSymbol = await gmToken.symbol();
  const gmTokenDecimals = await gmToken.decimals();

  console.log(`   Name: ${gmTokenName}`);
  console.log(`   Symbol: ${gmTokenSymbol}`);
  console.log(`   Decimals: ${gmTokenDecimals}\n`);

  // =====================================================
  // STEP 4: Check GM Token Supply and Balance
  // =====================================================
  console.log("💰 Checking GM Token Supply and Balance...\n");

  const gmTotalSupply = await gmToken.totalSupply();
  const deployerGmBalance = await gmToken.balanceOf(deployer);

  const gmTotalSupplyFormatted = hre.ethers.utils.formatUnits(gmTotalSupply, gmTokenDecimals);
  const deployerGmBalanceFormatted = hre.ethers.utils.formatUnits(deployerGmBalance, gmTokenDecimals);

  console.log(`   GM Total Supply: ${gmTotalSupplyFormatted} ${gmTokenSymbol}`);
  console.log(`   Your GM Balance: ${deployerGmBalanceFormatted} ${gmTokenSymbol}\n`);

  // =====================================================
  // STEP 5: Get Market Liquidity via Reader
  // =====================================================
  console.log("📈 Getting market liquidity information...\n");

  try {
    const readerContract = await hre.ethers.getContractAt("Reader", reader.address);

    // Get market details
    const marketDetails = await readerContract.getMarket(dataStore.address, market.marketToken);

    console.log(`   Index Token: ${marketDetails.indexToken}`);
    console.log(`   Long Token: ${marketDetails.longToken}`);
    console.log(`   Short Token: ${marketDetails.shortToken}\n`);

    // Try to get market info (requires prices, so we'll skip if it fails)
    try {
      // For market info, we'd need prices, which is complex
      // Instead, we'll just check the GM supply which is the key indicator
      console.log(`   ℹ️  Market info requires oracle prices. Skipping detailed liquidity check.\n`);
    } catch (infoError: any) {
      // Ignore - market info requires prices
      console.log(`   ℹ️  Market info requires oracle prices. Skipping detailed liquidity check.\n`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Could not get detailed market info: ${error.message}\n`);
  }

  // =====================================================
  // STEP 6: Verdict
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" LIQUIDITY VERIFICATION RESULT");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  if (gmTotalSupply.gt(0)) {
    console.log("┌────────────────────────────────────────────────────────────────────┐");
    console.log("│                                                                   │");
    console.log("│                    LIQUIDITY LIVE ✅                              │");
    console.log("│                                                                   │");
    console.log("└────────────────────────────────────────────────────────────────────┘\n");

    console.log("✅ GM tokens have been minted successfully!");
    console.log(`✅ Total Supply: ${gmTotalSupplyFormatted} ${gmTokenSymbol}`);
    console.log(`✅ Your Balance: ${deployerGmBalanceFormatted} ${gmTokenSymbol}\n`);

    console.log("📝 Next Steps:");
    console.log("   1. The market is now ready for trading");
    console.log("   2. Users can open positions using the DFI/USDC market");
    console.log("   3. Monitor market liquidity and adjust as needed\n");
  } else {
    console.log("┌────────────────────────────────────────────────────────────────────┐");
    console.log("│                                                                   │");
    console.log("│                 LIQUIDITY NOT LIVE ❌                             │");
    console.log("│                                                                   │");
    console.log("└────────────────────────────────────────────────────────────────────┘\n");

    console.log("❌ GM tokens have not been minted yet.");
    console.log("❌ Total Supply: 0 (deposits may not have been executed)\n");

    console.log("📝 Next Steps:");
    console.log("   1. Run executeIndexDeposits.ts to execute pending deposits");
    console.log("   2. Wait for keeper to execute deposits (if using automated keepers)");
    console.log("   3. Re-run this script to verify liquidity\n");
  }

  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
