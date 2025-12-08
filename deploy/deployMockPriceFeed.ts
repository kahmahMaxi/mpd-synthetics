import { HardhatRuntimeEnvironment } from "hardhat/types";

const func = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy, getOrNull, delete: deleteDeployment } = deployments;
  const { deployer } = await getNamedAccounts();
  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";

  // For local networks, delete existing deployment if transaction verification fails
  if (isLocalNetwork) {
    const existing = await getOrNull("MockPriceFeed");
    if (existing) {
      try {
        await deleteDeployment("MockPriceFeed");
      } catch (e) {
        // Ignore deletion errors
      }
    }
  }

  await deploy("MockPriceFeed", {
    from: deployer,
    log: true,
    contract: "contracts/oracle/MockPriceFeed.sol:MockPriceFeed",
    args: [0], // MockPriceFeed requires initial price - use 0 as default, will be set later
    resetMemory: isLocalNetwork,
    force: isLocalNetwork,
  });
};

func.dependencies = [];
func.tags = ["MockPriceFeed"];

export default func;
