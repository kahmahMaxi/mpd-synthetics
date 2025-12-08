/**
 * @title Grant Minter Role
 * @notice Grants minter role on esMPD to specified address
 * @dev Run with: npx hardhat run scripts/grantMinterRole.ts --network localhost [--address 0x...]
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getEsMpdAddress } from "../utils/rewardAdapter";
import { clearTokenAdapterCache } from "../utils/tokenAdapter";

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

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANT MINTER ROLE");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { deployer } = await hre.getNamedAccounts();
  console.log(`Deployer: ${deployer}\n`);

  // Parse CLI args for target address
  let targetAddress = deployer; // Default to deployer
  const addressIndex = process.argv.findIndex((arg) => arg === "--address" || arg.startsWith("--address="));
  if (addressIndex >= 0) {
    if (process.argv[addressIndex].includes("=")) {
      targetAddress = process.argv[addressIndex].split("=")[1];
    } else if (addressIndex + 1 < process.argv.length) {
      targetAddress = process.argv[addressIndex + 1];
    }
  }

  // Get esMPD address
  let esMpdAddress = getEsMpdAddress();

  if (!esMpdAddress) {
    throw new Error("esMPD address not configured. Run configureRewards.ts first.");
  }

  // Check if contract exists
  const contractCodeExists = await contractExists(esMpdAddress);
  
  if (!contractCodeExists) {
    console.log("⚠️  Contract not found at configured address. Loading fresh addresses...\n");
    const networkName = hre.network.name === "localhost" ? "localhost" : hre.network.name;
    const deployments = loadMpdDeployments(networkName);
    
    if (!deployments || !deployments.esMPD) {
      throw new Error(
        `esMPD contract not found at ${esMpdAddress} and no deployment file found.\n` +
        `Please deploy MPD tokens first:\n` +
        `  cd ../mpd-token && npx hardhat run scripts/deploy.js --network ${networkName}`
      );
    }
    
    esMpdAddress = deployments.esMPD;
    clearTokenAdapterCache();
    console.log(`   ✅ Using fresh esMPD address: ${esMpdAddress}\n`);
  }

  console.log("📦 Addresses:");
  console.log(`   esMPD: ${esMpdAddress}`);
  console.log(`   Target: ${targetAddress}\n`);

  // Get contract
  const esMpdAbi = [
    "function isMinter(address) view returns (bool)",
    "function setMinter(address, bool)",
    "function owner() view returns (address)",
  ];
  const esMpd = await hre.ethers.getContractAt(esMpdAbi, esMpdAddress);

  // Verify contract exists
  const contractCode = await hre.ethers.provider.getCode(esMpdAddress);
  if (contractCode === "0x" || contractCode === "0x0") {
    throw new Error(`esMPD contract not found at ${esMpdAddress}`);
  }

  // Check current status
  const owner = await esMpd.owner();
  const isOwner = owner.toLowerCase() === deployer.toLowerCase();
  const isMinter = await esMpd.isMinter(targetAddress);

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" STATUS CHECK");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log(`Owner: ${owner}`);
  console.log(`Deployer is owner: ${isOwner ? "✅ Yes" : "❌ No"}`);
  console.log(`Target is minter: ${isMinter ? "✅ Yes" : "❌ No"}\n`);

  if (!isOwner) {
    throw new Error(`Deployer ${deployer} is not the owner. Only owner can grant minter role.`);
  }

  if (isMinter) {
    console.log("✅ Target address already has minter role. No action needed.\n");
    return;
  }

  // Grant minter role
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANTING MINTER ROLE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`Granting minter role to ${targetAddress}...`);
  const grantTx = await esMpd.setMinter(targetAddress, true);
  const receipt = await grantTx.wait();
  
  console.log(`✅ Minter role granted successfully!`);
  console.log(`   Transaction: ${receipt.transactionHash}\n`);

  // Verify
  const newIsMinter = await esMpd.isMinter(targetAddress);
  if (newIsMinter) {
    console.log("✅ Verification: Target address is now a minter.\n");
  } else {
    console.log("⚠️  Warning: Target address minter status not updated.\n");
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ COMPLETE!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

