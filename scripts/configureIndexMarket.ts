/**
 * @title Configure Index Market
 * @notice Configures DFI/USDC index market parameters in DataStore
 * @dev This script sets market configuration parameters and is idempotent (safe to rerun)
 *      Focus: Phase 3C-3D (Logic-Only) - Configuration only, no execution
 *      Run with: npx hardhat run scripts/configureIndexMarket.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import * as keys from "../utils/keys";
import { setUintIfDifferent } from "../utils/dataStore";
import { expandDecimals, decimalToFloat, exponentToFloat, percentageToFloat } from "../utils/math";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURE INDEX MARKET");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // =====================================================
  // STEP 1: Load Contracts and Find Market
  // =====================================================
  console.log("📦 Loading contracts and finding market...\n");

  const dataStore = await get("DataStore");
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  const indexToken = await get("IndexToken");

  // Load USDC address
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;

  console.log(`✅ DataStore: ${dataStore.address}`);
  console.log(`✅ IndexToken: ${indexToken.address}`);
  console.log(`✅ USDC: ${usdcAddress}\n`);

  // Find market
  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  const markets = await getOnchainMarkets(read, dataStore.address);
  const market = markets[marketKey];

  if (!market) {
    throw new Error(`Market not found for key: ${marketKey}`);
  }

  console.log(`✅ Market found: ${market.marketToken}\n`);

  // =====================================================
  // STEP 2: Load Current Configuration
  // =====================================================
  console.log("📊 Reading current configuration...\n");

  // Max Open Interest
  const maxOpenInterestLongKey = keys.maxOpenInterestKey(market.marketToken, true);
  const maxOpenInterestShortKey = keys.maxOpenInterestKey(market.marketToken, false);
  const currentMaxOpenInterestLong = await dataStoreContract.getUint(maxOpenInterestLongKey);
  const currentMaxOpenInterestShort = await dataStoreContract.getUint(maxOpenInterestShortKey);

  // Position Impact Factors
  const positivePositionImpactKey = keys.positionImpactFactorKey(market.marketToken, true);
  const negativePositionImpactKey = keys.positionImpactFactorKey(market.marketToken, false);
  const currentPositivePositionImpact = await dataStoreContract.getUint(positivePositionImpactKey);
  const currentNegativePositionImpact = await dataStoreContract.getUint(negativePositionImpactKey);

  // Funding Factor
  const fundingFactorKey = keys.fundingFactorKey(market.marketToken);
  const currentFundingFactor = await dataStoreContract.getUint(fundingFactorKey);

  // Min Collateral Factor (determines max leverage)
  const minCollateralFactorKey = keys.minCollateralFactorKey(market.marketToken);
  const currentMinCollateralFactor = await dataStoreContract.getUint(minCollateralFactorKey);

  console.log("Current Configuration:");
  console.log(`   Max Open Interest (Long):  ${hre.ethers.utils.formatEther(currentMaxOpenInterestLong)} USD`);
  console.log(`   Max Open Interest (Short): ${hre.ethers.utils.formatEther(currentMaxOpenInterestShort)} USD`);
  console.log(`   Positive Position Impact:  ${currentPositivePositionImpact.toString()}`);
  console.log(`   Negative Position Impact:   ${currentNegativePositionImpact.toString()}`);
  console.log(`   Funding Factor:             ${currentFundingFactor.toString()}`);
  console.log(
    `   Min Collateral Factor:      ${currentMinCollateralFactor.toString()} (Max Leverage: ${
      100 / parseFloat(hre.ethers.utils.formatEther(currentMinCollateralFactor))
    }x)\n`
  );

  // =====================================================
  // STEP 3: Define Target Configuration
  // =====================================================
  console.log("📝 Setting target configuration...\n");

  // Configuration values from config/markets.ts for DFI/USDC
  const targetConfig = {
    maxOpenInterest: decimalToFloat(50_000_000), // $50M
    positivePositionImpactFactor: exponentToFloat("4.5e-7"),
    negativePositionImpactFactor: exponentToFloat("5e-7"),
    fundingFactor: decimalToFloat(16, 7), // From fundingRateConfig_Low
    minCollateralFactor: percentageToFloat("0.5%"), // 200x leverage
  };

  // =====================================================
  // STEP 4: Apply Configuration
  // =====================================================
  console.log("⚙️  Applying configuration...\n");

  let configuredCount = 0;

  // Max Open Interest (same for long and short)
  await setUintIfDifferent(maxOpenInterestLongKey, targetConfig.maxOpenInterest, "maxOpenInterest (Long)");
  configuredCount++;
  console.log(`✅ Set Max Open Interest (Long): ${hre.ethers.utils.formatEther(targetConfig.maxOpenInterest)} USD`);

  await setUintIfDifferent(maxOpenInterestShortKey, targetConfig.maxOpenInterest, "maxOpenInterest (Short)");
  configuredCount++;
  console.log(`✅ Set Max Open Interest (Short): ${hre.ethers.utils.formatEther(targetConfig.maxOpenInterest)} USD`);

  // Position Impact Factors
  await setUintIfDifferent(
    positivePositionImpactKey,
    targetConfig.positivePositionImpactFactor,
    "positivePositionImpactFactor"
  );
  configuredCount++;
  console.log(`✅ Set Positive Position Impact Factor: ${targetConfig.positivePositionImpactFactor.toString()}`);

  await setUintIfDifferent(
    negativePositionImpactKey,
    targetConfig.negativePositionImpactFactor,
    "negativePositionImpactFactor"
  );
  configuredCount++;
  console.log(`✅ Set Negative Position Impact Factor: ${targetConfig.negativePositionImpactFactor.toString()}`);

  // Funding Factor
  await setUintIfDifferent(fundingFactorKey, targetConfig.fundingFactor, "fundingFactor");
  configuredCount++;
  console.log(`✅ Set Funding Factor: ${targetConfig.fundingFactor.toString()}`);

  // Min Collateral Factor (Max Leverage)
  await setUintIfDifferent(minCollateralFactorKey, targetConfig.minCollateralFactor, "minCollateralFactor");
  configuredCount++;
  const maxLeverage = 100 / parseFloat(hre.ethers.utils.formatEther(targetConfig.minCollateralFactor));
  console.log(
    `✅ Set Min Collateral Factor: ${targetConfig.minCollateralFactor.toString()} (Max Leverage: ${maxLeverage}x)\n`
  );

  // =====================================================
  // STEP 5: Verify Configuration
  // =====================================================
  console.log("🔍 Verifying configuration...\n");

  const finalMaxOpenInterestLong = await dataStoreContract.getUint(maxOpenInterestLongKey);
  const finalMaxOpenInterestShort = await dataStoreContract.getUint(maxOpenInterestShortKey);
  const finalPositivePositionImpact = await dataStoreContract.getUint(positivePositionImpactKey);
  const finalNegativePositionImpact = await dataStoreContract.getUint(negativePositionImpactKey);
  const finalFundingFactor = await dataStoreContract.getUint(fundingFactorKey);
  const finalMinCollateralFactor = await dataStoreContract.getUint(minCollateralFactorKey);

  console.log("Final Configuration:");
  console.log(`   Max Open Interest (Long):  ${hre.ethers.utils.formatEther(finalMaxOpenInterestLong)} USD`);
  console.log(`   Max Open Interest (Short): ${hre.ethers.utils.formatEther(finalMaxOpenInterestShort)} USD`);
  console.log(`   Positive Position Impact:  ${finalPositivePositionImpact.toString()}`);
  console.log(`   Negative Position Impact:  ${finalNegativePositionImpact.toString()}`);
  console.log(`   Funding Factor:            ${finalFundingFactor.toString()}`);
  console.log(
    `   Min Collateral Factor:      ${finalMinCollateralFactor.toString()} (Max Leverage: ${
      100 / parseFloat(hre.ethers.utils.formatEther(finalMinCollateralFactor))
    }x)\n`
  );

  // =====================================================
  // STEP 6: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ CONFIGURATION COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`📊 Configured ${configuredCount} parameters`);
  console.log(`📝 Market: ${market.marketToken}`);
  console.log(`📝 Market Key: ${marketKey}\n`);

  console.log("📝 Next Steps:");
  console.log("   1. Run openIndexPosition.ts to create orders");
  console.log("   2. Run inspectIndexState.ts to view market state");
  console.log("   3. Run calcIndexPnL.ts to verify PnL calculations\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
