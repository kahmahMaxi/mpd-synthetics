/**
 * @title List Index Deposits
 * @notice Lists pending deposits created by the deployer for DFI/USDC index market
 * @dev This script finds and displays pending deposits. Manual execution is NOT supported
 *      on testnet without GMX keeper infrastructure due to oracle timestamp requirements.
 *
 *      GMX V2 Oracle Execution Constraints:
 *      - executeDeposit() requires valid oracle timestamps and block numbers
 *      - ChainlinkPriceFeedProvider is for read-resolution, not manual execution
 *      - Oracle prices must be recent and block-aligned
 *      - Empty oracleTimestamps/minOracleBlockNumbers/maxOracleBlockNumbers will revert
 *      - On testnet, execution should be deferred to GMX keepers or local fork execution
 *
 *      Run with: npx hardhat run scripts/executeIndexDeposits.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getAccountDepositCount, getAccountDepositKeys } from "../utils/deposit";
import * as keys from "../utils/keys";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" LIST PENDING INDEX DEPOSITS");
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
  const reader = await get("Reader");
  const readerContract = await hre.ethers.getContractAt("Reader", reader.address);

  // Load token addresses
  const indexToken = await get("IndexToken");
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;

  console.log(`✅ DataStore: ${dataStore.address}`);
  console.log(`✅ Reader: ${reader.address}`);
  console.log(`✅ IndexToken: ${indexToken.address}`);
  console.log(`✅ USDC: ${usdcAddress}\n`);

  // =====================================================
  // STEP 2: Find Pending Deposits
  // =====================================================
  console.log("🔍 Finding pending deposits...\n");

  const depositCount = await getAccountDepositCount(dataStoreContract, deployer);
  const depositKeys = await getAccountDepositKeys(dataStoreContract, deployer, 0, depositCount);

  console.log(`   Found ${depositKeys.length} deposit(s) for deployer\n`);

  if (depositKeys.length === 0) {
    console.log("✅ No pending deposits found.\n");
    console.log("══════════════════════════════════════════════════════════════════════");
    console.log(" ✅ NO PENDING DEPOSITS");
    console.log("══════════════════════════════════════════════════════════════════════\n");
    return;
  }

  // =====================================================
  // STEP 3: Display Deposit Details
  // =====================================================
  console.log("📝 Deposit Details:\n");

  for (let i = 0; i < depositKeys.length; i++) {
    const depositKey = depositKeys[i];
    console.log(`────────────────────────────────────────────────────────────────────`);
    console.log(` Deposit ${i + 1}/${depositKeys.length}`);
    console.log(`────────────────────────────────────────────────────────────────────`);
    console.log(`   Key: ${depositKey}\n`);

    try {
      // Check if deposit exists in DataStore DEPOSIT_LIST
      const depositListKey = keys.DEPOSIT_LIST;
      const depositExists = await dataStoreContract.containsBytes32(depositListKey, depositKey);

      if (!depositExists) {
        console.log(`   ⚠️  Deposit not found in DataStore (may have been executed or cancelled).\n`);
        continue;
      }

      // Get deposit details
      const deposit = await readerContract.getDeposit(dataStore.address, depositKey);

      // Reader returns deposit with nested addresses structure
      if (!deposit.addresses.account || deposit.addresses.account === hre.ethers.constants.AddressZero) {
        console.log(`   ⚠️  Deposit has invalid account address.\n`);
        continue;
      }

      console.log(`   Account: ${deposit.addresses.account}`);
      console.log(`   Market: ${deposit.addresses.market}`);
      console.log(`   Long Token: ${deposit.addresses.initialLongToken}`);
      console.log(`   Short Token: ${deposit.addresses.initialShortToken}`);
      console.log(`   Long Amount: ${hre.ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6)} USDC`);
      console.log(`   Short Amount: ${hre.ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6)} USDC`);
      console.log(`   Min Market Tokens: ${hre.ethers.utils.formatEther(deposit.numbers.minMarketTokens)}`);
      console.log(`   Execution Fee: ${hre.ethers.utils.formatEther(deposit.numbers.executionFee)} WNT\n`);
    } catch (error: any) {
      console.error(`   ❌ Error reading deposit: ${error.message}\n`);
    }
  }

  // =====================================================
  // STEP 4: Explain Execution Constraints
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ⚠️  MANUAL EXECUTION NOT SUPPORTED ON TESTNET");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📋 Why Manual Execution Fails:\n");
  console.log("   GMX V2 requires oracle timestamps and block numbers for execution.");
  console.log("   ChainlinkPriceFeedProvider is designed for read-resolution, not");
  console.log("   manual execution. Empty oracle params will cause revert:\n");
  console.log("   - oracleTimestamps: [] ❌");
  console.log("   - minOracleBlockNumbers: [] ❌");
  console.log("   - maxOracleBlockNumbers: [] ❌\n");

  console.log("📋 GMX V2 Oracle Execution Constraints:\n");
  console.log("   1. executeDeposit() requires valid oracle timestamps");
  console.log("   2. Oracle prices must be recent and block-aligned");
  console.log("   3. ChainlinkPriceFeedProvider cannot provide execution timestamps");
  console.log("   4. Manual execution requires GMX keeper infrastructure\n");

  console.log("✅ Recommended Approach:\n");
  console.log("   1. Deposits are created successfully (✅ done)");
  console.log("   2. Execution should be handled by:");
  console.log("      - GMX testnet keepers (if available)");
  console.log("      - Local/forked environment with mock oracles");
  console.log("      - DataStream oracle (not ChainlinkPriceFeedProvider)");
  console.log("   3. Verify liquidity status with verifyIndexLiquidity.ts\n");

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ DEPOSIT LISTING COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📝 Next Steps:");
  console.log("   1. Wait for GMX keeper to execute deposits (if available)");
  console.log("   2. Or use local/forked environment for testing");
  console.log("   3. Run verifyIndexLiquidity.ts to check if liquidity is live");
  console.log("   4. Check GM token supply to confirm execution status\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
