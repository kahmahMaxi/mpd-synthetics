/**
 * @title Open Position
 * @notice Opens a LONG position on WETH-USD market
 * @dev Run with: npx hardhat run scripts/openPosition.ts --network localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
import { ethers } from "ethers";
import { expandDecimals, decimalToFloat, bigNumberify } from "../utils/math";
import { OrderType, DecreasePositionSwapType } from "../utils/order";
import { getPositionKey } from "../utils/position";
import * as keys from "../utils/keys";
import { getOracleParams } from "../utils/oracle";
import {
  loadTokenConfig,
  loadMarketConfig,
  getMarketAddress,
  getTokenAddress,
  formatUsd,
  formatTokenAmount,
  oraclePriceToAcceptablePrice,
  resolveOraclePrice,
} from "./helpers/marketUtils";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" OPEN LONG POSITION - WETH-USD MARKET");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { get, read } = hre.deployments;
  const [testUser] = await hre.ethers.getSigners();

  console.log(`Test User: ${testUser.address}\n`);

  // ============================================================================
  // STEP 1: Load Contracts
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 1: LOAD DEPLOYED CONTRACTS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const exchangeRouter = await get("ExchangeRouter");
  const exchangeRouterContract = await hre.ethers.getContractAt("ExchangeRouter", exchangeRouter.address);
  const dataStore = await get("DataStore");
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  const reader = await get("Reader");
  const readerContract = await hre.ethers.getContractAt("Reader", reader.address);
  const orderVault = await get("OrderVault");
  const orderHandler = await get("OrderHandler");
  const oracle = await get("Oracle");

  console.log(`✅ ExchangeRouter: ${exchangeRouter.address}`);
  console.log(`✅ DataStore: ${dataStore.address}`);
  console.log(`✅ Reader: ${reader.address}`);
  console.log(`✅ OrderVault: ${orderVault.address}`);
  console.log(`✅ OrderHandler: ${orderHandler.address}`);
  console.log(`✅ Oracle: ${oracle.address}\n`);

  // ============================================================================
  // STEP 2: Load Market and Token Configs
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 2: LOAD MARKET AND TOKEN CONFIGS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const marketConfig = loadMarketConfig("WETH-USD");
  const wethConfig = loadTokenConfig(marketConfig.longTokenSymbol);
  const usdcConfig = loadTokenConfig(marketConfig.shortTokenSymbol);

  const marketAddress = getMarketAddress(marketConfig);
  const wethAddress = getTokenAddress(wethConfig);
  const usdcAddress = getTokenAddress(usdcConfig);

  console.log(`✅ Market: ${marketConfig.marketTokenSymbol} at ${marketAddress}`);
  console.log(`✅ Long Token (WETH): ${wethAddress} (${wethConfig.decimals} decimals)`);
  console.log(`✅ Short Token (USDC): ${usdcAddress} (${usdcConfig.decimals} decimals)\n`);

  // ============================================================================
  // STEP 3: Set Oracle Prices
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 3: SET ORACLE PRICES");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  try {
    // Get price feeds
    const wethPriceFeed = await hre.deployments.get("WETHPriceFeed");
    const usdcPriceFeed = await hre.deployments.get("USDCPriceFeed");

    const wethFeedContract = await hre.ethers.getContractAt(
      "contracts/oracle/MockPriceFeed.sol:MockPriceFeed",
      wethPriceFeed.address
    );
    const usdcFeedContract = await hre.ethers.getContractAt(
      "contracts/oracle/MockPriceFeed.sol:MockPriceFeed",
      usdcPriceFeed.address
    );

    // Set prices
    const wethPrice = resolveOraclePrice(2400); // $2400
    const usdcPrice = resolveOraclePrice(1); // $1

    const [deployer] = await hre.ethers.getSigners();
    await wethFeedContract.connect(deployer).setPrice(wethPrice);
    await usdcFeedContract.connect(deployer).setPrice(usdcPrice);

    console.log(`✅ Set WETH price: $2400 (${wethPrice.toString()} in 8-decimal format)`);
    console.log(`✅ Set USDC price: $1 (${usdcPrice.toString()} in 8-decimal format)\n`);
  } catch (error) {
    console.warn(`⚠️  Could not set oracle prices:`, error);
    console.log(`   Continuing with existing prices...\n`);
  }

  // ============================================================================
  // STEP 4: Fund Test User
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 4: FUND TEST USER");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const usdcContract = await hre.ethers.getContractAt("MintableToken", usdcAddress);
  const collateralAmount = expandDecimals(100000, usdcConfig.decimals); // 100,000 USDC

  await usdcContract.mint(testUser.address, collateralAmount);
  console.log(`✅ Minted ${formatTokenAmount(collateralAmount, usdcConfig.decimals)} USDC to test user`);

  // Approve ExchangeRouter
  await usdcContract.connect(testUser).approve(exchangeRouter.address, collateralAmount);
  console.log(`✅ Approved ExchangeRouter to spend USDC\n`);

  // ============================================================================
  // STEP 5: Create Order
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 5: CREATE LONG ORDER");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const sizeDeltaUsd = decimalToFloat(1000); // $1000 position size
  const collateralUsd = decimalToFloat(100); // $100 collateral
  const collateralAmountTokens = expandDecimals(100, usdcConfig.decimals); // 100 USDC
  const executionFee = expandDecimals(1, 15); // 0.001 ETH
  const acceptablePrice = oraclePriceToAcceptablePrice(resolveOraclePrice(2900), wethConfig.decimals); // $2900 with slippage tolerance

  console.log(`Order Parameters:`);
  console.log(`  Market: ${marketConfig.marketTokenSymbol}`);
  console.log(`  Position Size: $${formatUsd(sizeDeltaUsd)}`);
  console.log(`  Collateral: $${formatUsd(collateralUsd)} (${formatTokenAmount(collateralAmountTokens, usdcConfig.decimals)} USDC)`);
  console.log(`  Acceptable Price: $2900 (${acceptablePrice.toString()})`);
  console.log(`  Execution Fee: ${formatTokenAmount(executionFee, 18)} ETH\n`);

  const orderParams = {
    addresses: {
      receiver: testUser.address,
      cancellationReceiver: hre.ethers.constants.AddressZero,
      callbackContract: hre.ethers.constants.AddressZero,
      uiFeeReceiver: hre.ethers.constants.AddressZero,
      market: marketAddress,
      initialCollateralToken: usdcAddress,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd,
      initialCollateralDeltaAmount: collateralAmountTokens,
      triggerPrice: 0,
      acceptablePrice,
      executionFee,
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType: OrderType.MarketIncrease,
    decreasePositionSwapType: DecreasePositionSwapType.NoSwap,
    isLong: true,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: hre.ethers.constants.HashZero,
    dataList: [],
  };

  // Send execution fee and collateral to OrderVault
  const wnt = await hre.ethers.getContractAt("WNT", await get("WETH").then((w) => w.address));
  await wnt.connect(testUser).deposit({ value: executionFee });
  await wnt.connect(testUser).transfer(orderVault.address, executionFee);

  // Send collateral to OrderVault
  await usdcContract.connect(testUser).transfer(orderVault.address, collateralAmountTokens);

  console.log(`✅ Sent execution fee and collateral to OrderVault`);

  // Create order via ExchangeRouter
  const createTx = await exchangeRouterContract.connect(testUser).createOrder(orderParams);
  const createReceipt = await createTx.wait();

  // Extract order key from events
  const orderCreatedEvent = createReceipt.events?.find((e: any) => e.event === "OrderCreated");
  const orderKey = orderCreatedEvent?.args?.key;

  if (!orderKey) {
    throw new Error("Order key not found in events");
  }

  console.log(`✅ Order created: ${orderKey}\n`);

  // ============================================================================
  // STEP 6: Execute Order
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 6: EXECUTE ORDER");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const orderHandlerContract = await hre.ethers.getContractAt("OrderHandler", orderHandler.address);

  // Set prices in Oracle for execution
  // For local development with mock feeds, we use setPrices with the feed addresses
  const oracleContract = await hre.ethers.getContractAt("Oracle", oracle.address);

  // For order execution, we need to set prices in Oracle first
  // Then execute via OrderHandler (requires ORDER_KEEPER role)
  const [deployer] = await hre.ethers.getSigners();

  // Use ChainlinkPriceFeedProvider to get properly converted prices
  // This will read from our mock feeds via DataStore and convert to 30-decimal format
  const chainlinkProvider = await get("ChainlinkPriceFeedProvider");
  const chainlinkProviderContract = await hre.ethers.getContractAt(
    "ChainlinkPriceFeedProvider",
    chainlinkProvider.address
  );

  // Get oracle prices using the provider (this handles conversion automatically)
  const wethOraclePrice = await chainlinkProviderContract.getOraclePrice(wethAddress, "0x");
  const usdcOraclePrice = await chainlinkProviderContract.getOraclePrice(usdcAddress, "0x");

  console.log(`✅ Retrieved prices from ChainlinkPriceFeedProvider:`);
  console.log(`   WETH: min=${formatUsd(wethOraclePrice.price.min)}, max=${formatUsd(wethOraclePrice.price.max)}`);
  console.log(`   USDC: min=${formatUsd(usdcOraclePrice.price.min)}, max=${formatUsd(usdcOraclePrice.price.max)}\n`);

  // Set prices in Oracle using setPrimaryPrice (requires CONTROLLER role)
  const wethPriceProps = {
    min: wethOraclePrice.price.min,
    max: wethOraclePrice.price.max,
  };
  const usdcPriceProps = {
    min: usdcOraclePrice.price.min,
    max: usdcOraclePrice.price.max,
  };

  await oracleContract.connect(deployer).setPrimaryPrice(wethAddress, wethPriceProps);
  await oracleContract.connect(deployer).setPrimaryPrice(usdcAddress, usdcPriceProps);
  console.log(`✅ Set oracle prices for execution`);

  // Prepare oracle params for order execution
  // Since we're using ChainlinkPriceFeedProvider (on-chain provider), we can use priceFeedTokens
  // This tells executeOrder to read prices directly from the feeds (no signatures needed)
  const currentBlock = await hre.ethers.provider.getBlock("latest");
  const oracleBlockNumber = currentBlock.number;
  const oracleTimestamp = currentBlock.timestamp;

  // Use priceFeedTokens to indicate both tokens use ChainlinkPriceFeedProvider
  // This allows executeOrder to read prices directly from feeds without signatures
  // We still need to provide minimal params for the non-priceFeed tokens (empty array)
  const executeOracleParams = await getOracleParams({
    oracleSalt: hre.ethers.constants.HashZero,
    minOracleBlockNumbers: [],
    maxOracleBlockNumbers: [],
    oracleTimestamps: [],
    blockHashes: [],
    signerIndexes: [],
    tokens: [],
    tokenOracleTypes: [],
    precisions: [],
    minPrices: [],
    maxPrices: [],
    signers: [],
    dataStreamTokens: [],
    dataStreamData: [],
    priceFeedTokens: [wethAddress, usdcAddress], // Both use ChainlinkPriceFeedProvider
  });

  try {
    console.log(`   Executing order as keeper...`);
    const executeTx = await orderHandlerContract.connect(deployer).executeOrder(orderKey, executeOracleParams);
    const executeReceipt = await executeTx.wait();
    console.log(`✅ Order executed successfully!\n`);
  } catch (error: any) {
    console.error(`❌ Order execution failed:`, error.message);
    console.log(`\n⚠️  Note: Order execution requires ORDER_KEEPER role.`);
    console.log(`   The order has been created and is pending execution.`);
    console.log(`   Order Key: ${orderKey}\n`);
    return;
  }

  // ============================================================================
  // STEP 7: Verify Position
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 7: VERIFY POSITION");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const positionKey = getPositionKey(testUser.address, marketAddress, usdcAddress, true);

  try {
    const position = await readerContract.getPosition(dataStore.address, positionKey);

    if (position.sizeInUsd.gt(0)) {
      console.log(`✅ Position found!\n`);
      console.log(`Position Details:`);
      console.log(`  Account: ${testUser.address}`);
      console.log(`  Market: ${marketConfig.marketTokenSymbol}`);
      console.log(`  Size (USD): $${formatUsd(position.sizeInUsd)}`);
      console.log(`  Collateral (USD): $${formatUsd(position.collateralAmount)}`);
      console.log(`  Entry Price: $${formatUsd(position.entryPrice)}`);
      console.log(`  Is Long: ${position.isLong}\n`);
    } else {
      console.log(`⚠️  Position size is zero\n`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not read position:`, error);
  }

  // ============================================================================
  // STEP 8: Check Open Interest
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 8: CHECK OPEN INTEREST");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  try {
    const longOpenInterestKey = keys.openInterestKey(marketAddress, wethAddress, true);
    const shortOpenInterestKey = keys.openInterestKey(marketAddress, usdcAddress, false);

    const longOI = await dataStoreContract.getUint(longOpenInterestKey);
    const shortOI = await dataStoreContract.getUint(shortOpenInterestKey);

    console.log(`Open Interest:`);
    console.log(`  Long OI: $${formatUsd(longOI)}`);
    console.log(`  Short OI: $${formatUsd(shortOI)}\n`);
  } catch (error) {
    console.warn(`⚠️  Could not read open interest:`, error);
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ POSITION OPENED!");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`📊 Summary:`);
  console.log(`   Market: ${marketConfig.marketTokenSymbol}`);
  console.log(`   Order Key: ${orderKey}`);
  console.log(`   Position Size: $${formatUsd(sizeDeltaUsd)}`);
  console.log(`   Collateral: $${formatUsd(collateralUsd)}`);
  console.log(`   Direction: LONG\n`);

  console.log("══════════════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

