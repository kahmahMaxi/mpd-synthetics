/**
 * @title Grant ORDER_KEEPER Role
 * @notice Grants ORDER_KEEPER role to deployer for executing deposits/orders
 * @dev Run with: npx hardhat run scripts/grantOrderKeeperRole.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import { hashString } from "../utils/hash";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANT ORDER_KEEPER ROLE TO DEPLOYER");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  // Load RoleStore
  const roleStore = await get("RoleStore");
  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);

  console.log(`RoleStore: ${roleStore.address}\n`);

  // Check roles
  const ORDER_KEEPER_ROLE = hashString("ORDER_KEEPER");
  const ROLE_ADMIN = hashString("ROLE_ADMIN");

  const hasOrderKeeper = await roleStoreContract.hasRole(deployer, ORDER_KEEPER_ROLE);
  const hasRoleAdmin = await roleStoreContract.hasRole(deployer, ROLE_ADMIN);

  console.log("📋 Role Status:");
  console.log(`   ORDER_KEEPER: ${hasOrderKeeper ? "✅ Granted" : "❌ Not granted"}`);
  console.log(`   ROLE_ADMIN: ${hasRoleAdmin ? "✅ Granted" : "❌ Not granted"}\n`);

  if (hasOrderKeeper) {
    console.log("✅ Deployer already has ORDER_KEEPER role. No action needed.\n");
    return;
  }

  if (!hasRoleAdmin) {
    throw new Error(
      `❌ Deployer does not have ROLE_ADMIN role.\n` + `   Cannot grant ORDER_KEEPER role without ROLE_ADMIN.`
    );
  }

  // Grant ORDER_KEEPER role
  console.log("📝 Granting ORDER_KEEPER role to deployer...\n");
  try {
    const grantTx = await roleStoreContract.grantRole(deployer, ORDER_KEEPER_ROLE);
    console.log(`   Transaction: ${grantTx.hash}`);
    await grantTx.wait();
    console.log("✅ ORDER_KEEPER role granted successfully!\n");
  } catch (error: any) {
    throw new Error(`Failed to grant ORDER_KEEPER role: ${error.message}`);
  }

  // Verify
  const hasOrderKeeperAfter = await roleStoreContract.hasRole(deployer, ORDER_KEEPER_ROLE);
  if (hasOrderKeeperAfter) {
    console.log("✅ Verification: Deployer now has ORDER_KEEPER role\n");
  } else {
    throw new Error("Verification failed: ORDER_KEEPER role was not granted");
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ ORDER_KEEPER ROLE GRANTED!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
