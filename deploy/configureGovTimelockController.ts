import { TIMELOCK_ADMIN_ROLE, PROPOSER_ROLE, EXECUTOR_ROLE, CANCELLER_ROLE } from "../utils/gov";

const func = async ({ getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts();

  // Skip on local networks if contracts are not accessible
  if (network.name === "hardhat" || network.name === "localhost") {
    console.info("skipping govTimelockController role config on local network");
    return;
  }

  const govTimelockController = await ethers.getContract("GovTimelockController");
  const protocolGovernor = await ethers.getContract("ProtocolGovernor");

  // Check if deployer has TIMELOCK_ADMIN_ROLE, handle errors gracefully
  let hasAdminRole = false;
  try {
    hasAdminRole = await govTimelockController.hasRole(TIMELOCK_ADMIN_ROLE, deployer);
  } catch (error: any) {
    console.warn(`⚠️  Could not check TIMELOCK_ADMIN_ROLE for deployer: ${error.message}`);
    console.info("skipping govTimelockController role config, as deployer role check failed");
    return;
  }

  if (hasAdminRole) {
    try {
      await govTimelockController.grantRole(PROPOSER_ROLE, protocolGovernor.address);
      await govTimelockController.grantRole(CANCELLER_ROLE, protocolGovernor.address);
      await govTimelockController.grantRole(EXECUTOR_ROLE, protocolGovernor.address);
      await govTimelockController.revokeRole(TIMELOCK_ADMIN_ROLE, deployer);
    } catch (error: any) {
      console.warn(`⚠️  Failed to configure govTimelockController roles: ${error.message}`);
      throw error;
    }
  } else {
    console.info("skipping govTimelockController role config, as deployer does not have access to update roles");
  }
};

func.dependencies = ["GovTimelockController", "ProtocolGovernor"];
func.tags = ["ConfigureGovTimelockController"];

export default func;
