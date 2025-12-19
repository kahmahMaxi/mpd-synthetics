/**
 * @title Check RoleStore Deployer
 * @notice Check who deployed RoleStore and if they still have ROLE_ADMIN
 */

import hre from "hardhat";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CHECK ROLESTORE DEPLOYER");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const { get } = hre.deployments;
  const roleStore = await get("RoleStore");
  const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);

  console.log(`RoleStore Address: ${roleStore.address}`);
  console.log(`Transaction Hash: ${roleStore.transactionHash}\n`);

  // Try to get the deployer from the transaction
  try {
    const tx = await hre.ethers.provider.getTransaction(roleStore.transactionHash);
    if (tx) {
      console.log(`Original Deployer (from tx): ${tx.from}`);

      // Check if original deployer still has ROLE_ADMIN
      const ROLE_ADMIN = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
      const hasRoleAdmin = await roleStoreContract.hasRole(tx.from, ROLE_ADMIN);
      console.log(`Original Deployer has ROLE_ADMIN: ${hasRoleAdmin ? "✅ Yes" : "❌ No"}\n`);
    }
  } catch (error: any) {
    console.log(`Could not fetch transaction: ${error.message}\n`);
  }

  // Check current deployer
  const { deployer } = await hre.getNamedAccounts();
  const ROLE_ADMIN = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
  const currentDeployerHasRoleAdmin = await roleStoreContract.hasRole(deployer, ROLE_ADMIN);

  console.log(`Current Deployer: ${deployer}`);
  console.log(`Current Deployer has ROLE_ADMIN: ${currentDeployerHasRoleAdmin ? "✅ Yes" : "❌ No"}\n`);

  if (!currentDeployerHasRoleAdmin) {
    console.log("💡 Solution:");
    console.log("   Since RoleStore was deployed by someone else, you need to:");
    console.log("   1. Have someone with ROLE_ADMIN grant it to you, OR");
    console.log("   2. Redeploy RoleStore (you'll automatically get ROLE_ADMIN)\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
