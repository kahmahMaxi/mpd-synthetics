// --- MPD Integration Start ---
/**
 * @title Inject MPD DataStore Values
 * @notice Injects MPD token addresses into the deployed DataStore
 * @dev Run with: npx hardhat run scripts/inject-mpd-datastore.ts --network localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";

interface DataStoreInjection {
  type: "SET_ADDRESS" | "SET_UINT";
  key: string;
  keyHash: string;
  value: string | number;
  description: string;
}

interface DeployConfigMPD {
  tokens: {
    governanceToken: { address: string };
    escrowedToken: { address: string };
    vester: { address: string };
  };
  parameters: {
    vestingDuration: number;
  };
  dataStoreInjections: DataStoreInjection[];
}

async function main() {
  console.log("═".repeat(70));
  console.log(" STEP 5: INJECT MPD ADDRESSES INTO DATASTORE");
  console.log("═".repeat(70));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Load deploy config
  const configPath = path.resolve(__dirname, "..", "config", "deploy-config.mpd.json");
  if (!fs.existsSync(configPath)) {
    console.error("❌ Deploy config not found:", configPath);
    process.exit(1);
  }
  const deployConfig: DeployConfigMPD = JSON.parse(fs.readFileSync(configPath, "utf8"));
  console.log("✅ Deploy config loaded");

  // Get DataStore contract
  const dataStoreDeployment = await hre.deployments.get("DataStore");
  const dataStore = await hre.ethers.getContractAt("DataStore", dataStoreDeployment.address);
  console.log("✅ DataStore at:", dataStore.address);

  // Get RoleStore contract to grant CONTROLLER role if needed
  const roleStoreDeployment = await hre.deployments.get("RoleStore");
  const roleStore = await hre.ethers.getContractAt("RoleStore", roleStoreDeployment.address);
  console.log("✅ RoleStore at:", roleStore.address);

  // Check if deployer has CONTROLLER role
  const CONTROLLER = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("CONTROLLER"));
  const hasRole = await roleStore.hasRole(deployer.address, CONTROLLER);
  
  if (!hasRole) {
    console.log("\n⚠️ Deployer doesn't have CONTROLLER role. Granting...");
    const grantTx = await roleStore.grantRole(deployer.address, CONTROLLER);
    await grantTx.wait();
    console.log("✅ CONTROLLER role granted");
  } else {
    console.log("✅ Deployer has CONTROLLER role");
  }

  // Inject MPD addresses
  console.log("\n📝 Injecting MPD addresses into DataStore...\n");

  const txHashes: { key: string; txHash: string; value: string | number }[] = [];

  for (const injection of deployConfig.dataStoreInjections) {
    console.log(`Injecting ${injection.key}...`);
    console.log(`   Type: ${injection.type}`);
    console.log(`   Value: ${injection.value}`);
    console.log(`   Description: ${injection.description}`);

    // Compute the key hash using the same encoding as Solidity
    const keyHash = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], [injection.key])
    );
    console.log(`   Key Hash: ${keyHash}`);

    try {
      let tx;
      if (injection.type === "SET_ADDRESS") {
        tx = await dataStore.setAddress(keyHash, injection.value as string);
      } else if (injection.type === "SET_UINT") {
        tx = await dataStore.setUint(keyHash, injection.value as number);
      }

      const receipt = await tx.wait();
      console.log(`   ✅ TX Hash: ${tx.hash}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      txHashes.push({ key: injection.key, txHash: tx.hash, value: injection.value });
    } catch (e: any) {
      console.error(`   ❌ Failed: ${e.message}`);
    }
    console.log("");
  }

  // Summary
  console.log("═".repeat(70));
  console.log(" DATASTORE INJECTION SUMMARY");
  console.log("═".repeat(70));
  console.log("\n📋 Transactions:");
  txHashes.forEach(({ key, txHash, value }) => {
    console.log(`   ${key}:`);
    console.log(`      Value: ${value}`);
    console.log(`      TX: ${txHash}`);
  });

  // Verify the injections
  console.log("\n🔍 Verifying injections...");
  for (const injection of deployConfig.dataStoreInjections) {
    const keyHash = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], [injection.key])
    );

    let storedValue: string;
    if (injection.type === "SET_ADDRESS") {
      storedValue = await dataStore.getAddress(keyHash);
    } else {
      const val = await dataStore.getUint(keyHash);
      storedValue = val.toString();
    }

    const expected = injection.value.toString().toLowerCase();
    const actual = storedValue.toLowerCase();
    const match = expected === actual;
    
    console.log(`   ${match ? "✅" : "❌"} ${injection.key}: ${storedValue}`);
  }

  console.log("\n✅ DataStore injection complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
// --- MPD Integration End ---

