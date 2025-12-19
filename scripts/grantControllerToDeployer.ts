/**
 * @title Grant CONTROLLER Role to Deployer
 * @notice Grants CONTROLLER role to a specific deployer address
 * @dev Run with: npx hardhat run scripts/grantControllerToDeployer.ts --network arbitrumSepolia
 *      REQUIRES: The account running this script must have ROLE_ADMIN role
 *
 * Usage:
 *   Set DEPLOYER_ADDRESS env var to the address that needs CONTROLLER role
 *   Or modify the DEPLOYER_ADDRESS constant below
 */

import hre from "hardhat";
import { hashString } from "../utils/hash";

// Set this to the deployer address that needs CONTROLLER role
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || "0xD18E3A123123fCB35130C6d0228851D390aA1FF9";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANT CONTROLLER ROLE TO DEPLOYER");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const [signer] = await hre.ethers.getSigners();

  console.log(`Signer (must have ROLE_ADMIN): ${signer.address}`);
  console.log(`Deployer (will receive CONTROLLER): ${DEPLOYER_ADDRESS}\n`);

  // Load RoleStore
  const roleStore = await get("RoleStore");
  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);

  console.log(`RoleStore: ${roleStore.address}\n`);

  // Check if signer has ROLE_ADMIN
  const ROLE_ADMIN = hashString("ROLE_ADMIN");
  const CONTROLLER_ROLE = hashString("CONTROLLER");

  const signerHasRoleAdmin = await roleStoreContract.hasRole(signer.address, ROLE_ADMIN);
  const deployerHasController = await roleStoreContract.hasRole(DEPLOYER_ADDRESS, CONTROLLER_ROLE);

  console.log("📋 Role Status:");
  console.log(`   Signer has ROLE_ADMIN: ${signerHasRoleAdmin ? "✅ Yes" : "❌ No"}`);
  console.log(`   Deployer has CONTROLLER: ${deployerHasController ? "✅ Yes" : "❌ No"}\n`);

  if (!signerHasRoleAdmin) {
    throw new Error(
      `❌ Signer (${signer.address}) does not have ROLE_ADMIN role.\n` +
        `   This script must be run by an account with ROLE_ADMIN role.\n` +
        `   ROLE_ADMIN addresses on Arbitrum Sepolia:\n` +
        `   - 0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0 (Max)\n` +
        `   - 0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3 (An)`
    );
  }

  if (deployerHasController) {
    console.log("✅ Deployer already has CONTROLLER role. No action needed.\n");
    return;
  }

  // Grant CONTROLLER role
  console.log("📝 Granting CONTROLLER role to deployer...\n");
  try {
    const grantTx = await roleStoreContract.grantRole(DEPLOYER_ADDRESS, CONTROLLER_ROLE);
    console.log(`   Transaction: ${grantTx.hash}`);
    console.log("   Waiting for confirmation...");
    await grantTx.wait();
    console.log("✅ CONTROLLER role granted successfully!\n");
  } catch (error: any) {
    throw new Error(`Failed to grant CONTROLLER role: ${error.message}`);
  }

  // Verify
  const deployerHasControllerAfter = await roleStoreContract.hasRole(DEPLOYER_ADDRESS, CONTROLLER_ROLE);
  if (deployerHasControllerAfter) {
    console.log("✅ Verification: Deployer now has CONTROLLER role\n");
  } else {
    throw new Error("Verification failed: CONTROLLER role was not granted");
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ CONTROLLER ROLE GRANTED TO DEPLOYER!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log("📝 Next Steps:");
  console.log(`   1. Run: npx hardhat run scripts/registerIndexOracle.ts --network arbitrumSepolia`);
  console.log(`   2. The deployer (${DEPLOYER_ADDRESS}) can now register the oracle\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
