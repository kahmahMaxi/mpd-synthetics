import { HardhatRuntimeEnvironment } from "hardhat/types";

const func = async ({ getNamedAccounts, deployments, gmx, network }: HardhatRuntimeEnvironment) => {
  const { deploy, execute, getOrNull, delete: deleteDeployment } = deployments;
  const { deployer } = await getNamedAccounts();
  const tokens = await gmx.getTokens();
  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";

  for (const [tokenSymbol, { priceFeed }] of Object.entries(tokens)) {
    if (!priceFeed || !priceFeed.deploy) {
      continue;
    }

    const contractName = `${tokenSymbol}PriceFeed`;
    
    // For local networks, delete existing deployment if transaction verification fails
    if (isLocalNetwork) {
      const existing = await getOrNull(contractName);
      if (existing) {
        try {
          await deleteDeployment(contractName);
        } catch (e) {
          // Ignore deletion errors
        }
      }
    }
    
    const { address } = await deploy(contractName, {
      from: deployer,
      log: true,
      contract: "contracts/oracle/MockPriceFeed.sol:MockPriceFeed",
      args: [priceFeed.initPrice], // MockPriceFeed constructor requires initial price
      resetMemory: isLocalNetwork, // Reset memory for local networks
      force: isLocalNetwork, // Force redeploy on local networks
    });
    priceFeed.address = address;
  }
};

func.dependencies = ["Tokens", "DataStore"];
func.tags = ["PriceFeeds"];
export default func;
