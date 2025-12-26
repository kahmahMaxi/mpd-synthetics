/**
 * @title Inspect Index Market State
 * @notice Read-only inspection of DFI/USDC index market state
 * @dev This script reads market configuration, open interest, pending orders, and positions
 *      Focus: Phase 3C-3D (Logic-Only) - Read-only verification
 *      Run with: npx hardhat run scripts/inspectIndexState.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import * as keys from "../utils/keys";
import { getAccountOrderCount, getAccountOrderKeys } from "../utils/order";
import { getAccountPositionCount, getAccountPositionKeys, getPositionKey } from "../utils/position";
import { OrderType, orderTypeNames } from "../utils/order";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" INSPECT INDEX MARKET STATE");
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

  // Load USDC
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;
  const usdcDecimals = usdcConfig.decimals || 6;

  console.log(`✅ DataStore: ${dataStore.address}`);
  console.log(`✅ Reader: ${reader.address}`);
  console.log(`✅ IndexToken: ${indexToken.address}`);
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
  // STEP 3: Market Configuration
  // =====================================================
  console.log("📊 Market Configuration:\n");

  // Max Open Interest
  const maxOpenInterestLongKey = keys.maxOpenInterestKey(market.marketToken, true);
  const maxOpenInterestShortKey = keys.maxOpenInterestKey(market.marketToken, false);
  const maxOpenInterestLong = await dataStoreContract.getUint(maxOpenInterestLongKey);
  const maxOpenInterestShort = await dataStoreContract.getUint(maxOpenInterestShortKey);

  // Position Impact Factors
  const positivePositionImpactKey = keys.positionImpactFactorKey(market.marketToken, true);
  const negativePositionImpactKey = keys.positionImpactFactorKey(market.marketToken, false);
  const positivePositionImpact = await dataStoreContract.getUint(positivePositionImpactKey);
  const negativePositionImpact = await dataStoreContract.getUint(negativePositionImpactKey);

  // Funding Factor
  const fundingFactorKey = keys.fundingFactorKey(market.marketToken);
  const fundingFactor = await dataStoreContract.getUint(fundingFactorKey);

  // Min Collateral Factor (stored in 30 decimals)
  const minCollateralFactorKey = keys.minCollateralFactorKey(market.marketToken);
  const minCollateralFactor = await dataStoreContract.getUint(minCollateralFactorKey);
  // Convert from 30 decimals to percentage: (value / 10^30) * 100
  const minCollateralFactorPercent = (parseFloat(minCollateralFactor.toString()) / 1e30) * 100;
  const maxLeverage = minCollateralFactorPercent > 0 ? 100 / minCollateralFactorPercent : 0;

  console.log(`   Market Token: ${market.marketToken}`);
  console.log(`   Index Token: ${market.indexToken}`);
  console.log(`   Long Token: ${market.longToken}`);
  console.log(`   Short Token: ${market.shortToken}`);
  console.log(`   Max Open Interest (Long):  ${hre.ethers.utils.formatEther(maxOpenInterestLong)} USD`);
  console.log(`   Max Open Interest (Short): ${hre.ethers.utils.formatEther(maxOpenInterestShort)} USD`);
  console.log(`   Positive Position Impact:  ${positivePositionImpact.toString()}`);
  console.log(`   Negative Position Impact:  ${negativePositionImpact.toString()}`);
  console.log(`   Funding Factor:            ${fundingFactor.toString()}`);
  console.log(
    `   Min Collateral Factor:     ${minCollateralFactorPercent.toFixed(4)}% (Max Leverage: ${maxLeverage.toFixed(
      0
    )}x)\n`
  );

  // =====================================================
  // STEP 4: Open Interest
  // =====================================================
  console.log("📈 Open Interest:\n");

  const openInterestLongKey = keys.openInterestKey(market.marketToken, usdcAddress, true);
  const openInterestShortKey = keys.openInterestKey(market.marketToken, usdcAddress, false);
  const openInterestLong = await dataStoreContract.getUint(openInterestLongKey);
  const openInterestShort = await dataStoreContract.getUint(openInterestShortKey);

  console.log(`   Long Open Interest:  ${hre.ethers.utils.formatEther(openInterestLong)} USD`);
  console.log(`   Short Open Interest: ${hre.ethers.utils.formatEther(openInterestShort)} USD`);
  console.log(`   Total Open Interest: ${hre.ethers.utils.formatEther(openInterestLong.add(openInterestShort))} USD\n`);

  // =====================================================
  // STEP 5: Pending Orders
  // =====================================================
  console.log("📋 Pending Orders:\n");

  const orderCount = await getAccountOrderCount(dataStoreContract, deployer);
  console.log(`   Total Orders for Deployer: ${orderCount}\n`);

  if (orderCount > 0) {
    const orderKeys = await getAccountOrderKeys(dataStoreContract, deployer, 0, orderCount);
    console.log(`   Found ${orderKeys.length} order(s):\n`);

    for (let i = 0; i < orderKeys.length; i++) {
      const orderKey = orderKeys[i];
      try {
        const order = await readerContract.getOrder(dataStore.address, orderKey);

        if (order.addresses.market.toLowerCase() === market.marketToken.toLowerCase()) {
          const orderType = order.numbers.orderType;
          const orderTypeName = orderTypeNames[orderType] || `Unknown(${orderType})`;
          const isLong = order.flags.isLong;
          // sizeDeltaUsd is stored in 30 decimals (decimalToFloat format)
          const sizeDeltaUsd = parseFloat(order.numbers.sizeDeltaUsd.toString()) / 1e30;
          const collateralDeltaAmount = hre.ethers.utils.formatUnits(
            order.numbers.initialCollateralDeltaAmount,
            usdcDecimals
          );

          console.log(`   Order ${i + 1}:`);
          console.log(`      Key: ${orderKey}`);
          console.log(`      Type: ${orderTypeName}`);
          console.log(`      Direction: ${isLong ? "LONG" : "SHORT"}`);
          console.log(`      Size: $${sizeDeltaUsd} USD`);
          console.log(`      Collateral: ${collateralDeltaAmount} USDC`);
          console.log(`      Status: Pending\n`);
        }
      } catch (error: any) {
        console.log(`   Order ${i + 1}: Error reading order - ${error.message}\n`);
      }
    }
  } else {
    console.log("   No pending orders found.\n");
  }

  // =====================================================
  // STEP 6: Positions
  // =====================================================
  console.log("💼 Positions:\n");

  const positionCount = await getAccountPositionCount(dataStoreContract, deployer);
  console.log(`   Total Positions for Deployer: ${positionCount}\n`);

  if (positionCount > 0) {
    const positionKeys = await getAccountPositionKeys(dataStoreContract, deployer, 0, positionCount);
    console.log(`   Found ${positionKeys.length} position(s):\n`);

    for (let i = 0; i < positionKeys.length; i++) {
      const positionKey = positionKeys[i];
      try {
        const position = await readerContract.getPosition(dataStore.address, positionKey);

        if (position.addresses.market.toLowerCase() === market.marketToken.toLowerCase()) {
          const sizeInUsd = hre.ethers.utils.formatEther(position.numbers.sizeInUsd);
          const collateralAmount = hre.ethers.utils.formatUnits(position.numbers.collateralAmount, usdcDecimals);
          const entryPrice = hre.ethers.utils.formatEther(position.numbers.entryPrice);
          const borrowingFactor = hre.ethers.utils.formatEther(position.numbers.borrowingFactor);
          const fundingFeeAmountPerSize = hre.ethers.utils.formatEther(position.numbers.fundingFeeAmountPerSize);

          console.log(`   Position ${i + 1}:`);
          console.log(`      Key: ${positionKey}`);
          console.log(`      Direction: ${position.flags.isLong ? "LONG" : "SHORT"}`);
          console.log(`      Size: $${sizeInUsd} USD`);
          console.log(`      Collateral: ${collateralAmount} USDC`);
          console.log(`      Entry Price: $${entryPrice}`);
          console.log(`      Borrowing Factor: ${borrowingFactor}`);
          console.log(`      Funding Fee Per Size: ${fundingFeeAmountPerSize}\n`);
        }
      } catch (error: any) {
        console.log(`   Position ${i + 1}: Error reading position - ${error.message}\n`);
      }
    }
  } else {
    console.log("   No positions found.\n");
  }

  // =====================================================
  // STEP 7: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ INSPECTION COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📊 Summary:");
  console.log(`   Market: ${market.marketToken}`);
  console.log(`   Open Interest: ${hre.ethers.utils.formatEther(openInterestLong.add(openInterestShort))} USD`);
  console.log(`   Pending Orders: ${orderCount}`);
  console.log(`   Active Positions: ${positionCount}\n`);

  console.log("📝 Next Steps:");
  console.log("   1. Run calcIndexPnL.ts to calculate PnL for positions");
  console.log("   2. Create more orders with openIndexPosition.ts");
  console.log("   3. Monitor market state changes\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
