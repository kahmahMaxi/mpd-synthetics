/**
 * @title Grant CONTROLLER Role
 * @notice Grants CONTROLLER role to deployer for DataStore writes
 * @dev Run with: npx hardhat run scripts/grantControllerRole.ts --network arbitrumSepolia
 *      Requires: Deployer must have ROLE_ADMIN role
 */

import hre from "hardhat";
import { hashString } from "../utils/hash";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANT CONTROLLER ROLE TO DEPLOYER");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // Load RoleStore
  let roleStore;
  try {
    roleStore = await get("RoleStore");
    console.log(`✅ RoleStore: ${roleStore.address}`);
  } catch (error: any) {
    throw new Error(`Failed to load RoleStore: ${error.message}`);
  }

  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);

  // Check roles
  const CONTROLLER_ROLE = hashString("CONTROLLER");
  const ROLE_ADMIN = hashString("ROLE_ADMIN");

  const hasController = await roleStoreContract.hasRole(deployer, CONTROLLER_ROLE);
  const hasRoleAdmin = await roleStoreContract.hasRole(deployer, ROLE_ADMIN);

  console.log(`\n📋 Role Status:`);
  console.log(`   CONTROLLER: ${hasController ? "✅ Granted" : "❌ Not granted"}`);
  console.log(`   ROLE_ADMIN: ${hasRoleAdmin ? "✅ Granted" : "❌ Not granted"}\n`);

  if (hasController) {
    console.log("✅ Deployer already has CONTROLLER role. No action needed.\n");
    return;
  }

  if (!hasRoleAdmin) {
    console.log("❌ Deployer does not have ROLE_ADMIN role.");
    console.log("   Cannot grant CONTROLLER role without ROLE_ADMIN.\n");
    console.log("📋 Options:");
    console.log("   1. Use an account with ROLE_ADMIN role");
    console.log("   2. Have a ROLE_ADMIN grant CONTROLLER to your deployer address");
    console.log(`   Deployer: ${deployer}`);
    console.log(`   RoleStore: ${roleStore.address}\n`);
    throw new Error("Deployer does not have ROLE_ADMIN role");
  }

  // Grant CONTROLLER role
  console.log("📝 Granting CONTROLLER role to deployer...\n");
  try {
    const grantTx = await roleStoreContract.grantRole(deployer, CONTROLLER_ROLE);
    console.log(`   Transaction: ${grantTx.hash}`);
    await grantTx.wait();
    console.log("✅ CONTROLLER role granted successfully!\n");
  } catch (error: any) {
    throw new Error(`Failed to grant CONTROLLER role: ${error.message}`);
  }

  // Verify
  const hasControllerAfter = await roleStoreContract.hasRole(deployer, CONTROLLER_ROLE);
  if (hasControllerAfter) {
    console.log("✅ Verification: Deployer now has CONTROLLER role\n");
  } else {
    throw new Error("Verification failed: CONTROLLER role was not granted");
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ CONTROLLER ROLE GRANTED!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
