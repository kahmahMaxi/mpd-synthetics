/**
 * @title Save Deployment Manually
 * @notice Helper script to manually save a deployment to the deployments folder
 * @dev Use this if you deployed a contract with hardhat run instead of hardhat deploy
 *      Run with: npx hardhat run scripts/saveDeployment.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = hre.network.name;
  const deploymentsDir = path.join(__dirname, "..", "deployments", network);

  // Ensure deployments directory exists
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" SAVE DEPLOYMENT MANUALLY");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${network}\n`);

  // Get contract name and address from environment or prompt
  const contractName = process.env.CONTRACT_NAME || "IndexToken";
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error(
      `Please provide CONTRACT_ADDRESS environment variable.\n` +
      `Example: $env:CONTRACT_ADDRESS="0x..."; npx hardhat run scripts/saveDeployment.ts --network arbitrumSepolia`
    );
  }

  console.log(`Contract Name: ${contractName}`);
  console.log(`Contract Address: ${contractAddress}\n`);

  // Verify the contract exists at this address
  try {
    const code = await hre.ethers.provider.getCode(contractAddress);
    if (code === "0x") {
      throw new Error(`No contract found at address ${contractAddress}`);
    }
    console.log(`✅ Contract verified at address\n`);
  } catch (error: any) {
    throw new Error(`Failed to verify contract: ${error.message}`);
  }

  // Get deployer address
  const { deployer } = await hre.getNamedAccounts();
  
  // Get transaction hash if provided
  const txHash = process.env.TX_HASH || "";

  // Create deployment JSON
  const deployment = {
    address: contractAddress,
    abi: [], // ABI will be loaded from artifacts
    transactionHash: txHash,
    args: [], // Args will be loaded from artifacts if available
    libraries: {},
    receipt: null,
  };

  // Try to load ABI from artifacts
  try {
    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "contracts",
      contractName.includes("IndexToken") ? "tokens" : "oracle",
      `${contractName}.sol`,
      `${contractName}.json`
    );

    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      deployment.abi = artifact.abi;
      console.log(`✅ Loaded ABI from artifacts\n`);
    }
  } catch (error: any) {
    console.log(`⚠️  Could not load ABI: ${error.message}\n`);
  }

  // Save deployment file
  const deploymentPath = path.join(deploymentsDir, `${contractName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log(`✅ Deployment saved to: ${deploymentPath}\n`);

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ DEPLOYMENT SAVED!");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📝 Next Steps:");
  console.log(`   You can now run: npx hardhat run scripts/registerIndexOracle.ts --network ${network}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });


