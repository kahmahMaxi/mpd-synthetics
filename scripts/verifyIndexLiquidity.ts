/**
 * @title Verify Index Liquidity
 * @notice Verifies liquidity status in the DFI/USDC index market
 * @dev Checks GM token supply, deployer balance, and market pool balances via Reader
 *      Works on any network and does NOT require deposit execution
 *      Run with: npx hardhat run scripts/verifyIndexLiquidity.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import * as keys from "../utils/keys";

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
  const usdcDecimals = usdcConfig.decimals || 6;

  console.log(`✅ DataStore: ${dataStore.address}`);
  console.log(`✅ Reader: ${reader.address}`);
  console.log(`✅ IndexToken: ${indexToken.address}`);
  console.log(`✅ USDC: ${usdcAddress} (${usdcDecimals} decimals)\n`);

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
  // STEP 5: Get Market Pool Balances via Reader
  // =====================================================
  console.log("📈 Getting market pool balances...\n");

  let longTokenPoolAmount = hre.ethers.BigNumber.from(0);
  let shortTokenPoolAmount = hre.ethers.BigNumber.from(0);

  try {
    // Get pool amounts directly from DataStore
    // Note: Reader.getMarketInfo requires oracle prices, which may not be available on testnet
    // We'll read pool amounts directly from DataStore instead

    // Get pool amounts directly from DataStore
    const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);

    const longTokenPoolAmountKey = keys.poolAmountKey(market.marketToken, market.longToken);
    const shortTokenPoolAmountKey = keys.poolAmountKey(market.marketToken, market.shortToken);

    longTokenPoolAmount = await dataStoreContract.getUint(longTokenPoolAmountKey);
    shortTokenPoolAmount = await dataStoreContract.getUint(shortTokenPoolAmountKey);

    console.log(`   Long Token Pool: ${hre.ethers.utils.formatUnits(longTokenPoolAmount, usdcDecimals)} USDC`);
    console.log(`   Short Token Pool: ${hre.ethers.utils.formatUnits(shortTokenPoolAmount, usdcDecimals)} USDC\n`);
  } catch (error: any) {
    console.log(`   ⚠️  Could not get pool balances: ${error.message}\n`);
  }

  // =====================================================
  // STEP 6: Verdict with Summary Table
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" LIQUIDITY VERIFICATION SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const isLiquidityLive = gmTotalSupply.gt(0);

  // Print summary table
  console.log("┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ LIQUIDITY STATUS                                                   │");
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ GM Token Supply:     ${gmTotalSupplyFormatted.padEnd(45)} ${gmTokenSymbol} │`);
  console.log(`│ Deployer Balance:   ${deployerGmBalanceFormatted.padEnd(45)} ${gmTokenSymbol} │`);
  console.log(
    `│ Long Token Pool:    ${hre.ethers.utils.formatUnits(longTokenPoolAmount, usdcDecimals).padEnd(45)} USDC │`
  );
  console.log(
    `│ Short Token Pool:    ${hre.ethers.utils.formatUnits(shortTokenPoolAmount, usdcDecimals).padEnd(45)} USDC │`
  );
  console.log("├────────────────────────────────────────────────────────────────────┤");
  if (isLiquidityLive) {
    console.log("│ STATUS:             LIQUIDITY LIVE ✅                              │");
  } else {
    console.log("│ STATUS:             LIQUIDITY NOT LIVE ❌                         │");
  }
  console.log("└────────────────────────────────────────────────────────────────────┘\n");

  if (isLiquidityLive) {
    console.log("✅ GM tokens have been minted successfully!");
    console.log(`✅ Total Supply: ${gmTotalSupplyFormatted} ${gmTokenSymbol}`);
    console.log(`✅ Your Balance: ${deployerGmBalanceFormatted} ${gmTokenSymbol}`);
    console.log(`✅ Long Pool: ${hre.ethers.utils.formatUnits(longTokenPoolAmount, usdcDecimals)} USDC`);
    console.log(`✅ Short Pool: ${hre.ethers.utils.formatUnits(shortTokenPoolAmount, usdcDecimals)} USDC\n`);

    console.log("📝 Next Steps:");
    console.log("   1. The market is now ready for trading");
    console.log("   2. Users can open positions using the DFI/USDC market");
    console.log("   3. Monitor market liquidity and adjust as needed\n");
  } else {
    console.log("❌ GM tokens have not been minted yet.");
    console.log("❌ Total Supply: 0 (deposits may not have been executed)\n");

    console.log("📝 Next Steps:");
    console.log("   1. Deposits are created but not yet executed");
    console.log("   2. Execution requires GMX keeper infrastructure or local fork");
    console.log("   3. Check pending deposits with executeIndexDeposits.ts");
    console.log("   4. Re-run this script after deposits are executed\n");
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
