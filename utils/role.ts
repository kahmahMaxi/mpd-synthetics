import { hashString } from "./hash";
import hre from "hardhat";

export async function grantRole(roleStore, account, role) {
  await roleStore.grantRole(account, hashString(role));
}

export async function revokeRole(roleStore, account, role) {
  await roleStore.revokeRole(account, hashString(role));
}

export async function grantRoleIfNotGranted(deployedContract, role: string, addressLabel = "") {
  if (hre.gmx.isExistingMainnetDeployment) {
    return;
  }

  const { address } = deployedContract;
  const { deployments, getNamedAccounts } = hre;
  const { read, execute, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const contractName = deployedContract.contractName || addressLabel || address;
  log(`grantRoleIfNotGranted: ${contractName}, ${role}`);

  const roleHash = hashString(role);
  
  // Check if RoleStore is deployed and accessible
  let hasRole = false;
  try {
    // Try to get RoleStore deployment first
    const roleStore = await deployments.get("RoleStore");
    if (!roleStore || !roleStore.address) {
      throw new Error("RoleStore not deployed");
    }
    
    // Use direct contract call instead of deployments.read for better error handling
    const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);
    hasRole = await roleStoreContract.hasRole(address, roleHash);
  } catch (error: any) {
    // If RoleStore is not accessible, log warning and attempt to grant anyway
    log(`⚠️  Could not check role for ${contractName}: ${error.message}`);
    log(`   Attempting to grant role anyway...`);
    hasRole = false; // Assume role is not granted if we can't check
  }

  if (!hasRole) {
    try {
      log("granting role %s to %s %s", role, addressLabel, address);
      await execute("RoleStore", { from: deployer, log: true }, "grantRole", address, roleHash);
    } catch (error: any) {
      log(`❌ Failed to grant role ${role} to ${contractName}: ${error.message}`);
      throw error;
    }
  } else {
    log("role %s already granted to %s %s", role, addressLabel, address);
  }
}

export async function revokeRoleIfGranted(contract, role: string, addressLabel = "") {
  if (hre.gmx.isExistingMainnetDeployment) {
    return;
  }

  const { address } = contract;
  const { deployments, getNamedAccounts } = hre;
  const { read, execute, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const contractName = contract.contractName || addressLabel || address;
  const roleHash = hashString(role);
  
  // Check if RoleStore is deployed and accessible
  let hasRole = false;
  try {
    // Try to get RoleStore deployment first
    const roleStore = await deployments.get("RoleStore");
    if (!roleStore || !roleStore.address) {
      throw new Error("RoleStore not deployed");
    }
    
    // Use direct contract call instead of deployments.read for better error handling
    const roleStoreContract = await hre.ethers.getContractAt("RoleStore", roleStore.address);
    hasRole = await roleStoreContract.hasRole(address, roleHash);
  } catch (error: any) {
    // If RoleStore is not accessible, log warning and skip
    log(`⚠️  Could not check role for ${contractName}: ${error.message}`);
    return;
  }

  if (hasRole) {
    try {
      log("revoking role %s for %s %s", role, addressLabel, address);
      await execute("RoleStore", { from: deployer, log: true }, "revokeRole", address, roleHash);
    } catch (error: any) {
      log(`❌ Failed to revoke role ${role} from ${contractName}: ${error.message}`);
      throw error;
    }
  } else {
    log("role %s already revoked for %s %s", role, addressLabel, address);
  }
}
