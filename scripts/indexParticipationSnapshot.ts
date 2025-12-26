/**
 * @title Index Participation Snapshot
 * @notice Creates a snapshot of user participation in the DFI/USDC index market
 * @dev This script reads pending orders and deposits from Reader/DataStore
 *      and creates a normalized JSON snapshot for reward calculations.
 *      Focus: Phase 4 (MPD Rewards) - Read-only, execution-independent
 *      Run with: npx hardhat run scripts/indexParticipationSnapshot.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import { getAccountOrderCount, getAccountOrderKeys, getOrderCount, getOrderKeys } from "../utils/order";
import { getAccountDepositCount, getAccountDepositKeys, getDepositCount, getDepositKeys } from "../utils/deposit";
import { OrderType, orderTypeNames } from "../utils/order";
import * as keys from "../utils/keys";
import {
  ParticipationSnapshot,
  UserParticipation,
  OrderParticipation,
  DepositParticipation,
} from "../rewards/RewardTypes";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" INDEX PARTICIPATION SNAPSHOT");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  // =====================================================
  // STEP 1: Load Contracts and Find Market
  // =====================================================
  console.log("📦 Loading contracts and finding market...\n");

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

  // Find market
  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  const markets = await getOnchainMarkets(read, dataStore.address);
  const market = markets[marketKey];

  if (!market) {
    throw new Error(`Market not found for key: ${marketKey}`);
  }

  console.log(`✅ Market found: ${market.marketToken}\n`);

  // =====================================================
  // STEP 2: Discover All Participants
  // =====================================================
  console.log("🔍 Discovering participants...\n");

  // Get all orders for the market
  const allOrderKeys: string[] = [];
  const userOrderMap = new Map<string, string[]>(); // user -> orderKeys

  // Get total order count
  const totalOrderCount = await getOrderCount(dataStoreContract);

  console.log(`   Total orders in system: ${totalOrderCount}`);

  // Get orders in batches
  const batchSize = 100;
  for (let i = 0; i < totalOrderCount; i += batchSize) {
    const end = Math.min(i + batchSize, totalOrderCount);
    const orderKeys = await getOrderKeys(dataStoreContract, i, end);

    for (const orderKey of orderKeys) {
      try {
        const order = await readerContract.getOrder(dataStore.address, orderKey);
        if (order.addresses.market.toLowerCase() === market.marketToken.toLowerCase()) {
          allOrderKeys.push(orderKey);
          const account = order.addresses.account.toLowerCase();
          if (!userOrderMap.has(account)) {
            userOrderMap.set(account, []);
          }
          userOrderMap.get(account)!.push(orderKey);
        }
      } catch (error) {
        // Skip invalid orders
        continue;
      }
    }
  }

  // Get all deposits for the market
  const userDepositMap = new Map<string, string[]>(); // user -> depositKeys

  const totalDepositCount = await getDepositCount(dataStoreContract);

  console.log(`   Total deposits in system: ${totalDepositCount}`);

  // Get deposits in batches
  for (let i = 0; i < totalDepositCount; i += batchSize) {
    const end = Math.min(i + batchSize, totalDepositCount);
    const depositKeys = await getDepositKeys(dataStoreContract, i, end);

    for (const depositKey of depositKeys) {
      try {
        const deposit = await readerContract.getDeposit(dataStore.address, depositKey);
        if (deposit.addresses.market && deposit.addresses.market.toLowerCase() === market.marketToken.toLowerCase()) {
          const account = deposit.addresses.account.toLowerCase();
          if (!userDepositMap.has(account)) {
            userDepositMap.set(account, []);
          }
          userDepositMap.get(account)!.push(depositKey);
        }
      } catch (error) {
        // Skip invalid deposits
        continue;
      }
    }
  }

  // Combine all unique users
  const allUsers = new Set<string>();
  userOrderMap.forEach((_, user) => allUsers.add(user));
  userDepositMap.forEach((_, user) => allUsers.add(user));

  console.log(`   Found ${allUsers.size} unique participant(s)`);
  console.log(`   Found ${allOrderKeys.length} order(s) for this market`);
  console.log(`   Found ${Array.from(userDepositMap.values()).flat().length} deposit(s) for this market\n`);

  // =====================================================
  // STEP 3: Build Participation Data
  // =====================================================
  console.log("📊 Building participation data...\n");

  const userParticipations: UserParticipation[] = [];
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const currentTimestamp = Math.floor(Date.now() / 1000);

  for (const userAddress of allUsers) {
    const orders: OrderParticipation[] = [];
    const deposits: DepositParticipation[] = [];
    let firstInteractionTimestamp = currentTimestamp;

    // Process orders
    const orderKeys = userOrderMap.get(userAddress) || [];
    for (const orderKey of orderKeys) {
      try {
        const order = await readerContract.getOrder(dataStore.address, orderKey);
        const orderType = order.numbers.orderType;
        const orderTypeName = orderTypeNames[orderType] || `Unknown(${orderType})`;
        const isLong = order.flags.isLong;
        const sizeDeltaUsd = order.numbers.sizeDeltaUsd.toString();
        const collateralAmount = order.numbers.initialCollateralDeltaAmount.toString();

        // Get order creation timestamp (from updatedAtBlock or use current block)
        const createdAt = currentTimestamp; // Approximate - actual timestamp would require event parsing

        // Determine status (simplified - would need to check execution status)
        let status: "pending" | "executed" | "cancelled" = "pending";
        if (order.flags.shouldUnwrapNativeToken === false && order.numbers.sizeDeltaUsd.eq(0)) {
          status = "cancelled";
        }

        orders.push({
          orderKey,
          orderType: orderTypeName,
          direction: isLong ? "LONG" : "SHORT",
          sizeDeltaUsd,
          collateralAmount,
          createdAt,
          status,
        });

        // Track earliest interaction
        if (createdAt < firstInteractionTimestamp) {
          firstInteractionTimestamp = createdAt;
        }
      } catch (error) {
        console.log(`   ⚠️  Error reading order ${orderKey}: ${error}`);
      }
    }

    // Process deposits
    const depositKeys = userDepositMap.get(userAddress) || [];
    for (const depositKey of depositKeys) {
      try {
        const deposit = await readerContract.getDeposit(dataStore.address, depositKey);
        const longAmount = deposit.numbers.initialLongTokenAmount.toString();
        const shortAmount = deposit.numbers.initialShortTokenAmount.toString();
        const totalAmount = hre.ethers.BigNumber.from(longAmount).add(shortAmount);
        const amountUsd = hre.ethers.utils.formatUnits(totalAmount, usdcDecimals);

        // Get deposit creation timestamp (approximate)
        const createdAt = currentTimestamp;

        // Determine status
        let status: "pending" | "executed" | "cancelled" = "pending";
        if (!deposit.addresses.account || deposit.addresses.account === hre.ethers.constants.AddressZero) {
          status = "cancelled";
        }

        deposits.push({
          depositKey,
          amountUsd,
          createdAt,
          status,
        });

        // Track earliest interaction
        if (createdAt < firstInteractionTimestamp) {
          firstInteractionTimestamp = createdAt;
        }
      } catch (error) {
        console.log(`   ⚠️  Error reading deposit ${depositKey}: ${error}`);
      }
    }

    // Calculate scores (will be calculated in calcMPDRewards.ts, but initialize here)
    userParticipations.push({
      address: userAddress,
      orders,
      deposits,
      firstInteractionTimestamp,
      scores: {
        OrderIntent: 0,
        LiquidityIntent: 0,
        TimeParticipation: 0,
        MarketSupport: 0,
      },
      totalScore: 0,
    });
  }

  console.log(`   Processed ${userParticipations.length} user(s)\n`);

  // =====================================================
  // STEP 4: Create Snapshot
  // =====================================================
  console.log("📸 Creating snapshot...\n");

  const snapshot: ParticipationSnapshot = {
    timestamp: currentTimestamp,
    blockNumber: currentBlock,
    marketAddress: market.marketToken,
    users: userParticipations,
  };

  // =====================================================
  // STEP 5: Save Snapshot
  // =====================================================
  console.log("💾 Saving snapshot...\n");

  const snapshotDir = path.resolve(__dirname, "..", "snapshots");
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const snapshotFile = path.resolve(snapshotDir, `participation-snapshot-${hre.network.name}-${currentTimestamp}.json`);

  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

  console.log(`✅ Snapshot saved: ${snapshotFile}\n`);

  // =====================================================
  // STEP 6: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ SNAPSHOT COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📊 Snapshot Summary:");
  console.log(`   Market: ${market.marketToken}`);
  console.log(`   Block: ${currentBlock}`);
  console.log(`   Timestamp: ${new Date(currentTimestamp * 1000).toISOString()}`);
  console.log(`   Participants: ${userParticipations.length}`);
  console.log(`   Total Orders: ${allOrderKeys.length}`);
  console.log(`   Total Deposits: ${Array.from(userDepositMap.values()).flat().length}\n`);

  console.log("📝 Next Steps:");
  console.log(`   1. Run calcMPDRewards.ts with snapshot: ${path.basename(snapshotFile)}`);
  console.log(`   2. Review participation data`);
  console.log(`   3. Export rewards for claims\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
