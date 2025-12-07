/**
 * @title Grant Keeper Roles
 * @notice Grants keeper roles to deployer account for order execution
 * @dev Run with: npx hardhat keepers:grant --network localhost
 */

import hre from "hardhat";
import { hashString } from "../utils/hash";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANT KEEPER ROLES TO DEPLOYER");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { get } = hre.deployments;
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deployer: ${deployer.address}\n`);

  // Load RoleStore
  const roleStore = await get("RoleStore");
  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);

  console.log(`RoleStore: ${roleStore.address}\n`);

  // Define roles to grant
  const roles = [
    { name: "ORDER_KEEPER", displayName: "ORDER_KEEPER" },
    { name: "MARKET_KEEPER", displayName: "MARKET_KEEPER" },
    { name: "FEE_KEEPER", displayName: "FEE_KEEPER" },
    { name: "ADL_KEEPER", displayName: "ADL_KEEPER" },
    { name: "LIQUIDATION_KEEPER", displayName: "LIQUIDATION_KEEPER" },
  ];

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" GRANTING ROLES");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const grantedRoles: Array<{ name: string; status: string }> = [];

  for (const role of roles) {
    const roleHash = hashString(role.name);
    
    // Check if role is already granted
    const hasRole = await roleStoreContract.hasRole(deployer.address, roleHash);

    if (hasRole) {
      console.log(`⏭️  ${role.displayName} already granted to deployer`);
      grantedRoles.push({ name: role.displayName, status: "Already Granted" });
    } else {
      try {
        await roleStoreContract.grantRole(deployer.address, roleHash);
        console.log(`✅ Granted ${role.displayName} to deployer`);
        grantedRoles.push({ name: role.displayName, status: "Granted" });
      } catch (error: any) {
        console.error(`❌ Failed to grant ${role.displayName}:`, error.message);
        grantedRoles.push({ name: role.displayName, status: `Failed: ${error.message}` });
      }
    }
  }

  // Print summary table
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" ROLE GRANT SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("Role Name".padEnd(25) + "Status");
  console.log("-".repeat(60));
  for (const role of grantedRoles) {
    const statusIcon = role.status === "Granted" || role.status === "Already Granted" ? "✅" : "❌";
    console.log(`${role.name.padEnd(25)}${statusIcon} ${role.status}`);
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ KEEPER ROLES GRANTED!");
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

