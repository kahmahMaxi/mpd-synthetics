/**
 * @title Grant MARKET_KEEPER Role
 * @notice Grants MARKET_KEEPER role to deployer for creating markets
 * @dev Run with: npx hardhat run scripts/grantMarketKeeperRole.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import { hashString } from "../utils/hash";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANT MARKET_KEEPER ROLE TO DEPLOYER");
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
  const MARKET_KEEPER_ROLE = hashString("MARKET_KEEPER");
  const ROLE_ADMIN = hashString("ROLE_ADMIN");

  const hasMarketKeeper = await roleStoreContract.hasRole(deployer, MARKET_KEEPER_ROLE);
  const hasRoleAdmin = await roleStoreContract.hasRole(deployer, ROLE_ADMIN);

  console.log("📋 Role Status:");
  console.log(`   MARKET_KEEPER: ${hasMarketKeeper ? "✅ Granted" : "❌ Not granted"}`);
  console.log(`   ROLE_ADMIN: ${hasRoleAdmin ? "✅ Granted" : "❌ Not granted"}\n`);

  if (hasMarketKeeper) {
    console.log("✅ Deployer already has MARKET_KEEPER role. No action needed.\n");
    return;
  }

  if (!hasRoleAdmin) {
    throw new Error(
      `❌ Deployer does not have ROLE_ADMIN role.\n` + `   Cannot grant MARKET_KEEPER role without ROLE_ADMIN.`
    );
  }

  // Grant MARKET_KEEPER role
  console.log("📝 Granting MARKET_KEEPER role to deployer...\n");
  try {
    const grantTx = await roleStoreContract.grantRole(deployer, MARKET_KEEPER_ROLE);
    console.log(`   Transaction: ${grantTx.hash}`);
    await grantTx.wait();
    console.log("✅ MARKET_KEEPER role granted successfully!\n");
  } catch (error: any) {
    throw new Error(`Failed to grant MARKET_KEEPER role: ${error.message}`);
  }

  // Verify
  const hasMarketKeeperAfter = await roleStoreContract.hasRole(deployer, MARKET_KEEPER_ROLE);
  if (hasMarketKeeperAfter) {
    console.log("✅ Verification: Deployer now has MARKET_KEEPER role\n");
  } else {
    throw new Error("Verification failed: MARKET_KEEPER role was not granted");
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ MARKET_KEEPER ROLE GRANTED!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
