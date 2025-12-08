/**
 * @title Mint and Distribute esMPD
 * @notice Mints esMPD tokens to FeeDistributor for reward distribution
 * @dev Run with: npx hardhat run scripts/mintAndDistributeEsMpd.ts --network localhost [--amount 10000000000000000000000]
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getEsMpdAddress, getFeeDistributorAddress } from "../utils/rewardAdapter";
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
  // Try network-specific file first (e.g., localhost.json)
  const networkPath = path.resolve(
    __dirname, "..", "..", "mpd-token", "deployments", `${network}.json`
  );
  
  // Fallback to local.json
  const localPath = path.resolve(
    __dirname, "..", "..", "mpd-token", "deployments", "local.json"
  );
  
  if (fs.existsSync(networkPath)) {
    console.log(`   📂 Loading deployments from: ${network}.json`);
    return JSON.parse(fs.readFileSync(networkPath, "utf8"));
  } else if (fs.existsSync(localPath)) {
    console.log(`   📂 Loading deployments from: local.json (fallback)`);
    return JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
  
  return null;
}

/**
 * Update tokens.mpd.json with fresh addresses
 */
function updateMpdConfig(deployments: any, network: string) {
  const configPath = path.resolve(__dirname, "..", "config", "tokens.mpd.json");
  const config = {
    network: network,
    MPDToken: deployments.MPDToken,
    esMPD: deployments.esMPD,
    Vester: deployments.Vester,
    deployer: deployments.deployer,
    timestamp: deployments.timestamp || new Date().toISOString(),
    vestingDuration: deployments.vestingDuration || 31536000,
    addresses: {
      mpd: deployments.MPDToken,
      esMpd: deployments.esMPD,
      vester: deployments.Vester,
    },
    meta: {
      source: `../../mpd-token/deployments/${network}.json`,
      generated: new Date().toISOString(),
    },
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`   ✅ Updated config/tokens.mpd.json`);
}

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
  let esMpdAddress = getEsMpdAddress();
  const feeDistributorAddress = await getFeeDistributorAddress();

  if (!esMpdAddress) {
    throw new Error("esMPD address not configured. Run configureRewards.ts first.");
  }

  if (!feeDistributorAddress) {
    throw new Error("FeeDistributor not deployed. Deploy it first.");
  }

  // Check if contract exists at address (for localhost, addresses change on restart)
  const contractCodeExists = await contractExists(esMpdAddress);
  
  if (!contractCodeExists) {
    console.log("⚠️  Contract not found at configured address. Loading fresh addresses...\n");
    
    // Try to load from mpd-token deployments
    const networkName = hre.network.name === "localhost" ? "localhost" : hre.network.name;
    const deployments = loadMpdDeployments(networkName);
    
    if (!deployments || !deployments.esMPD) {
      throw new Error(
        `esMPD contract not found at ${esMpdAddress} and no deployment file found.\n` +
        `Please deploy MPD tokens first:\n` +
        `  cd ../mpd-token && npx hardhat run scripts/deploy.js --network ${networkName}`
      );
    }
    
    // Update config with fresh addresses
    esMpdAddress = deployments.esMPD;
    updateMpdConfig(deployments, networkName);
    clearTokenAdapterCache(); // Clear cache to pick up new addresses
    console.log(`   ✅ Using fresh esMPD address: ${esMpdAddress}\n`);
  }

  console.log("📦 Addresses:");
  console.log(`   esMPD: ${esMpdAddress}`);
  console.log(`   FeeDistributor: ${feeDistributorAddress}`);
  console.log(`   Amount: ${hre.ethers.utils.formatEther(amount)} esMPD\n`);

  // Get contracts
  // EsMPD is in mpd-token repo, uses isMinter mapping (not AccessControl)
  const esMpdAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256)",
    "function isMinter(address) view returns (bool)",
    "function setMinter(address, bool)",
    "function owner() view returns (address)",
  ];
  const esMpd = await hre.ethers.getContractAt(esMpdAbi, esMpdAddress);
  const feeDistributor = await hre.ethers.getContractAt("FeeDistributor", feeDistributorAddress);

  // Verify contract exists and has code
  const contractCode = await hre.ethers.provider.getCode(esMpdAddress);
  if (contractCode === "0x" || contractCode === "0x0") {
    throw new Error(
      `esMPD contract not found at ${esMpdAddress}.\n` +
      `Please deploy MPD tokens first:\n` +
      `  cd ../mpd-token && npx hardhat run scripts/deploy.js --network ${hre.network.name}`
    );
  }

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
    
    // Check if deployer has minter permission
    const isMinter = await esMpd.isMinter(deployer);
    
    if (!isMinter) {
      // Check if deployer is owner (can grant minter role)
      const owner = await esMpd.owner();
      const isOwner = owner.toLowerCase() === deployer.toLowerCase();
      
      if (isOwner) {
        console.log(`⚠️  Deployer is owner but not a minter. Granting minter role...`);
        const grantTx = await esMpd.setMinter(deployer, true);
        await grantTx.wait();
        console.log(`✅ Granted minter role to deployer\n`);
      } else {
        throw new Error(
          `Deployer ${deployer} is not a minter on esMPD.\n` +
          `Owner is: ${owner}\n` +
          `Please grant minter role first:\n` +
          `  npx hardhat run scripts/grantMinterRole.ts --network ${hre.network.name}`
        );
      }
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
    if (error.message.includes("not a minter") || error.message.includes("MINTER")) {
      console.error(`❌ ${error.message}`);
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

