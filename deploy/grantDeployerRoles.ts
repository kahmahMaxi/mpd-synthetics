import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hashString } from "../utils/hash";

const func = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { execute, read, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // Only grant roles on local networks
  if (network.live) {
    log("Skipping deployer role grants on live network");
    return;
  }

  const roles = ["CONTROLLER", "MARKET_KEEPER", "FEE_KEEPER", "CONFIG_KEEPER", "ORDER_KEEPER"];

  for (const role of roles) {
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
      hasRole = await roleStoreContract.hasRole(deployer, roleHash);
    } catch (error: any) {
      // If RoleStore is not accessible, log warning and attempt to grant anyway
      log(`⚠️  Could not check ${role} role for deployer: ${error.message}`);
      log(`   Attempting to grant role anyway...`);
      hasRole = false; // Assume role is not granted if we can't check
    }

    if (!hasRole) {
      try {
        log(`Granting ${role} role to deployer ${deployer}`);
        await execute("RoleStore", { from: deployer, log: true }, "grantRole", deployer, roleHash);
      } catch (error: any) {
        log(`❌ Failed to grant ${role} role to deployer: ${error.message}`);
        throw error;
      }
    } else {
      log(`Deployer already has ${role} role`);
    }
  }
};

func.tags = ["GrantDeployerRoles"];
func.dependencies = ["RoleStore"];
export default func;

