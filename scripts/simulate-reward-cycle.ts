/**
 * @title Simulate Reward Cycle
 * @notice Simulates a complete reward cycle: minting, distribution, staking, vesting, and claiming
 * @dev Run with: npx hardhat run scripts/simulate-reward-cycle.ts --network localhost
 */

import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { getMpdAddress, getEsMpdAddress, getVesterAddress, getFeeDistributorAddress } from "../utils/rewardAdapter";
import { expandDecimals } from "../utils/math";

interface BalanceSnapshot {
  mpd: string;
  esMpd: string;
  vesterDeposited: string;
  vesterClaimable: string;
}

async function getBalances(user: string): Promise<BalanceSnapshot> {
  const mpdAddress = getMpdAddress();
  const esMpdAddress = getEsMpdAddress();
  const vesterAddress = getVesterAddress();

  // Use minimal ABIs for contracts from mpd-token repo
  const mpdAbi = ["function balanceOf(address) view returns (uint256)"];
  const esMpdAbi = ["function balanceOf(address) view returns (uint256)"];
  const vesterAbi = [
    "function depositedAmounts(address) view returns (uint256)",
    "function claimable(address) view returns (uint256)",
  ];

  const mpd = await hre.ethers.getContractAt(mpdAbi, mpdAddress);
  const esMpd = await hre.ethers.getContractAt(esMpdAbi, esMpdAddress);
  const vester = await hre.ethers.getContractAt(vesterAbi, vesterAddress);

  const mpdBalance = await mpd.balanceOf(user);
  const esMpdBalance = await esMpd.balanceOf(user);
  const vesterDeposit = await vester.depositedAmounts(user);
  const vesterClaimable = await vester.claimable(user);

  return {
    mpd: hre.ethers.utils.formatEther(mpdBalance),
    esMpd: hre.ethers.utils.formatEther(esMpdBalance),
    vesterDeposited: hre.ethers.utils.formatEther(vesterDeposit),
    vesterClaimable: hre.ethers.utils.formatEther(vesterClaimable),
  };
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" SIMULATE REWARD CYCLE");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const [deployer, testUser] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Test User: ${testUser.address}\n`);

  // Get addresses
  const mpdAddress = getMpdAddress();
  const esMpdAddress = getEsMpdAddress();
  const vesterAddress = getVesterAddress();
  const feeDistributorAddress = await getFeeDistributorAddress();

  if (!mpdAddress || !esMpdAddress || !vesterAddress) {
    throw new Error("MPD token addresses not configured. Run configureRewards.ts first.");
  }

  if (!feeDistributorAddress) {
    throw new Error("FeeDistributor not deployed.");
  }

  // Use minimal ABIs for contracts from mpd-token repo
  const mpdAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256)",
    "function MINTER_ROLE() view returns (bytes32)",
    "function hasRole(bytes32, address) view returns (bool)",
  ];
  const esMpdAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256)",
    "function approve(address, uint256) returns (bool)",
    "function MINTER_ROLE() view returns (bytes32)",
    "function hasRole(bytes32, address) view returns (bool)",
  ];
  const vesterAbi = [
    "function depositedAmounts(address) view returns (uint256)",
    "function claimable(address) view returns (uint256)",
    "function deposit(uint256)",
    "function claim()",
    "function withdraw()",
  ];

  const mpd = await hre.ethers.getContractAt(mpdAbi, mpdAddress);
  const esMpd = await hre.ethers.getContractAt(esMpdAbi, esMpdAddress);
  const vester = await hre.ethers.getContractAt(vesterAbi, vesterAddress);
  const feeDistributor = await hre.ethers.getContractAt("FeeDistributor", feeDistributorAddress);

  console.log("📦 Contracts:");
  console.log(`   MPD: ${mpdAddress}`);
  console.log(`   esMPD: ${esMpdAddress}`);
  console.log(`   Vester: ${vesterAddress}`);
  console.log(`   FeeDistributor: ${feeDistributorAddress}\n`);

  // Step 1: Initial balances
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 1: INITIAL STATE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const initialBalances = await getBalances(testUser.address);
  console.log("Test User Balances:");
  console.log(`   MPD: ${initialBalances.mpd}`);
  console.log(`   esMPD: ${initialBalances.esMpd}`);
  console.log(`   Vester Deposited: ${initialBalances.vesterDeposited}`);
  console.log(`   Vester Claimable: ${initialBalances.vesterClaimable}\n`);

  // Step 2: Fund FeeDistributor with esMPD
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 2: FUND FEE DISTRIBUTOR");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const rewardAmount = expandDecimals(10000, 18); // 10000 esMPD

  try {
    const minterRole = await esMpd.MINTER_ROLE();
    const isMinter = await esMpd.hasRole(minterRole, deployer.address);

    if (isMinter) {
      console.log(`Minting ${hre.ethers.utils.formatEther(rewardAmount)} esMPD to FeeDistributor...`);
      const mintTx = await esMpd.mint(feeDistributorAddress, rewardAmount);
      await mintTx.wait();
      console.log(`✅ Minted successfully\n`);
    } else {
      console.log(`⚠️  Deployer is not a minter. Skipping mint step.\n`);
    }
  } catch (error: any) {
    console.warn(`⚠️  Could not mint esMPD: ${error.message}\n`);
  }

  // Step 3: Mint MPD to test user for staking simulation
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 3: FUND TEST USER");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const stakingAmount = expandDecimals(1000, 18); // 1000 MPD

  try {
    const minterRole = await mpd.MINTER_ROLE();
    const isMinter = await mpd.hasRole(minterRole, deployer.address);

    if (isMinter) {
      console.log(`Minting ${hre.ethers.utils.formatEther(stakingAmount)} MPD to test user...`);
      const mintTx = await mpd.mint(testUser.address, stakingAmount);
      await mintTx.wait();
      console.log(`✅ Minted successfully\n`);
    } else {
      console.log(`⚠️  Deployer is not a minter. Skipping mint step.\n`);
    }
  } catch (error: any) {
    console.warn(`⚠️  Could not mint MPD: ${error.message}\n`);
  }

  // Step 4: Simulate reward distribution (if FeeDistributor has distribute function)
  // Note: FeeDistributor uses initiateDistribute() which requires FEE_DISTRIBUTION_KEEPER role
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 4: REWARD DISTRIBUTION");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`ℹ️  FeeDistributor distributes rewards via initiateDistribute().`);
  console.log(`ℹ️  This requires FEE_DISTRIBUTION_KEEPER role and proper configuration.`);
  console.log(`ℹ️  For this simulation, we'll skip actual distribution.\n`);

  // Step 5: Simulate user claiming esMPD rewards and depositing into Vester
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 5: USER DEPOSITS esMPD INTO VESTER");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const depositAmount = expandDecimals(100, 18); // 100 esMPD

  try {
    // Mint esMPD to test user
    const minterRole = await esMpd.MINTER_ROLE();
    const isMinter = await esMpd.hasRole(minterRole, deployer.address);

    if (isMinter) {
      console.log(`Minting ${hre.ethers.utils.formatEther(depositAmount)} esMPD to test user...`);
      const mintTx = await esMpd.mint(testUser.address, depositAmount);
      await mintTx.wait();
      console.log(`✅ Minted esMPD to test user\n`);

      // Approve Vester to spend esMPD
      console.log(`Approving Vester to spend esMPD...`);
      const approveTx = await esMpd.connect(testUser).approve(vesterAddress, depositAmount);
      await approveTx.wait();
      console.log(`✅ Approved\n`);

      // Deposit into Vester
      console.log(`Depositing ${hre.ethers.utils.formatEther(depositAmount)} esMPD into Vester...`);
      const depositTx = await vester.connect(testUser).deposit(depositAmount);
      await depositTx.wait();
      console.log(`✅ Deposited successfully\n`);
    } else {
      console.log(`⚠️  Deployer is not a minter. Skipping deposit step.\n`);
    }
  } catch (error: any) {
    console.warn(`⚠️  Could not deposit into Vester: ${error.message}\n`);
  }

  // Step 6: Fast-forward time and check claimable
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 6: FAST-FORWARD TIME (7 DAYS)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const sevenDays = 7 * 24 * 60 * 60;
  const currentTime = await time.latest();
  const newTime = currentTime + sevenDays;

  console.log(`Current time: ${new Date(currentTime * 1000).toISOString()}`);
  console.log(`Fast-forwarding ${sevenDays} seconds (7 days)...`);
  await time.increaseTo(newTime);
  console.log(`New time: ${new Date(newTime * 1000).toISOString()}\n`);

  // Step 7: Check claimable amount
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 7: CHECK CLAIMABLE AMOUNT");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const claimable = await vester.claimable(testUser.address);
  console.log(`Claimable MPD: ${hre.ethers.utils.formatEther(claimable)} MPD\n`);

  // Step 8: Claim from Vester
  if (claimable.gt(0)) {
    console.log("══════════════════════════════════════════════════════════════════════");
    console.log(" STEP 8: CLAIM FROM VESTER");
    console.log("══════════════════════════════════════════════════════════════════════\n");

    try {
      console.log(`Claiming ${hre.ethers.utils.formatEther(claimable)} MPD from Vester...`);
      const claimTx = await vester.connect(testUser).claim();
      await claimTx.wait();
      console.log(`✅ Claimed successfully\n`);
    } catch (error: any) {
      console.warn(`⚠️  Could not claim: ${error.message}\n`);
    }
  } else {
    console.log("⚠️  No claimable amount yet. Vesting may require more time.\n");
  }

  // Step 9: Final balances
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STEP 9: FINAL STATE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const finalBalances = await getBalances(testUser.address);

  // Print comparison table
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" BEFORE / AFTER COMPARISON");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("┌──────────────────────────┬──────────────────┬──────────────────┬──────────────┐");
  console.log("│ Token                   │ Before           │ After            │ Change       │");
  console.log("├──────────────────────────┼──────────────────┼──────────────────┼──────────────┤");

  const comparisons = [
    ["MPD", initialBalances.mpd, finalBalances.mpd],
    ["esMPD", initialBalances.esMpd, finalBalances.esMpd],
    ["Vester Deposited", initialBalances.vesterDeposited, finalBalances.vesterDeposited],
    ["Vester Claimable", initialBalances.vesterClaimable, finalBalances.vesterClaimable],
  ];

  for (const [token, before, after] of comparisons) {
    const beforeNum = parseFloat(before);
    const afterNum = parseFloat(after);
    const change = afterNum - beforeNum;
    const changeStr = change >= 0 ? `+${change.toFixed(4)}` : change.toFixed(4);

    console.log(
      `│ ${token.padEnd(24)} │ ${before.padEnd(16)} │ ${after.padEnd(16)} │ ${changeStr.padEnd(12)} │`
    );
  }

  console.log("└──────────────────────────┴──────────────────┴──────────────────┴──────────────┘\n");

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ REWARD CYCLE SIMULATION COMPLETE!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

