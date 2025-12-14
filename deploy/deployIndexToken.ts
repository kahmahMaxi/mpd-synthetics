import { HardhatRuntimeEnvironment } from "hardhat/types";
import { expandDecimals } from "../utils/math";

/**
 * @title Deploy IndexToken
 * @notice Deploys IndexToken contract for index perpetual markets
 * @dev Deploys "DeFi Index" (DFI) token with 18 decimals
 *      Mints initial supply to deployer for testing
 * 
 * Target Network: Arbitrum Sepolia
 */
const func = async ({ getNamedAccounts, deployments, network, ethers }: HardhatRuntimeEnvironment) => {
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const isTestnet = network.name === "arbitrumSepolia" || network.name === "arbitrumGoerli";

  if (!isTestnet && network.name !== "hardhat") {
    throw new Error(`IndexToken deployment only supported on testnet. Network: ${network.name}`);
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" DEPLOY INDEX TOKEN");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer}\n`);

  // Check if already deployed
  const existing = await deployments.getOrNull("IndexToken");
  if (existing) {
    console.log(`⏭️  IndexToken already deployed at: ${existing.address}`);
    console.log("   Skipping deployment. Use --reset to force redeploy.\n");
    return;
  }

  // Deploy IndexToken
  console.log("📦 Deploying IndexToken...");
  const deployment = await deploy("IndexToken", {
    from: deployer,
    log: true,
    contract: "contracts/tokens/IndexToken.sol:IndexToken",
    args: [
      "DeFi Index", // name
      "DFI", // symbol
      deployer, // initialOwner
    ],
  });

  if (!deployment.newlyDeployed) {
    console.log(`♻️  Reusing existing IndexToken at: ${deployment.address}\n`);
    return;
  }

  console.log(`✅ IndexToken deployed at: ${deployment.address}\n`);

  // Mint initial supply to deployer for testing
  const initialSupply = expandDecimals(1000000, 18); // 1,000,000 DFI
  console.log("💰 Minting initial supply...");
  console.log(`   Amount: ${initialSupply.toString()} DFI (1,000,000 DFI)`);
  console.log(`   Recipient: ${deployer}\n`);

  const indexToken = await ethers.getContractAt("IndexToken", deployment.address);
  const mintTx = await indexToken.mint(deployer, initialSupply);
  await mintTx.wait();

  console.log(`✅ Initial supply minted successfully!`);
  console.log(`   Transaction: ${mintTx.hash}\n`);

  // Verify deployment
  const totalSupply = await indexToken.totalSupply();
  const deployerBalance = await indexToken.balanceOf(deployer);
  const tokenName = await indexToken.name();
  const tokenSymbol = await indexToken.symbol();
  const tokenDecimals = await indexToken.decimals();
  const owner = await indexToken.owner();

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" DEPLOYMENT SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ Token Information                                                  │");
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ Name:        ${tokenName.padEnd(58)} │`);
  console.log(`│ Symbol:      ${tokenSymbol.padEnd(58)} │`);
  console.log(`│ Decimals:    ${tokenDecimals.toString().padEnd(58)} │`);
  console.log(`│ Address:     ${deployment.address.padEnd(58)} │`);
  console.log(`│ Owner:       ${owner.padEnd(58)} │`);
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(`│ Total Supply:    ${totalSupply.toString().padEnd(50)} │`);
  console.log(`│ Deployer Balance: ${deployerBalance.toString().padEnd(49)} │`);
  console.log("└────────────────────────────────────────────────────────────────────┘\n");

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ INDEX TOKEN DEPLOYMENT COMPLETE!");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📝 Next Steps:");
  console.log("   1. Register IndexPriceFeed in DataStore for this token");
  console.log("   2. Create GMX market using this token as indexToken");
  console.log("   3. Seed testnet liquidity\n");
};

func.tags = ["IndexToken"];
func.dependencies = [];

export default func;

