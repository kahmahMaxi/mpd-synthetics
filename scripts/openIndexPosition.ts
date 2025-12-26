/**
 * @title Open Index Position (Order Creation Only)
 * @notice Creates LONG or SHORT orders on DFI/USDC index market
 * @dev This script creates orders but does NOT execute them (Phase 3C-3D Logic-Only)
 *      Orders will remain pending until executed by GMX keepers or in local fork
 *
 *      Usage:
 *        LONG:  npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia -- --direction LONG --size 1000 --collateral 100 --leverage 10
 *        SHORT: npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia -- --direction SHORT --size 1000 --collateral 100 --leverage 10
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import { expandDecimals, decimalToFloat } from "../utils/math";
import { OrderType } from "../utils/order";
import { ethers } from "ethers";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" OPEN INDEX POSITION (ORDER CREATION)");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  // =====================================================
  // STEP 1: Parse Arguments
  // =====================================================
  // Use environment variables (recommended) or try to parse from process.argv
  // Environment variables take precedence
  const directionArg = process.env.DIRECTION;
  const sizeArg = process.env.SIZE;
  const collateralArg = process.env.COLLATERAL;
  const leverageArg = process.env.LEVERAGE;

  // If env vars not set, try to parse from command line args (after -- separator)
  let parsedDirection = directionArg;
  let parsedSize = sizeArg;
  let parsedCollateral = collateralArg;
  let parsedLeverage = leverageArg;

  if (!parsedDirection || !parsedSize || !parsedCollateral || !parsedLeverage) {
    // Try to get args after '--' separator
    const dashDashIndex = process.argv.indexOf("--");
    if (dashDashIndex !== -1) {
      const args = process.argv.slice(dashDashIndex + 1);

      const getArg = (name: string): string | undefined => {
        const equalFormat = args.find((arg) => arg.startsWith(`--${name}=`));
        if (equalFormat) {
          return equalFormat.split("=")[1];
        }
        const index = args.indexOf(`--${name}`);
        if (index !== -1 && index + 1 < args.length) {
          return args[index + 1];
        }
        return undefined;
      };

      parsedDirection = parsedDirection || getArg("direction");
      parsedSize = parsedSize || getArg("size");
      parsedCollateral = parsedCollateral || getArg("collateral");
      parsedLeverage = parsedLeverage || getArg("leverage");
    }
  }

  if (!parsedDirection || !parsedSize || !parsedCollateral || !parsedLeverage) {
    console.error("❌ Missing required arguments:");
    console.error("   Use environment variables:");
    console.error(
      "     DIRECTION=LONG|SHORT SIZE=1000 COLLATERAL=100 LEVERAGE=10 npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia\n"
    );
    console.error("   Or use command-line args (after -- separator):");
    console.error(
      "     npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia -- --direction LONG --size 1000 --collateral 100 --leverage 10\n"
    );
    process.exit(1);
  }

  const direction = parsedDirection.toUpperCase();
  const sizeUsd = parseFloat(parsedSize);
  const collateralAmount = parseFloat(parsedCollateral);
  const leverage = parseFloat(parsedLeverage);

  if (direction !== "LONG" && direction !== "SHORT") {
    throw new Error(`Invalid direction: ${direction}. Must be LONG or SHORT`);
  }

  const isLong = direction === "LONG";

  console.log(`📋 Order Parameters:`);
  console.log(`   Direction: ${direction}`);
  console.log(`   Size: $${sizeUsd} USD`);
  console.log(`   Collateral: ${collateralAmount} USDC`);
  console.log(`   Leverage: ${leverage}x\n`);

  // =====================================================
  // STEP 2: Load Contracts
  // =====================================================
  const { get, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const signer = await hre.ethers.getSigner(deployer);

  console.log(`Deployer: ${deployer}\n`);
  console.log("📦 Loading contracts...\n");

  const exchangeRouter = await hre.ethers.getContractAt("ExchangeRouter", (await get("ExchangeRouter")).address);
  const orderVault = await get("OrderVault");
  const router = await get("Router");
  const indexToken = await get("IndexToken");

  // Load USDC
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;
  const usdcDecimals = usdcConfig.decimals || 6;
  const usdcContract = await hre.ethers.getContractAt("ERC20", usdcAddress);

  console.log(`✅ ExchangeRouter: ${exchangeRouter.address}`);
  console.log(`✅ OrderVault: ${orderVault.address}`);
  console.log(`✅ Router: ${router.address}`);
  console.log(`✅ USDC: ${usdcAddress} (${usdcDecimals} decimals)\n`);

  // =====================================================
  // STEP 3: Find Market
  // =====================================================
  console.log("🔍 Finding DFI/USDC market...\n");

  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  const markets = await getOnchainMarkets(read, (await get("DataStore")).address);
  const market = markets[marketKey];

  if (!market) {
    throw new Error(`Market not found for key: ${marketKey}`);
  }

  console.log(`✅ Market found: ${market.marketToken}\n`);

  // =====================================================
  // STEP 4: Check Collateral Balance and Approval
  // =====================================================
  console.log("💰 Checking collateral...\n");

  const collateralAmountWei = expandDecimals(collateralAmount, usdcDecimals);
  const balance = await usdcContract.balanceOf(deployer);
  const allowance = await usdcContract.allowance(deployer, router.address);

  console.log(`   Balance: ${hre.ethers.utils.formatUnits(balance, usdcDecimals)} USDC`);
  console.log(`   Required: ${collateralAmount} USDC`);
  console.log(`   Allowance: ${hre.ethers.utils.formatUnits(allowance, usdcDecimals)} USDC\n`);

  if (balance.lt(collateralAmountWei)) {
    throw new Error(
      `Insufficient USDC balance. Have: ${hre.ethers.utils.formatUnits(
        balance,
        usdcDecimals
      )}, Need: ${collateralAmount}`
    );
  }

  if (allowance.lt(collateralAmountWei)) {
    console.log("📝 Approving USDC...");
    const approveTx = await usdcContract.approve(router.address, collateralAmountWei);
    await approveTx.wait();
    console.log("✅ USDC approved\n");
  }

  // =====================================================
  // STEP 5: Prepare Order Parameters
  // =====================================================
  console.log("📝 Preparing order parameters...\n");

  // Calculate execution fee (WNT)
  const estimatedGasLimit = 10_000_000;
  const gasPrice = await signer.getGasPrice();
  const executionFee = gasPrice.mul(estimatedGasLimit);

  // For market orders, triggerPrice and acceptablePrice can be 0
  // The keeper will use current oracle prices
  const sizeDeltaUsd = decimalToFloat(sizeUsd);
  const triggerPrice = 0; // Market order
  const acceptablePrice = 0; // Market order - keeper will set based on oracle

  const orderParams = {
    addresses: {
      receiver: deployer,
      cancellationReceiver: ethers.constants.AddressZero,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: market.marketToken,
      initialCollateralToken: usdcAddress,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: sizeDeltaUsd,
      initialCollateralDeltaAmount: collateralAmountWei,
      triggerPrice: triggerPrice,
      acceptablePrice: acceptablePrice,
      executionFee: executionFee,
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType: OrderType.MarketIncrease, // Market order to increase position
    decreasePositionSwapType: 0, // Not applicable for increase orders
    isLong: isLong,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: ethers.constants.HashZero,
    dataList: [],
  };

  console.log(`   Order Type: MarketIncrease`);
  console.log(`   Size Delta USD: ${sizeUsd}`);
  console.log(`   Collateral Amount: ${collateralAmount} USDC`);
  console.log(`   Execution Fee: ${hre.ethers.utils.formatEther(executionFee)} WNT\n`);

  // =====================================================
  // STEP 6: Create Order
  // =====================================================
  console.log("📤 Creating order...\n");

  try {
    // Prepare multicall data
    const multicallData = [
      // Send WNT for execution fee
      exchangeRouter.interface.encodeFunctionData("sendWnt", [orderVault.address, executionFee]),
      // Send USDC collateral
      exchangeRouter.interface.encodeFunctionData("sendTokens", [usdcAddress, orderVault.address, collateralAmountWei]),
      // Create order
      exchangeRouter.interface.encodeFunctionData("createOrder", [orderParams]),
    ];

    const tx = await exchangeRouter.multicall(multicallData, { value: executionFee });
    console.log(`   Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Order created! (Block: ${receipt.blockNumber})\n`);

    // Extract order key from events
    const orderCreatedEvent = receipt.events?.find(
      (e: any) => e.event === "OrderCreated" || e.eventSignature?.includes("OrderCreated")
    );

    if (orderCreatedEvent) {
      const orderKey = orderCreatedEvent.args?.key || orderCreatedEvent.args?.[0];
      console.log(`   Order Key: ${orderKey}\n`);
    } else {
      console.log(`   ⚠️  Could not extract order key from events. Check transaction logs.\n`);
    }
  } catch (error: any) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  // =====================================================
  // STEP 7: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ ORDER CREATED (PENDING EXECUTION)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📋 Order Summary:");
  console.log(`   Direction: ${direction}`);
  console.log(`   Size: $${sizeUsd} USD`);
  console.log(`   Collateral: ${collateralAmount} USDC`);
  console.log(`   Leverage: ${leverage}x`);
  console.log(`   Market: ${market.marketToken}\n`);

  console.log("⚠️  IMPORTANT:");
  console.log("   This order is PENDING and will NOT execute automatically on testnet.");
  console.log("   Execution requires GMX keeper infrastructure or local fork.\n");

  console.log("📝 Next Steps:");
  console.log("   1. Run inspectIndexState.ts to view pending orders");
  console.log("   2. Wait for keeper execution (if available)");
  console.log("   3. Or use local fork for testing\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
