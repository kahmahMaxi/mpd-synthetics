/**
 * @title Calculate Index Position PnL
 * @notice Calculates unrealized PnL, funding impact, and borrowing fees for positions
 * @dev This script reads position data and calculates PnL (read-only verification)
 *      Focus: Phase 3C-3D (Logic-Only) - PnL calculation validation
 *      Run with: npx hardhat run scripts/calcIndexPnL.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import { getAccountPositionCount, getAccountPositionKeys } from "../utils/position";
import { expandDecimals } from "../utils/math";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CALCULATE INDEX POSITION PNL");
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
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  const reader = await get("Reader");
  const readerContract = await hre.ethers.getContractAt("Reader", reader.address);
  const indexToken = await get("IndexToken");
  const indexPriceFeed = await get("IndexPriceFeed");

  // Load USDC
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;
  const usdcDecimals = usdcConfig.decimals || 6;

  console.log(`✅ DataStore: ${dataStore.address}`);
  console.log(`✅ Reader: ${reader.address}`);
  console.log(`✅ IndexToken: ${indexToken.address}`);
  console.log(`✅ IndexPriceFeed: ${indexPriceFeed.address}`);
  console.log(`✅ USDC: ${usdcAddress}\n`);

  // =====================================================
  // STEP 2: Find Market
  // =====================================================
  console.log("🔍 Finding DFI/USDC market...\n");

  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  const markets = await getOnchainMarkets(read, dataStore.address);
  const market = markets[marketKey];

  if (!market) {
    throw new Error(`Market not found for key: ${marketKey}`);
  }

  console.log(`✅ Market found: ${market.marketToken}\n`);

  // =====================================================
  // STEP 3: Get Current Index Price
  // =====================================================
  console.log("💰 Fetching current index price...\n");

  let currentIndexPrice: number;
  try {
    const indexPriceFeedContract = await hre.ethers.getContractAt("IndexPriceFeed", indexPriceFeed.address);
    const [roundId, answer, startedAt, updatedAt, answeredInRound] = await indexPriceFeedContract.latestRoundData();

    // IndexPriceFeed returns price in 8 decimals (Chainlink standard)
    const priceIn8Decimals = answer.toString();
    currentIndexPrice = parseFloat(priceIn8Decimals) / 1e8;

    console.log(`   Round ID: ${roundId.toString()}`);
    console.log(`   Price: $${currentIndexPrice.toFixed(8)} USD`);
    console.log(`   Updated At: ${new Date(Number(updatedAt) * 1000).toISOString()}\n`);
  } catch (error: any) {
    throw new Error(`Failed to fetch index price: ${error.message}`);
  }

  // =====================================================
  // STEP 4: Get Positions
  // =====================================================
  console.log("💼 Finding positions...\n");

  const positionCount = await getAccountPositionCount(dataStoreContract, deployer);
  console.log(`   Total Positions: ${positionCount}\n`);

  if (positionCount === 0) {
    console.log("⚠️  No positions found for deployer.\n");
    console.log("📝 Next Steps:");
    console.log("   1. Create a position with openIndexPosition.ts");
    console.log("   2. Re-run this script to calculate PnL\n");
    return;
  }

  const positionKeys = await getAccountPositionKeys(dataStoreContract, deployer, 0, positionCount);
  console.log(`   Found ${positionKeys.length} position(s) for this market:\n`);

  // =====================================================
  // STEP 5: Calculate PnL for Each Position
  // =====================================================
  for (let i = 0; i < positionKeys.length; i++) {
    const positionKey = positionKeys[i];
    console.log(`────────────────────────────────────────────────────────────────────`);
    console.log(` Position ${i + 1}/${positionKeys.length}`);
    console.log(`────────────────────────────────────────────────────────────────────`);
    console.log(`   Key: ${positionKey}\n`);

    try {
      const position = await readerContract.getPosition(dataStore.address, positionKey);

      // Check if position is for this market
      if (position.addresses.market.toLowerCase() !== market.marketToken.toLowerCase()) {
        console.log(`   ⚠️  Position is for a different market. Skipping.\n`);
        continue;
      }

      // Extract position data
      const isLong = position.flags.isLong;
      const sizeInUsd = parseFloat(hre.ethers.utils.formatEther(position.numbers.sizeInUsd));
      const collateralAmount = parseFloat(
        hre.ethers.utils.formatUnits(position.numbers.collateralAmount, usdcDecimals)
      );
      const entryPrice = parseFloat(hre.ethers.utils.formatEther(position.numbers.entryPrice));
      const borrowingFactor = parseFloat(hre.ethers.utils.formatEther(position.numbers.borrowingFactor));
      const fundingFeeAmountPerSize = parseFloat(
        hre.ethers.utils.formatEther(position.numbers.fundingFeeAmountPerSize)
      );
      const longTokenClaimableFundingAmountPerSize = parseFloat(
        hre.ethers.utils.formatEther(position.numbers.longTokenClaimableFundingAmountPerSize)
      );
      const shortTokenClaimableFundingAmountPerSize = parseFloat(
        hre.ethers.utils.formatEther(position.numbers.shortTokenClaimableFundingAmountPerSize)
      );

      console.log(`   Position Details:`);
      console.log(`      Direction: ${isLong ? "LONG" : "SHORT"}`);
      console.log(`      Size: $${sizeInUsd.toFixed(2)} USD`);
      console.log(`      Collateral: ${collateralAmount.toFixed(6)} USDC`);
      console.log(`      Entry Price: $${entryPrice.toFixed(8)} USD`);
      console.log(`      Current Price: $${currentIndexPrice.toFixed(8)} USD\n`);

      // Calculate unrealized PnL
      let unrealizedPnl: number;
      if (isLong) {
        // Long: profit when price goes up
        unrealizedPnl = sizeInUsd * ((currentIndexPrice - entryPrice) / entryPrice);
      } else {
        // Short: profit when price goes down
        unrealizedPnl = sizeInUsd * ((entryPrice - currentIndexPrice) / entryPrice);
      }

      console.log(`   PnL Calculation:`);
      console.log(`      Unrealized PnL: $${unrealizedPnl.toFixed(2)} USD`);
      if (unrealizedPnl > 0) {
        console.log(`      Status: ✅ PROFIT`);
      } else if (unrealizedPnl < 0) {
        console.log(`      Status: ❌ LOSS`);
      } else {
        console.log(`      Status: ⚖️  BREAK EVEN`);
      }
      console.log(`      PnL %: ${((unrealizedPnl / sizeInUsd) * 100).toFixed(4)}%\n`);

      // Calculate funding impact
      const totalFundingFee = fundingFeeAmountPerSize * sizeInUsd;
      console.log(`   Funding Fees:`);
      console.log(`      Funding Fee Per Size: ${fundingFeeAmountPerSize.toFixed(10)}`);
      console.log(`      Total Funding Fee: $${totalFundingFee.toFixed(2)} USD`);
      console.log(`      Long Token Claimable: ${longTokenClaimableFundingAmountPerSize.toFixed(10)}`);
      console.log(`      Short Token Claimable: ${shortTokenClaimableFundingAmountPerSize.toFixed(10)}\n`);

      // Calculate borrowing fees (simplified - actual calculation is more complex)
      console.log(`   Borrowing Fees:`);
      console.log(`      Borrowing Factor: ${borrowingFactor.toFixed(10)}`);
      console.log(`      Note: Actual borrowing fees depend on pool utilization and time\n`);

      // Net PnL (after fees)
      const netPnl = unrealizedPnl - totalFundingFee;
      console.log(`   Net PnL (after funding fees):`);
      console.log(`      Net PnL: $${netPnl.toFixed(2)} USD`);
      console.log(`      Net PnL %: ${((netPnl / sizeInUsd) * 100).toFixed(4)}%\n`);
    } catch (error: any) {
      console.error(`   ❌ Error calculating PnL: ${error.message}\n`);
    }
  }

  // =====================================================
  // STEP 6: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ PNL CALCULATION COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📊 Summary:");
  console.log(`   Current Index Price: $${currentIndexPrice.toFixed(8)} USD`);
  console.log(`   Positions Analyzed: ${positionCount}\n`);

  console.log("📝 Next Steps:");
  console.log("   1. Monitor price changes and recalculate PnL");
  console.log("   2. Check funding fees accumulation over time");
  console.log("   3. Verify PnL calculations match GMX V2 formulas\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
