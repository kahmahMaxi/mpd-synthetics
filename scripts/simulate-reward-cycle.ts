/**
 * @title Simulate Reward Cycle
 * @notice Simulates a complete reward cycle: minting, distribution, staking, vesting, and claiming
 * @dev Run with: npx hardhat run scripts/simulate-reward-cycle.ts --network localhost
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { getMpdAddress, getEsMpdAddress, getVesterAddress, getFeeDistributorAddress } from "../utils/rewardAdapter";
import { clearTokenAdapterCache } from "../utils/tokenAdapter";
import { expandDecimals } from "../utils/math";

/**
 * Check if contract code exists at address
 */
async function contractExists(address: string): Promise<boolean> {
  try {
    const code = await hre.ethers.provider.getCode(address);
    return code !== "0x" && code !== "0x0";
  } catch {
    return false;
  }
}

/**
 * Load MPD token addresses from mpd-token deployments folder
 */
function loadMpdDeployments(network: string): any {
  const networkPath = path.resolve(
    __dirname, "..", "..", "mpd-token", "deployments", `${network}.json`
  );
  const localPath = path.resolve(
    __dirname, "..", "..", "mpd-token", "deployments", "local.json"
  );
  
  if (fs.existsSync(networkPath)) {
    return JSON.parse(fs.readFileSync(networkPath, "utf8"));
  } else if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
  return null;
}

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
    "function depositedAmount(address) view returns (uint256)", // Fixed: singular, not plural
    "function claimable(address) view returns (uint256)",
  ];

  const mpd = await hre.ethers.getContractAt(mpdAbi, mpdAddress);
  const esMpd = await hre.ethers.getContractAt(esMpdAbi, esMpdAddress);
  const vester = await hre.ethers.getContractAt(vesterAbi, vesterAddress);

  const mpdBalance = await mpd.balanceOf(user);
  const esMpdBalance = await esMpd.balanceOf(user);
  
  // Use try-catch for vester calls in case contract doesn't exist
  let vesterDeposit = hre.ethers.BigNumber.from(0);
  let vesterClaimable = hre.ethers.BigNumber.from(0);
  
  try {
    vesterDeposit = await vester.depositedAmount(user); // Fixed: singular
    vesterClaimable = await vester.claimable(user);
  } catch (error) {
    // Contract might not exist, return zeros
    console.warn(`⚠️  Could not read Vester state: ${error}`);
  }

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
  let mpdAddress = getMpdAddress();
  let esMpdAddress = getEsMpdAddress();
  let vesterAddress = getVesterAddress();
  const feeDistributorAddress = await getFeeDistributorAddress();

  if (!mpdAddress || !esMpdAddress || !vesterAddress) {
    throw new Error("MPD token addresses not configured. Run configureRewards.ts first.");
  }

  if (!feeDistributorAddress) {
    throw new Error("FeeDistributor not deployed.");
  }

  // Check if contracts exist and load fresh addresses if needed
  const networkName = hre.network.name === "localhost" ? "localhost" : hre.network.name;
  const mpdExists = await contractExists(mpdAddress);
  const esMpdExists = await contractExists(esMpdAddress);
  const vesterExists = await contractExists(vesterAddress);

  if (!mpdExists || !esMpdExists || !vesterExists) {
    console.log("⚠️  Some contracts not found at configured addresses. Loading fresh addresses...\n");
    const deployments = loadMpdDeployments(networkName);
    
    if (!deployments) {
      throw new Error(
        `MPD contracts not found and no deployment file found.\n` +
        `Please deploy MPD tokens first:\n` +
        `  cd ../mpd-token && npx hardhat run scripts/deploy.js --network ${networkName}`
      );
    }
    
    if (!mpdExists && deployments.MPDToken) mpdAddress = deployments.MPDToken;
    if (!esMpdExists && deployments.esMPD) esMpdAddress = deployments.esMPD;
    if (!vesterExists && deployments.Vester) vesterAddress = deployments.Vester;
    
    clearTokenAdapterCache();
    console.log(`   ✅ Using fresh addresses:\n`);
    console.log(`      MPD: ${mpdAddress}`);
    console.log(`      esMPD: ${esMpdAddress}`);
    console.log(`      Vester: ${vesterAddress}\n`);
  }

  // Use minimal ABIs for contracts from mpd-token repo
  // MPD uses AccessControl (has MINTER_ROLE)
  const mpdAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256)",
    "function MINTER_ROLE() view returns (bytes32)",
    "function hasRole(bytes32, address) view returns (bool)",
  ];
  // esMPD uses isMinter mapping (not AccessControl)
  const esMpdAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256)",
    "function approve(address, uint256) returns (bool)",
    "function isMinter(address) view returns (bool)",
    "function setMinter(address, bool)",
    "function owner() view returns (address)",
  ];
  // Vester uses depositedAmount (singular, not plural)
  const vesterAbi = [
    "function depositedAmount(address) view returns (uint256)", // Fixed: singular
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
    // esMPD uses isMinter mapping, not AccessControl
    const isMinter = await esMpd.isMinter(deployer.address);

    if (isMinter) {
      console.log(`Minting ${hre.ethers.utils.formatEther(rewardAmount)} esMPD to FeeDistributor...`);
      const mintTx = await esMpd.mint(feeDistributorAddress, rewardAmount);
      await mintTx.wait();
      console.log(`✅ Minted successfully\n`);
    } else {
      // Try to grant minter role if deployer is owner
      const owner = await esMpd.owner();
      if (owner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log(`⚠️  Deployer is owner but not a minter. Granting minter role...`);
        const grantTx = await esMpd.setMinter(deployer.address, true);
        await grantTx.wait();
        console.log(`✅ Granted minter role. Minting...`);
        const mintTx = await esMpd.mint(feeDistributorAddress, rewardAmount);
        await mintTx.wait();
        console.log(`✅ Minted successfully\n`);
      } else {
        console.log(`⚠️  Deployer is not a minter. Skipping mint step.\n`);
      }
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
    // esMPD uses isMinter mapping, not AccessControl
    const isMinter = await esMpd.isMinter(deployer.address);

    if (isMinter) {
      console.log(`Minting ${hre.ethers.utils.formatEther(depositAmount)} esMPD to test user...`);
      const mintTx = await esMpd.mint(testUser.address, depositAmount);
      await mintTx.wait();
      console.log(`✅ Minted esMPD to test user\n`);

      // Note: esMPD is non-transferable, so we can't approve/transfer
      // The Vester.deposit() function will burn esMPD directly from user
      // No approval needed since esMPD uses burn() which is called by Vester
      console.log(`Depositing ${hre.ethers.utils.formatEther(depositAmount)} esMPD into Vester...`);
      console.log(`   (Vester will burn esMPD directly - no approval needed)\n`);
      const depositTx = await vester.connect(testUser).deposit(depositAmount);
      await depositTx.wait();
      console.log(`✅ Deposited successfully\n`);
    } else {
      // Try to grant minter role if deployer is owner
      const owner = await esMpd.owner();
      if (owner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log(`⚠️  Deployer is owner but not a minter. Granting minter role...`);
        const grantTx = await esMpd.setMinter(deployer.address, true);
        await grantTx.wait();
        console.log(`✅ Granted minter role. Minting...`);
        const mintTx = await esMpd.mint(testUser.address, depositAmount);
        await mintTx.wait();
        console.log(`✅ Minted esMPD to test user\n`);
        
        console.log(`Depositing ${hre.ethers.utils.formatEther(depositAmount)} esMPD into Vester...`);
        const depositTx = await vester.connect(testUser).deposit(depositAmount);
        await depositTx.wait();
        console.log(`✅ Deposited successfully\n`);
      } else {
        console.log(`⚠️  Deployer is not a minter. Skipping deposit step.\n`);
      }
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

  let claimable = hre.ethers.BigNumber.from(0);
  try {
    claimable = await vester.claimable(testUser.address);
    console.log(`Claimable MPD: ${hre.ethers.utils.formatEther(claimable)} MPD\n`);
  } catch (error: any) {
    console.warn(`⚠️  Could not check claimable amount: ${error.message}\n`);
  }

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

