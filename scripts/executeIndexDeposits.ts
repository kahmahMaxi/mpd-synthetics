/**
 * @title Execute Index Deposits
 * @notice Executes pending deposits created by the deployer for DFI/USDC index market
 * @dev This script finds all pending deposits for the deployer and executes them
 *      Run with: npx hardhat run scripts/executeIndexDeposits.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getAccountDepositCount, getAccountDepositKeys } from "../utils/deposit";
import * as keys from "../utils/keys";
import { hashString } from "../utils/hash";
import { getOracleParams } from "../utils/oracle";

async function getOracleParamsForDeposit(
  deposit: any,
  indexTokenAddress: string,
  usdcAddress: string
): Promise<{
  tokens: string[];
  providers: string[];
  data: string[];
}> {
  // Determine which tokens we need prices for
  const priceFeedTokens: string[] = [];

  // Always need index token price (DFI) - uses IndexPriceFeed which is registered as ChainlinkPriceFeedProvider
  priceFeedTokens.push(indexTokenAddress);

  // Need USDC price if it's used in the deposit
  if (
    deposit.initialLongToken.toLowerCase() === usdcAddress.toLowerCase() ||
    deposit.initialShortToken.toLowerCase() === usdcAddress.toLowerCase()
  ) {
    priceFeedTokens.push(usdcAddress);
  }

  // Use getOracleParams with priceFeedTokens
  // This tells the Oracle to read prices directly from ChainlinkPriceFeedProvider
  // No signatures needed - the provider reads from on-chain feeds
  const oracleParams = await getOracleParams({
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
    priceFeedTokens: priceFeedTokens, // Both DFI and USDC use ChainlinkPriceFeedProvider
  });

  return oracleParams;
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" EXECUTE INDEX DEPOSITS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // =====================================================
  // STEP 1: Load Contracts
  // =====================================================
  console.log("📦 Loading contracts...\n");

  const dataStore = await get("DataStore");
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);

  // Get DepositHandler address from DataStore
  // DepositHandler is stored with key: keccak256("DEPOSIT_HANDLER")
  const depositHandlerKey = hashString("DEPOSIT_HANDLER");
  let depositHandlerAddress = await dataStoreContract.getAddress(depositHandlerKey);

  // Fallback: try to get from deployments
  if (!depositHandlerAddress || depositHandlerAddress === hre.ethers.constants.AddressZero) {
    try {
      const depositHandler = await get("DepositHandler");
      depositHandlerAddress = depositHandler.address;
    } catch (e) {
      throw new Error(
        `❌ Could not find DepositHandler address. Please ensure DepositHandler is deployed and registered in DataStore.`
      );
    }
  }

  const depositHandlerContract = await hre.ethers.getContractAt("DepositHandler", depositHandlerAddress);
  console.log(`✅ DepositHandler: ${depositHandlerAddress}`);

  const reader = await get("Reader");
  const readerContract = await hre.ethers.getContractAt("Reader", reader.address);
  console.log(`✅ Reader: ${reader.address}`);

  // Load token addresses
  const indexToken = await get("IndexToken");
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;

  console.log(`✅ IndexToken: ${indexToken.address}`);
  console.log(`✅ USDC: ${usdcAddress}\n`);

  // =====================================================
  // STEP 2: Find Pending Deposits
  // =====================================================
  console.log("🔍 Finding pending deposits...\n");

  const depositCount = await getAccountDepositCount(dataStoreContract, deployer);
  console.log(`   Found ${depositCount.toString()} deposit(s) for deployer\n`);

  if (depositCount.eq(0)) {
    console.log("✅ No pending deposits found. Nothing to execute.\n");
    return;
  }

  const depositKeys = await getAccountDepositKeys(dataStoreContract, deployer, 0, depositCount.toNumber());

  // =====================================================
  // STEP 3: Execute Each Deposit
  // =====================================================
  console.log("📝 Executing deposits...\n");

  for (let i = 0; i < depositKeys.length; i++) {
    const depositKey = depositKeys[i];
    console.log(`\n────────────────────────────────────────────────────────────────────`);
    console.log(` Deposit ${i + 1}/${depositKeys.length}`);
    console.log(`────────────────────────────────────────────────────────────────────`);
    console.log(`   Key: ${depositKey}\n`);

    try {
      // Get deposit details
      const deposit = await readerContract.getDeposit(dataStore.address, depositKey);

      if (!deposit.account || deposit.account === hre.ethers.constants.AddressZero) {
        console.log(`   ⚠️  Deposit not found or already executed. Skipping.\n`);
        continue;
      }

      console.log(`   Account: ${deposit.account}`);
      console.log(`   Market: ${deposit.market}`);
      console.log(`   Long Token: ${deposit.initialLongToken}`);
      console.log(`   Short Token: ${deposit.initialShortToken}`);
      console.log(`   Long Amount: ${hre.ethers.utils.formatUnits(deposit.initialLongTokenAmount, 6)} USDC`);
      console.log(`   Short Amount: ${hre.ethers.utils.formatUnits(deposit.initialShortTokenAmount, 6)} USDC`);
      console.log(`   Min Market Tokens: ${hre.ethers.utils.formatEther(deposit.minMarketTokens)}\n`);

      // Get oracle prices
      console.log(`   📊 Preparing oracle params...`);
      const oracleParams = await getOracleParamsForDeposit(deposit, indexToken.address, usdcAddress);
      console.log(`   ✅ Oracle params prepared (using ChainlinkPriceFeedProvider)\n`);

      // Execute deposit with gas limit
      console.log(`   ⚡ Executing deposit...`);
      const gasLimit = 5_000_000; // 5M gas limit for safety

      const executeTx = await depositHandlerContract.executeDeposit(depositKey, oracleParams, {
        gasLimit,
      });

      console.log(`   📝 Transaction sent: ${executeTx.hash}`);
      const receipt = await executeTx.wait();
      console.log(`   ✅ Deposit executed! (Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()})\n`);

      // Check for events
      const depositExecutedEvent = receipt.events?.find(
        (e: any) => e.event === "DepositExecuted" || e.eventSignature?.includes("DepositExecuted")
      );

      if (depositExecutedEvent) {
        const marketTokenAmount = depositExecutedEvent.args?.marketTokenAmount || depositExecutedEvent.args?.[1];
        console.log(`   🎉 GM Tokens Received: ${hre.ethers.utils.formatEther(marketTokenAmount)}\n`);
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to execute deposit: ${error.message}\n`);

      // Try to extract revert reason
      if (error.reason) {
        console.error(`   Reason: ${error.reason}\n`);
      }
      if (error.data) {
        console.error(`   Data: ${error.data}\n`);
      }

      // Continue with next deposit
      continue;
    }
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ DEPOSIT EXECUTION COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📝 Next Steps:");
  console.log("   1. Run verifyIndexLiquidity.ts to verify GM tokens were minted");
  console.log("   2. Check market liquidity via Reader");
  console.log("   3. Test opening positions in the market\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
