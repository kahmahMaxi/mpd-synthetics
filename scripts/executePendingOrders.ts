/**
 * @title Execute Pending Orders
 * @notice Executes all pending orders in the system
 * @dev Run with: npx hardhat orders:execute --network localhost
 */

import hre from "hardhat";
import { getOrderKeys } from "../utils/order";
import { getOracleParams } from "../utils/oracle";
import * as keys from "../utils/keys";
import { parseError, getErrorString } from "../utils/error";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" EXECUTE PENDING ORDERS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { get } = hre.deployments;
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Keeper: ${deployer.address}\n`);

  // Load contracts
  const exchangeRouter = await get("ExchangeRouter");
  const exchangeRouterContract = await hre.ethers.getContractAt("ExchangeRouter", exchangeRouter.address);
  const dataStore = await get("DataStore");
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  const reader = await get("Reader");
  const readerContract = await hre.ethers.getContractAt("Reader", reader.address);

  console.log(`ExchangeRouter: ${exchangeRouter.address}`);
  console.log(`DataStore: ${dataStore.address}`);
  console.log(`Reader: ${reader.address}\n`);

  // Get all pending orders
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" FETCHING PENDING ORDERS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const orderKeys = await getOrderKeys(dataStoreContract, 0, 100); // Get up to 100 orders

  if (orderKeys.length === 0) {
    console.log("ℹ️  No pending orders found.\n");
    return;
  }

  console.log(`Found ${orderKeys.length} pending order(s)\n`);

  // Get order details and execute
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" EXECUTING ORDERS");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const executedOrders: Array<{
    key: string;
    type: string;
    market: string;
    status: string;
    error?: string;
  }> = [];

  for (let i = 0; i < orderKeys.length; i++) {
    const orderKey = orderKeys[i];
    console.log(`\n[${i + 1}/${orderKeys.length}] Processing order: ${orderKey}`);

    // Initialize variables for error handling
    let orderTypeName = "Unknown";
    let marketAddress = "Unknown";

    try {
      // Get order details
      const order = await readerContract.getOrder(dataStore.address, orderKey);
      
      // Get order type name
      const orderTypeNames: { [key: number]: string } = {
        0: "MarketSwap",
        1: "LimitSwap",
        2: "MarketIncrease",
        3: "LimitIncrease",
        4: "MarketDecrease",
        5: "LimitDecrease",
        6: "StopLossDecrease",
        7: "Liquidation",
        8: "StopIncrease",
      };
      const orderType = Number(order.numbers.orderType);
      orderTypeName = orderTypeNames[orderType] || `Type${orderType}`;

      // Get market address
      marketAddress = order.addresses.market;
      
      console.log(`  Type: ${orderTypeName}`);
      console.log(`  Market: ${marketAddress}`);
      console.log(`  Account: ${order.addresses.account}`);
      console.log(`  Is Long: ${order.flags.isLong}`);

      // Get market to find tokens
      const market = await readerContract.getMarket(dataStore.address, marketAddress);
      const indexToken = market.indexToken;
      const longToken = market.longToken;
      const shortToken = market.shortToken;

      console.log(`  Index Token: ${indexToken}`);
      console.log(`  Long Token: ${longToken}`);
      console.log(`  Short Token: ${shortToken}`);

      // Prepare oracle params for execution
      // For ChainlinkPriceFeedProvider, we use priceFeedTokens
      // We need both index token and collateral token prices
      const priceFeedTokens: string[] = [];

      // Add index token (always needed for position orders)
      if (indexToken !== hre.ethers.constants.AddressZero) {
        priceFeedTokens.push(indexToken);
      }

      // Add collateral token
      if (order.addresses.initialCollateralToken !== hre.ethers.constants.AddressZero) {
        if (!priceFeedTokens.includes(order.addresses.initialCollateralToken)) {
          priceFeedTokens.push(order.addresses.initialCollateralToken);
        }
      }

      // Also add long/short tokens if they're different
      if (longToken !== hre.ethers.constants.AddressZero && !priceFeedTokens.includes(longToken)) {
        priceFeedTokens.push(longToken);
      }
      if (shortToken !== hre.ethers.constants.AddressZero && !priceFeedTokens.includes(shortToken)) {
        priceFeedTokens.push(shortToken);
      }

      console.log(`  Price Feed Tokens: ${priceFeedTokens.join(", ")}`);

      // Set prices in Oracle if not already set (needed for execution)
      const oracle = await get("Oracle");
      const oracleContract = await hre.ethers.getContractAt("Oracle", oracle.address);
      const chainlinkProvider = await get("ChainlinkPriceFeedProvider");
      const chainlinkProviderContract = await hre.ethers.getContractAt(
        "ChainlinkPriceFeedProvider",
        chainlinkProvider.address
      );

      // Get prices from ChainlinkPriceFeedProvider and set in Oracle
      for (const token of priceFeedTokens) {
        try {
          // Check if price is already set
          try {
            await oracleContract.getPrimaryPrice(token);
            // Price already set, skip
          } catch (e) {
            // Price not set, get from provider and set it
            const oraclePrice = await chainlinkProviderContract.getOraclePrice(token, "0x");
            const priceProps = {
              min: oraclePrice.min,
              max: oraclePrice.max,
            };
            try {
              await oracleContract.connect(deployer).setPrimaryPrice(token, priceProps);
              console.log(`  ✅ Set price for ${token}`);
            } catch (setError: any) {
              // Price might already be set by another process, ignore
              if (!setError.message.includes("PriceAlreadySet")) {
                console.log(`  ⚠️  Could not set price for ${token}: ${setError.message}`);
              }
            }
          }
        } catch (e) {
          // Ignore errors when checking/setting prices
        }
      }

      // Create minimal oracle params using priceFeedTokens
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
        priceFeedTokens: priceFeedTokens,
      });

      // Execute order via OrderHandler (ExchangeRouter doesn't have executeOrder)
      const orderHandler = await get("OrderHandler");
      const orderHandlerContract = await hre.ethers.getContractAt("OrderHandler", orderHandler.address);

      console.log(`  Executing...`);
      const executeTx = await orderHandlerContract.connect(deployer).executeOrder(orderKey, executeOracleParams, {
        gasLimit: 4_000_000,
      });
      const executeReceipt = await executeTx.wait();

      console.log(`  ✅ SUCCESS - Transaction: ${executeReceipt.transactionHash}`);

      executedOrders.push({
        key: orderKey,
        type: orderTypeName,
        market: marketAddress,
        status: "SUCCESS",
      });
    } catch (error: any) {
      // Try to parse the error for better debugging
      let errorMessage = error.message;
      if (error.data || error.reason) {
        try {
          const parsedError = parseError(error.data || error.reason, false);
          if (parsedError) {
            errorMessage = getErrorString(parsedError);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      console.error(`  ❌ FAILED: ${errorMessage}`);
      executedOrders.push({
        key: orderKey,
        type: orderTypeName || "Unknown",
        market: marketAddress || "Unknown",
        status: "FAILED",
        error: errorMessage,
      });
    }
  }

  // Print summary
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" EXECUTION SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  if (executedOrders.length === 0) {
    console.log("No orders processed.\n");
    return;
  }

  console.log("Executed Orders:");
  console.log("-".repeat(80));
  for (const order of executedOrders) {
    const statusIcon = order.status === "SUCCESS" ? "✅" : "❌";
    console.log(`${statusIcon} Order:`);
    console.log(`   Key: ${order.key}`);
    console.log(`   Type: ${order.type}`);
    console.log(`   Market: ${order.market}`);
    console.log(`   Status: ${order.status}`);
    if (order.error) {
      console.log(`   Error: ${order.error}`);
    }
    console.log("");
  }

  const successCount = executedOrders.filter((o) => o.status === "SUCCESS").length;
  const failCount = executedOrders.filter((o) => o.status === "FAILED").length;

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(` ✅ EXECUTION COMPLETE: ${successCount} succeeded, ${failCount} failed`);
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

