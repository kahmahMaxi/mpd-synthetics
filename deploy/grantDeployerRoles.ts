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
    const hasRole = await read("RoleStore", "hasRole", deployer, roleHash);

    if (!hasRole) {
      log(`Granting ${role} role to deployer ${deployer}`);
      await execute("RoleStore", { from: deployer, log: true }, "grantRole", deployer, roleHash);
    } else {
      log(`Deployer already has ${role} role`);
    }
  }
};

func.tags = ["GrantDeployerRoles"];
func.dependencies = ["RoleStore"];
export default func;

