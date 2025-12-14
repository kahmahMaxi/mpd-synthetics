/**
 * @title Seed Index Market Liquidity
 * @notice Seeds initial USDC liquidity into the DFI/USDC index market
 * @dev This script deposits USDC into the market and receives GM tokens
 *      Run with: npx hardhat run scripts/seedIndexLiquidity.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import { expandDecimals } from "../utils/math";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import * as keys from "../utils/keys";
import * as fs from "fs";
import * as path from "path";

const TOKENS_DIR = path.resolve(__dirname, "..", "config", "tokens");

interface TokenConfig {
  symbol: string;
  decimals: number;
  address: string;
}

function loadTokenConfig(symbol: string): TokenConfig {
  const tokenPath = path.join(TOKENS_DIR, `${symbol.toLowerCase()}.json`);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Token config not found: ${tokenPath}`);
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" SEED INDEX MARKET LIQUIDITY");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // =====================================================
  // STEP 1: Load Deployed Contracts
  // =====================================================
  console.log("📦 Loading deployed contracts...\n");

  // Load ExchangeRouter
  let exchangeRouter;
  try {
    exchangeRouter = await get("ExchangeRouter");
    console.log(`✅ ExchangeRouter: ${exchangeRouter.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load ExchangeRouter: ${error.message}`);
  }

  // Load Reader
  let reader;
  try {
    reader = await get("Reader");
    console.log(`✅ Reader: ${reader.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load Reader: ${error.message}`);
  }

  // Load DataStore
  let dataStore;
  try {
    dataStore = await get("DataStore");
    console.log(`✅ DataStore: ${dataStore.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load DataStore: ${error.message}`);
  }

  // Load IndexToken
  let indexToken;
  try {
    indexToken = await get("IndexToken");
    console.log(`✅ IndexToken: ${indexToken.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load IndexToken. Ensure it's deployed first. Error: ${error.message}`);
  }

  // Load USDC
  let usdcAddress: string;
  let usdcDecimals: number;
  try {
    const usdcConfig = loadTokenConfig("USDC");
    usdcAddress = usdcConfig.address;
    usdcDecimals = usdcConfig.decimals;
    console.log(`✅ USDC: ${usdcAddress} (${usdcDecimals} decimals)`);
  } catch (error: any) {
    try {
      const tokens = await hre.gmx.getTokens();
      if (tokens.USDC && tokens.USDC.address) {
        usdcAddress = tokens.USDC.address;
        usdcDecimals = tokens.USDC.decimals;
        console.log(`✅ USDC: ${usdcAddress} (${usdcDecimals} decimals)`);
      } else {
        throw new Error("USDC not found in token configs");
      }
    } catch (fallbackError: any) {
      throw new Error(`Failed to load USDC. Ensure it's deployed or configured. Error: ${fallbackError.message}`);
    }
  }

  // =====================================================
  // STEP 2: Find Market
  // =====================================================
  console.log("\n🔍 Finding DFI/USDC market...\n");

  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  const markets = await getOnchainMarkets(read, dataStore.address);
  const market = markets[marketKey];

  if (!market) {
    throw new Error(
      `❌ Market not found! Run createIndexMarket.ts first.\n` +
      `   Market Key: ${marketKey}\n` +
      `   Index Token: ${indexToken.address}\n` +
      `   Long Token: ${usdcAddress}\n` +
      `   Short Token: ${usdcAddress}`
    );
  }

  console.log(`✅ Market found!`);
  console.log(`   Market Token (GM): ${market.marketToken}`);
  console.log(`   Index Token: ${market.indexToken}`);
  console.log(`   Long Token: ${market.longToken}`);
  console.log(`   Short Token: ${market.shortToken}\n`);

  // =====================================================
  // STEP 3: Safety Checks
  // =====================================================
  console.log("🔍 Performing safety checks...\n");

  // Check GM token
  const gmToken = await hre.ethers.getContractAt("MarketToken", market.marketToken);
  const gmTokenName = await gmToken.name();
  const gmTokenSymbol = await gmToken.symbol();
  const gmTokenTotalSupply = await gmToken.totalSupply();

  console.log(`✅ GM Token: ${gmTokenName} (${gmTokenSymbol})`);
  console.log(`   Current Supply: ${hre.ethers.utils.formatEther(gmTokenTotalSupply)} GM\n`);

  // Check oracle price (optional - just verify it's resolvable)
  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  try {
    const priceFeedKey = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string", "address"], ["PRICE_FEED", indexToken.address])
    );
    const oracleAddress = await dataStoreContract.getAddress(priceFeedKey);
    if (oracleAddress && oracleAddress !== hre.ethers.constants.AddressZero) {
      console.log(`✅ Oracle registered: ${oracleAddress}`);
    } else {
      throw new Error("Oracle not registered");
    }
  } catch (error: any) {
    throw new Error(`❌ Oracle not registered. Run registerIndexOracle.ts first.`);
  }

  // =====================================================
  // STEP 4: Prepare USDC
  // =====================================================
  console.log("💰 Preparing USDC...\n");

  const usdcContract = await hre.ethers.getContractAt("MintableToken", usdcAddress);
  const deployerUsdcBalance = await usdcContract.balanceOf(deployer);

  // Deposit amount: 10,000 USDC (adjust as needed)
  const depositAmount = expandDecimals(10000, usdcDecimals); // 10,000 USDC
  const depositAmountFormatted = hre.ethers.utils.formatUnits(depositAmount, usdcDecimals);

  console.log(`   Required: ${depositAmountFormatted} USDC`);
  console.log(`   Current Balance: ${hre.ethers.utils.formatUnits(deployerUsdcBalance, usdcDecimals)} USDC\n`);

  // Mint USDC if needed (for testnet)
  if (deployerUsdcBalance.lt(depositAmount)) {
    const needed = depositAmount.sub(deployerUsdcBalance);
    console.log(`⚠️  Insufficient USDC balance. Minting ${hre.ethers.utils.formatUnits(needed, usdcDecimals)} USDC...\n`);

    try {
      // Check if deployer has minter role
      const minterRole = await usdcContract.MINTER_ROLE();
      const isMinter = await usdcContract.hasRole(minterRole, deployer);

      if (isMinter) {
        const mintTx = await usdcContract.mint(deployer, needed);
        await mintTx.wait();
        console.log(`✅ Minted ${hre.ethers.utils.formatUnits(needed, usdcDecimals)} USDC\n`);
      } else {
        throw new Error(
          `Deployer does not have MINTER_ROLE. Please:\n` +
          `  1. Get USDC from a faucet, OR\n` +
          `  2. Grant MINTER_ROLE to deployer address: ${deployer}`
        );
      }
    } catch (error: any) {
      if (error.message.includes("MINTER_ROLE")) {
        throw error;
      }
      // If minting fails, try to check if it's a standard ERC20
      console.log(`⚠️  Could not mint USDC: ${error.message}`);
      console.log(`   Please ensure you have sufficient USDC balance or use a faucet.\n`);
      throw new Error(`Insufficient USDC balance. Need ${depositAmountFormatted} USDC.`);
    }
  } else {
    console.log(`✅ Sufficient USDC balance\n`);
  }

  // Approve ExchangeRouter
  const exchangeRouterContract = await hre.ethers.getContractAt("ExchangeRouter", exchangeRouter.address);
  const currentAllowance = await usdcContract.allowance(deployer, exchangeRouter.address);

  if (currentAllowance.lt(depositAmount)) {
    console.log(`📝 Approving ExchangeRouter for USDC...`);
    const approveTx = await usdcContract.approve(exchangeRouter.address, depositAmount);
    await approveTx.wait();
    console.log(`✅ Approved ${depositAmountFormatted} USDC\n`);
  } else {
    console.log(`✅ ExchangeRouter already approved\n`);
  }

  // =====================================================
  // STEP 5: Create Deposit
  // =====================================================
  console.log("📝 Creating deposit...\n");

  const executionFee = expandDecimals(1, 15); // 0.001 ETH (WNT)
  
  // Get WNT address from DataStore
  const wntKey = keys.WNT;
  let wntAddress = await dataStoreContract.getAddress(wntKey);
  if (!wntAddress || wntAddress === hre.ethers.constants.AddressZero) {
    // Fallback to WETH deployment
    const weth = await get("WETH");
    wntAddress = weth.address;
  }

  // For USDC/USDC market, we deposit USDC as both long and short tokens
  // Since they're the same, we only need to deposit once (as longToken)
  const depositParams = {
    addresses: {
      receiver: deployer,
      callbackContract: hre.ethers.constants.AddressZero,
      uiFeeReceiver: hre.ethers.constants.AddressZero,
      market: market.marketToken,
      initialLongToken: usdcAddress,
      initialShortToken: usdcAddress,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    minMarketTokens: 0, // Accept any amount of GM tokens
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    dataList: [],
  };

  // Check and prepare WNT for execution fee
  const wnt = await hre.ethers.getContractAt("WNT", wntAddress);
  const wntBalance = await wnt.balanceOf(deployer);
  
  if (wntBalance.lt(executionFee)) {
    // Wrap ETH to WNT if needed
    const neededWnt = executionFee.sub(wntBalance);
    console.log(`📝 Wrapping ${hre.ethers.utils.formatEther(neededWnt)} ETH to WNT...`);
    const wrapTx = await wnt.deposit({ value: neededWnt });
    await wrapTx.wait();
    console.log(`✅ Wrapped ETH to WNT\n`);
    
    // Verify we have enough now
    const finalWntBalance = await wnt.balanceOf(deployer);
    if (finalWntBalance.lt(executionFee)) {
      throw new Error(`Insufficient WNT for execution fee. Need ${hre.ethers.utils.formatEther(executionFee)} WNT.`);
    }
  } else {
    console.log(`✅ Sufficient WNT balance for execution fee\n`);
  }

  console.log(`   Deposit Amount: ${depositAmountFormatted} USDC`);
  console.log(`   Execution Fee: ${hre.ethers.utils.formatEther(executionFee)} WNT`);
  console.log(`   Market: ${market.marketToken}\n`);

  // Transfer tokens to DepositVault
  // GMX V2 requires tokens to be in DepositVault before createDeposit
  const depositVault = await get("DepositVault");
  
  console.log(`📝 Transferring tokens to DepositVault...`);
  
  // Transfer USDC to DepositVault
  const transferUsdcTx = await usdcContract.transfer(depositVault.address, depositAmount);
  await transferUsdcTx.wait();
  console.log(`✅ Transferred ${depositAmountFormatted} USDC to DepositVault`);
  
  // Transfer WNT execution fee to DepositVault
  const transferWntTx = await wnt.transfer(depositVault.address, executionFee);
  await transferWntTx.wait();
  console.log(`✅ Transferred ${hre.ethers.utils.formatEther(executionFee)} WNT to DepositVault\n`);

  try {
    // Create deposit
    // Note: In GMX V2, deposits are two-step: create then execute
    // DepositVault.recordTransferIn() will record the tokens we just transferred
    // For testnet, we create the deposit and provide instructions for execution
    const createDepositTx = await exchangeRouterContract.createDeposit(depositParams);

    console.log(`✅ Deposit created!`);
    console.log(`   Transaction: ${createDepositTx.hash}\n`);

    const receipt = await createDepositTx.wait();
    console.log(`✅ Transaction confirmed (Block: ${receipt.blockNumber})\n`);

    // Extract deposit key from events
    const depositCreatedEvent = receipt.events?.find(
      (e: any) => e.event === "DepositCreated" || e.eventSignature?.includes("DepositCreated")
    );

    if (depositCreatedEvent) {
      const depositKey = depositCreatedEvent.args?.key || depositCreatedEvent.args?.[0];
      console.log(`📋 Deposit Key: ${depositKey}\n`);
      console.log(`⚠️  Note: Deposit must be executed by a keeper or manually.`);
      console.log(`   The deposit is now pending execution.\n`);
    } else {
      console.log(`⚠️  Could not extract deposit key from events.`);
      console.log(`   Check transaction logs for deposit key.\n`);
    }
  } catch (error: any) {
    throw new Error(`❌ Failed to create deposit: ${error.message}`);
  }

  // =====================================================
  // STEP 6: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" LIQUIDITY SEEDING SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const finalGmSupply = await gmToken.totalSupply();
  const deployerGmBalance = await gmToken.balanceOf(deployer);

  console.log("┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ Deposit Information                                                │");
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ USDC Deposited:   ${depositAmountFormatted.padEnd(58)} │`);
  console.log(`│ GM Token:         ${market.marketToken.padEnd(58)} │`);
  console.log(`│ GM Token Name:    ${gmTokenName.padEnd(58)} │`);
  console.log(`│ GM Token Symbol:  ${gmTokenSymbol.padEnd(58)} │`);
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ GM Total Supply:  ${hre.ethers.utils.formatEther(finalGmSupply).padEnd(58)} │`);
  console.log(`│ Your GM Balance:  ${hre.ethers.utils.formatEther(deployerGmBalance).padEnd(58)} │`);
  console.log("└────────────────────────────────────────────────────────────────────┘\n");

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ LIQUIDITY SEEDING INITIATED!");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📝 Next Steps:");
  console.log("   1. Wait for keeper to execute deposit (or execute manually)");
  console.log("   2. Verify GM tokens received after execution");
  console.log("   3. Check market liquidity via Reader");
  console.log("   4. Test opening positions in the market\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

