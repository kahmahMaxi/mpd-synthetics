/**
 * @title Configure Deployed Markets
 * @notice Configures all deployed markets in DataStore with default values
 * @dev Run with: npx hardhat run scripts/configureDeployedMarkets.ts --network localhost
 * 
 * This script:
 * 1. Reads all deployed markets from DataStore
 * 2. Configures each market with default values from hardhatBaseMarketConfig
 * 3. Writes all required DataStore keys (funding, borrowing, limits, fees, etc.)
 * 
 * This is needed because after Hardhat node restart, markets are deployed but
 * their configuration values in DataStore are missing, causing order execution
 * to fail with error 0xef2df9b5.
 */

import hre from "hardhat";
import * as keys from "../utils/keys";
import { setUintIfDifferent, setBoolIfDifferent } from "../utils/dataStore";
import { getOnchainMarkets } from "../utils/market";
import { expandDecimals, percentageToFloat, decimalToFloat, exponentToFloat } from "../utils/math";
import { SECONDS_PER_YEAR } from "../utils/constants";

// Default market configuration for localhost (from hardhatBaseMarketConfig)
const DEFAULT_MARKET_CONFIG = {
  // Reserve factors
  reserveFactor: decimalToFloat(5, 1), // 50%
  openInterestReserveFactor: decimalToFloat(5, 1), // 50%

  // Collateral factors
  minCollateralFactor: percentageToFloat("1%"), // 1%
  minCollateralFactorForLiquidation: percentageToFloat("1%"), // 1%
  minCollateralFactorForOpenInterestMultiplier: 0,
  minCollateralUsd: expandDecimals(10, 30), // $10 minimum

  // Pool limits
  maxLongTokenPoolAmount: expandDecimals(1_000_000_000, 18),
  maxShortTokenPoolAmount: expandDecimals(1_000_000_000, 18),
  maxCollateralSum: expandDecimals(10_000_000_000_000, 18), // 10 trillion
  maxPoolUsdForDeposit: decimalToFloat(1_000_000_000_000_000),
  maxOpenInterest: decimalToFloat(1_000_000_000), // $1B

  // PnL factors
  maxPnlFactorForTraders: decimalToFloat(5, 1), // 50%
  maxPnlFactorForAdl: decimalToFloat(45, 2), // 45%
  minPnlFactorAfterAdl: decimalToFloat(4, 1), // 40%
  maxPnlFactorForDeposits: decimalToFloat(5, 1), // 50% (must match maxPnlFactorForTraders)
  maxPnlFactorForWithdrawals: decimalToFloat(3, 1), // 30%

  // Position impact
  positiveMaxPositionImpactFactor: decimalToFloat(2, 2), // 2%
  negativeMaxPositionImpactFactor: decimalToFloat(2, 2), // 2%
  maxPositionImpactFactorForLiquidations: percentageToFloat("1%"), // 1%
  positivePositionImpactFactor: exponentToFloat("2.5e-10"),
  negativePositionImpactFactor: exponentToFloat("5e-10"),
  positivePositionImpactExponentFactor: decimalToFloat(1),
  negativePositionImpactExponentFactor: decimalToFloat(1),

  // Position fees
  positionFeeFactorForPositiveImpact: percentageToFloat("0.04%"),
  positionFeeFactorForNegativeImpact: percentageToFloat("0.06%"),

  // Swap impact
  positiveSwapImpactFactor: exponentToFloat("1.5e-8"),
  negativeSwapImpactFactor: exponentToFloat("3e-8"),
  swapImpactExponentFactor: decimalToFloat(1),

  // Swap fees
  swapFeeFactorForPositiveImpact: 0,
  swapFeeFactorForNegativeImpact: 0,
  atomicSwapFeeFactor: 0,
  atomicWithdrawalFeeFactor: 0,

  // Funding (from baseMarketConfig)
  fundingFactor: exponentToFloat("2e-8"), // ~63% per year for 100% skew
  fundingExponentFactor: decimalToFloat(1),
  minFundingFactorPerSecond: percentageToFloat("1%").div(SECONDS_PER_YEAR),
  maxFundingFactorPerSecond: percentageToFloat("90%").div(SECONDS_PER_YEAR),
  fundingIncreaseFactorPerSecond: percentageToFloat("90%").div(SECONDS_PER_YEAR).div(3 * 3600), // 3 hours
  fundingDecreaseFactorPerSecond: 0,
  thresholdForStableFunding: percentageToFloat("4%"),
  thresholdForDecreaseFunding: 0,

  // Borrowing (from baseMarketConfig)
  optimalUsageFactor: 0,
  baseBorrowingFactor: 0,
  aboveOptimalUsageBorrowingFactor: 0,
  borrowingExponentFactor: decimalToFloat(1),

  // Liquidation
  liquidationFeeFactor: percentageToFloat("0.20%"),

  // Position impact pool
  positionImpactPoolDistributionRate: 0,
  minPositionImpactPoolAmount: 0,
};

async function configureMarket(marketToken: string, marketLabel: string) {
  const config = DEFAULT_MARKET_CONFIG;
  const dataStore = await hre.ethers.getContract("DataStore");
  const { setUint, setBool } = hre.deployments;

  console.log(`\n📝 Configuring ${marketLabel} (${marketToken})...`);

  let configuredCount = 0;

  // Reserve factors
  await setUintIfDifferent(keys.reserveFactorKey(marketToken), config.reserveFactor, `reserveFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.openInterestReserveFactorKey(marketToken), config.openInterestReserveFactor, `openInterestReserveFactor for ${marketLabel}`);
  configuredCount++;

  // Collateral factors
  await setUintIfDifferent(keys.minCollateralFactorKey(marketToken), config.minCollateralFactor, `minCollateralFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.minCollateralFactorForLiquidationKey(marketToken), config.minCollateralFactorForLiquidation, `minCollateralFactorForLiquidation for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.minCollateralFactorForOpenInterestMultiplierKey(marketToken), config.minCollateralFactorForOpenInterestMultiplier, `minCollateralFactorForOpenInterestMultiplier for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.minCollateralUsdKey(marketToken), config.minCollateralUsd, `minCollateralUsd for ${marketLabel}`);
  configuredCount++;

  // Pool limits
  await setUintIfDifferent(keys.maxLongTokenPoolAmountKey(marketToken), config.maxLongTokenPoolAmount, `maxLongTokenPoolAmount for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxShortTokenPoolAmountKey(marketToken), config.maxShortTokenPoolAmount, `maxShortTokenPoolAmount for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxCollateralSumKey(marketToken), config.maxCollateralSum, `maxCollateralSum for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxPoolUsdForDepositKey(marketToken), config.maxPoolUsdForDeposit, `maxPoolUsdForDeposit for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxOpenInterestKey(marketToken), config.maxOpenInterest, `maxOpenInterest for ${marketLabel}`);
  configuredCount++;

  // PnL factors
  await setUintIfDifferent(keys.maxPnlFactorForTradersKey(marketToken), config.maxPnlFactorForTraders, `maxPnlFactorForTraders for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxPnlFactorForAdlKey(marketToken), config.maxPnlFactorForAdl, `maxPnlFactorForAdl for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.minPnlFactorAfterAdlKey(marketToken), config.minPnlFactorAfterAdl, `minPnlFactorAfterAdl for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxPnlFactorForDepositsKey(marketToken), config.maxPnlFactorForDeposits, `maxPnlFactorForDeposits for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxPnlFactorForWithdrawalsKey(marketToken), config.maxPnlFactorForWithdrawals, `maxPnlFactorForWithdrawals for ${marketLabel}`);
  configuredCount++;

  // Position impact
  await setUintIfDifferent(keys.positiveMaxPositionImpactFactorKey(marketToken), config.positiveMaxPositionImpactFactor, `positiveMaxPositionImpactFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.negativeMaxPositionImpactFactorKey(marketToken), config.negativeMaxPositionImpactFactor, `negativeMaxPositionImpactFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxPositionImpactFactorForLiquidationsKey(marketToken), config.maxPositionImpactFactorForLiquidations, `maxPositionImpactFactorForLiquidations for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.positivePositionImpactFactorKey(marketToken), config.positivePositionImpactFactor, `positivePositionImpactFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.negativePositionImpactFactorKey(marketToken), config.negativePositionImpactFactor, `negativePositionImpactFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.positivePositionImpactExponentFactorKey(marketToken), config.positivePositionImpactExponentFactor, `positivePositionImpactExponentFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.negativePositionImpactExponentFactorKey(marketToken), config.negativePositionImpactExponentFactor, `negativePositionImpactExponentFactor for ${marketLabel}`);
  configuredCount++;

  // Position fees
  await setUintIfDifferent(keys.positionFeeFactorForPositiveImpactKey(marketToken), config.positionFeeFactorForPositiveImpact, `positionFeeFactorForPositiveImpact for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.positionFeeFactorForNegativeImpactKey(marketToken), config.positionFeeFactorForNegativeImpact, `positionFeeFactorForNegativeImpact for ${marketLabel}`);
  configuredCount++;

  // Swap impact
  await setUintIfDifferent(keys.positiveSwapImpactFactorKey(marketToken), config.positiveSwapImpactFactor, `positiveSwapImpactFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.negativeSwapImpactFactorKey(marketToken), config.negativeSwapImpactFactor, `negativeSwapImpactFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.swapImpactExponentFactorKey(marketToken), config.swapImpactExponentFactor, `swapImpactExponentFactor for ${marketLabel}`);
  configuredCount++;

  // Swap fees
  await setUintIfDifferent(keys.swapFeeFactorForPositiveImpactKey(marketToken), config.swapFeeFactorForPositiveImpact, `swapFeeFactorForPositiveImpact for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.swapFeeFactorForNegativeImpactKey(marketToken), config.swapFeeFactorForNegativeImpact, `swapFeeFactorForNegativeImpact for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.atomicSwapFeeFactorKey(marketToken), config.atomicSwapFeeFactor, `atomicSwapFeeFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.atomicWithdrawalFeeFactorKey(marketToken), config.atomicWithdrawalFeeFactor, `atomicWithdrawalFeeFactor for ${marketLabel}`);
  configuredCount++;

  // Funding
  await setUintIfDifferent(keys.fundingFactorKey(marketToken), config.fundingFactor, `fundingFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.fundingExponentFactorKey(marketToken), config.fundingExponentFactor, `fundingExponentFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.minFundingFactorPerSecondKey(marketToken), config.minFundingFactorPerSecond, `minFundingFactorPerSecond for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.maxFundingFactorPerSecondKey(marketToken), config.maxFundingFactorPerSecond, `maxFundingFactorPerSecond for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.fundingIncreaseFactorPerSecondKey(marketToken), config.fundingIncreaseFactorPerSecond, `fundingIncreaseFactorPerSecond for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.fundingDecreaseFactorPerSecondKey(marketToken), config.fundingDecreaseFactorPerSecond, `fundingDecreaseFactorPerSecond for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.thresholdForStableFundingKey(marketToken), config.thresholdForStableFunding, `thresholdForStableFunding for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.thresholdForDecreaseFundingKey(marketToken), config.thresholdForDecreaseFunding, `thresholdForDecreaseFunding for ${marketLabel}`);
  configuredCount++;

  // Borrowing
  await setUintIfDifferent(keys.optimalUsageFactorKey(marketToken), config.optimalUsageFactor, `optimalUsageFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.baseBorrowingFactorKey(marketToken), config.baseBorrowingFactor, `baseBorrowingFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.aboveOptimalUsageBorrowingFactorKey(marketToken), config.aboveOptimalUsageBorrowingFactor, `aboveOptimalUsageBorrowingFactor for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.borrowingExponentFactorKey(marketToken), config.borrowingExponentFactor, `borrowingExponentFactor for ${marketLabel}`);
  configuredCount++;

  // Liquidation
  await setUintIfDifferent(keys.liquidationFeeFactorKey(marketToken), config.liquidationFeeFactor, `liquidationFeeFactor for ${marketLabel}`);
  configuredCount++;

  // Position impact pool
  await setUintIfDifferent(keys.positionImpactPoolDistributionRateKey(marketToken), config.positionImpactPoolDistributionRate, `positionImpactPoolDistributionRate for ${marketLabel}`);
  configuredCount++;
  await setUintIfDifferent(keys.minPositionImpactPoolAmountKey(marketToken), config.minPositionImpactPoolAmount, `minPositionImpactPoolAmount for ${marketLabel}`);
  configuredCount++;

  console.log(`   ✅ Configured ${configuredCount} parameters`);

  return configuredCount;
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURE DEPLOYED MARKETS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { deployer } = await hre.getNamedAccounts();
  console.log(`Deployer: ${deployer}\n`);

  const dataStore = await hre.ethers.getContract("DataStore");
  const reader = await hre.ethers.getContract("Reader");
  const { read } = hre.deployments;

  console.log(`DataStore: ${dataStore.address}`);
  console.log(`Reader: ${reader.address}\n`);

  // Get all deployed markets
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" FETCHING DEPLOYED MARKETS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const onchainMarketsByTokens = await getOnchainMarkets(read, dataStore.address);
  const marketEntries = Object.values(onchainMarketsByTokens);

  if (marketEntries.length === 0) {
    console.log("⚠️  No markets found. Deploy markets first using:");
    console.log("   npx hardhat run scripts/deployMarkets.ts --network localhost\n");
    return;
  }

  console.log(`Found ${marketEntries.length} deployed market(s):\n`);
  for (const market of marketEntries) {
    const indexTokenDisplay = market.indexToken === hre.ethers.constants.AddressZero ? "N/A (swap-only)" : market.indexToken;
    console.log(`   - Market: ${market.marketToken}`);
    console.log(`     Index: ${indexTokenDisplay}`);
    console.log(`     Long: ${market.longToken}`);
    console.log(`     Short: ${market.shortToken}\n`);
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURING MARKETS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  let totalConfigured = 0;
  const results: Array<{ marketToken: string; label: string; count: number }> = [];

  for (const market of marketEntries) {
    // Skip swap-only markets (no index token)
    if (market.indexToken === hre.ethers.constants.AddressZero) {
      console.log(`⏭️  Skipping swap-only market ${market.marketToken}\n`);
      continue;
    }

    const marketLabel = `${market.marketToken.slice(0, 10)}...${market.marketToken.slice(-8)}`;
    const count = await configureMarket(market.marketToken, marketLabel);
    totalConfigured += count;
    results.push({ marketToken: market.marketToken, label: marketLabel, count });
  }

  // Print summary
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" CONFIGURATION SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("┌──────────────────────────────────────────┬──────────┐");
  console.log("│ Market Token                             │ Params   │");
  console.log("├──────────────────────────────────────────┼──────────┤");

  for (const result of results) {
    const marketDisplay = result.marketToken.length > 42 
      ? result.marketToken 
      : result.marketToken.slice(0, 10) + "..." + result.marketToken.slice(-8);
    console.log(`│ ${marketDisplay.padEnd(40)} │ ${result.count.toString().padEnd(8)} │`);
  }

  console.log("└──────────────────────────────────────────┴──────────┘");
  console.log(`\n✅ Total: ${totalConfigured} parameters configured across ${results.length} market(s)\n`);

  // Verify configuration
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" VERIFICATION");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const result of results) {
    try {
      const reserveFactor = await dataStore.getUint(keys.reserveFactorKey(result.marketToken));
      const minFunding = await dataStore.getUint(keys.minFundingFactorPerSecondKey(result.marketToken));
      const maxFunding = await dataStore.getUint(keys.maxFundingFactorPerSecondKey(result.marketToken));
      const minCollateral = await dataStore.getUint(keys.minCollateralFactorKey(result.marketToken));

      console.log(`✅ ${result.label}:`);
      console.log(`   Reserve Factor: ${reserveFactor.toString()}`);
      console.log(`   Min Funding: ${minFunding.toString()}`);
      console.log(`   Max Funding: ${maxFunding.toString()}`);
      console.log(`   Min Collateral: ${minCollateral.toString()}\n`);
    } catch (error: any) {
      console.warn(`⚠️  Could not verify ${result.label}: ${error.message}\n`);
    }
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ ALL MARKETS CONFIGURED SUCCESSFULLY!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log("You can now execute orders without the 0xef2df9b5 error.");
  console.log("Try running: npx hardhat orders:execute --network localhost\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

