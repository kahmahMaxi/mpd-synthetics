/**
 * @title Mint and Distribute esMPD
 * @notice Mints esMPD tokens to FeeDistributor for reward distribution
 * @dev Run with: npx hardhat run scripts/mintAndDistributeEsMpd.ts --network localhost [--amount 10000000000000000000000]
 */

import hre from "hardhat";
import { getEsMpdAddress, getFeeDistributorAddress } from "../utils/rewardAdapter";
import { expandDecimals } from "../utils/math";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" MINT AND DISTRIBUTE esMPD");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { deployer } = await hre.getNamedAccounts();
  console.log(`Deployer: ${deployer}\n`);

  // Parse CLI args (handle both --amount=value and --amount value formats)
  let amountStr = "10000000000000000000000"; // Default: 10000 esMPD
  const amountIndex = process.argv.findIndex((arg) => arg === "--amount" || arg.startsWith("--amount="));
  if (amountIndex >= 0) {
    if (process.argv[amountIndex].includes("=")) {
      amountStr = process.argv[amountIndex].split("=")[1];
    } else if (amountIndex + 1 < process.argv.length) {
      amountStr = process.argv[amountIndex + 1];
    }
  }
  const amount = hre.ethers.BigNumber.from(amountStr);

  // Get addresses
  const esMpdAddress = getEsMpdAddress();
  const feeDistributorAddress = await getFeeDistributorAddress();

  if (!esMpdAddress) {
    throw new Error("esMPD address not configured. Run configureRewards.ts first.");
  }

  if (!feeDistributorAddress) {
    throw new Error("FeeDistributor not deployed. Deploy it first.");
  }

  console.log("📦 Addresses:");
  console.log(`   esMPD: ${esMpdAddress}`);
  console.log(`   FeeDistributor: ${feeDistributorAddress}`);
  console.log(`   Amount: ${hre.ethers.utils.formatEther(amount)} esMPD\n`);

  // Get contracts
  // EsMPD is in mpd-token repo, so we use a minimal interface
  const esMpdAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256)",
    "function MINTER_ROLE() view returns (bytes32)",
    "function hasRole(bytes32, address) view returns (bool)",
  ];
  const esMpd = await hre.ethers.getContractAt(esMpdAbi, esMpdAddress);
  const feeDistributor = await hre.ethers.getContractAt("FeeDistributor", feeDistributorAddress);

  // Check if deployer is a minter
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" MINTING esMPD");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // Check current balance
  const currentBalance = await esMpd.balanceOf(feeDistributorAddress);
  console.log(`Current FeeDistributor esMPD balance: ${hre.ethers.utils.formatEther(currentBalance)} esMPD\n`);

  // Mint esMPD to FeeDistributor
  try {
    console.log(`Minting ${hre.ethers.utils.formatEther(amount)} esMPD to FeeDistributor...`);
    
    // Check if deployer has minter role
    const minterRole = await esMpd.MINTER_ROLE();
    const isMinter = await esMpd.hasRole(minterRole, deployer);
    
    if (!isMinter) {
      throw new Error(`Deployer ${deployer} does not have MINTER_ROLE on esMPD. Grant it first.`);
    }

    const mintTx = await esMpd.mint(feeDistributorAddress, amount);
    const mintReceipt = await mintTx.wait();
    
    console.log(`✅ Minted successfully!`);
    console.log(`   Transaction: ${mintReceipt.transactionHash}\n`);

    // Verify new balance
    const newBalance = await esMpd.balanceOf(feeDistributorAddress);
    console.log(`New FeeDistributor esMPD balance: ${hre.ethers.utils.formatEther(newBalance)} esMPD\n`);

    // Note: FeeDistributor doesn't have a notifyRewardAmount function like RewardDistributor
    // Rewards are distributed via initiateDistribute() which reads from FeeDistributorVault
    console.log("══════════════════════════════════════════════════════════════════════");
    console.log(" REWARD DISTRIBUTION");
    console.log("══════════════════════════════════════════════════════════════════════\n");

    console.log(`ℹ️  esMPD has been minted to FeeDistributor.`);
    console.log(`ℹ️  FeeDistributor distributes rewards via initiateDistribute() function.`);
    console.log(`ℹ️  To trigger distribution, call:`);
    console.log(`   feeDistributor.initiateDistribute()`);
    console.log(`   (Requires FEE_DISTRIBUTION_KEEPER role)\n`);

  } catch (error: any) {
    if (error.message.includes("MINTER_ROLE")) {
      console.error(`❌ ${error.message}`);
      console.error(`\nTo grant minter role, run:`);
      console.error(`   npx hardhat run scripts/grantMinterRole.ts --network localhost`);
    } else {
      throw error;
    }
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ MINTING COMPLETE!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

