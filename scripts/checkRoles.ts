/**
 * @title Check Roles
 * @notice Check what roles an address has in RoleStore
 * @dev Run with: npx hardhat run scripts/checkRoles.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import { hashString } from "../utils/hash";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CHECK ROLES");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { get } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  // Load RoleStore
  const roleStore = await get("RoleStore");
  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);

  console.log(`RoleStore: ${roleStore.address}`);
  console.log(`Deployer: ${deployer}\n`);

  // Check roles
  const roles = ["ROLE_ADMIN", "CONTROLLER", "CONFIG_KEEPER", "ORDER_KEEPER", "MARKET_KEEPER", "FEE_KEEPER"];

  console.log("📋 Role Status for Deployer:");
  console.log("-".repeat(60));
  for (const role of roles) {
    const roleHash = hashString(role);
    const hasRole = await roleStoreContract.hasRole(deployer, roleHash);
    console.log(`${role.padEnd(20)} ${hasRole ? "✅ Granted" : "❌ Not granted"}`);
  }

  // Check who has ROLE_ADMIN
  console.log("\n📋 Addresses with ROLE_ADMIN:");
  console.log("-".repeat(60));
  const ROLE_ADMIN = hashString("ROLE_ADMIN");
  const roleAdminAddresses = [
    "0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0", // Max
    "0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3", // An
  ];

  for (const addr of roleAdminAddresses) {
    const hasRole = await roleStoreContract.hasRole(addr, ROLE_ADMIN);
    console.log(`${addr} ${hasRole ? "✅ Has ROLE_ADMIN" : "❌ No ROLE_ADMIN"}`);
  }

  console.log("\n══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
