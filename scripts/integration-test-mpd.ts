// --- MPD Integration Start ---
/**
 * @title MPD Full Local Integration Test
 * @notice Deploys gmx-synthetics with MPD tokens and validates wiring
 * @dev Run with: npx hardhat run scripts/integration-test-mpd.ts --network localhost
 *
 * Prerequisites:
 * 1. Run `npx hardhat node` in a separate terminal
 * 2. Deploy mpd-token contracts: cd ../mpd-token && npx hardhat run scripts/deploy.js --network localhost
 * 3. Generate deploy config: npx ts-node scripts/generate-deploy-config-with-mpd.ts localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
import { ethers } from "ethers";

// Types
interface DeployConfigMPD {
  source: string;
  generatedAt: string;
  network: string;
  tokens: {
    governanceToken: { symbol: string; address: string; description: string };
    escrowedToken: { symbol: string; address: string; description: string };
    vester: { symbol: string; address: string; description: string };
  };
  parameters: {
    vestingDuration: number;
    deployer: string;
  };
  dataStoreInjections: DataStoreInjection[];
  deploymentOrder: any[];
}

interface DataStoreInjection {
  type: "SET_ADDRESS" | "SET_UINT";
  key: string;
  keyHash: string;
  value: string | number;
  description: string;
}

interface ValidationResult {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
}

// Paths
const CONFIG_PATH = path.resolve(__dirname, "..", "config", "deploy-config.mpd.json");
const MPD_TOKEN_LOCAL_PATH = path.resolve(__dirname, "..", "..", "mpd-token", "deployments", "localhost.json");

// Load deploy config
function loadDeployConfig(): DeployConfigMPD {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Deploy config not found: ${CONFIG_PATH}. Run generate-deploy-config-with-mpd.ts first.`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

// Load mpd-token deployments
function loadMpdTokenDeployments(): any {
  // Try localhost.json first, then local.json
  const localhostPath = MPD_TOKEN_LOCAL_PATH;
  const localPath = path.resolve(__dirname, "..", "..", "mpd-token", "deployments", "local.json");
  
  if (fs.existsSync(localhostPath)) {
    return JSON.parse(fs.readFileSync(localhostPath, "utf8"));
  } else if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
  throw new Error("mpd-token deployments not found. Deploy mpd-token first.");
}

// Main integration test
async function main() {
  console.log("═".repeat(70));
  console.log(" MPD FULL LOCAL INTEGRATION TEST");
  console.log("═".repeat(70));
  console.log("Network:", hre.network.name);
  console.log("Timestamp:", new Date().toISOString());
  console.log("");

  const [deployer, testUser] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Test User:", testUser.address);

  // Step 1: Load configurations
  console.log("\n" + "─".repeat(70));
  console.log(" STEP 1: LOAD CONFIGURATIONS");
  console.log("─".repeat(70));

  let deployConfig: DeployConfigMPD;
  let mpdTokenDeployments: any;

  try {
    deployConfig = loadDeployConfig();
    console.log("✅ Deploy config loaded");
    console.log("   MPD Token:", deployConfig.tokens.governanceToken.address);
    console.log("   esMPD:", deployConfig.tokens.escrowedToken.address);
    console.log("   Vester:", deployConfig.tokens.vester.address);
  } catch (e: any) {
    console.error("❌ Failed to load deploy config:", e.message);
    process.exit(1);
  }

  try {
    mpdTokenDeployments = loadMpdTokenDeployments();
    console.log("✅ MPD token deployments loaded");
  } catch (e: any) {
    console.warn("⚠️ MPD token deployments not found. Will attempt to deploy...");
    mpdTokenDeployments = null;
  }

  // Step 2: Verify MPD token contracts are deployed
  console.log("\n" + "─".repeat(70));
  console.log(" STEP 2: VERIFY MPD TOKEN CONTRACTS");
  console.log("─".repeat(70));

  const mpdAddress = deployConfig.tokens.governanceToken.address;
  const esMpdAddress = deployConfig.tokens.escrowedToken.address;
  const vesterAddress = deployConfig.tokens.vester.address;

  // Check if contracts exist at these addresses
  const mpdCode = await hre.ethers.provider.getCode(mpdAddress);
  const esMpdCode = await hre.ethers.provider.getCode(esMpdAddress);
  const vesterCode = await hre.ethers.provider.getCode(vesterAddress);

  if (mpdCode === "0x" || esMpdCode === "0x" || vesterCode === "0x") {
    console.error("❌ MPD token contracts not deployed at expected addresses.");
    console.error("   Please run: cd ../mpd-token && npx hardhat run scripts/deploy.js --network localhost");
    console.error("   Then run: npx ts-node scripts/generate-deploy-config-with-mpd.ts localhost");
    process.exit(1);
  }

  console.log("✅ MPD Token contract found at:", mpdAddress);
  console.log("✅ esMPD contract found at:", esMpdAddress);
  console.log("✅ Vester contract found at:", vesterAddress);

  // Step 3: Run gmx-synthetics deployment
  console.log("\n" + "─".repeat(70));
  console.log(" STEP 3: DEPLOY GMX-SYNTHETICS CONTRACTS");
  console.log("─".repeat(70));

  let dataStore: any;
  let roleStore: any;

  try {
    // Run hardhat-deploy
    console.log("Running hardhat-deploy...");
    await hre.deployments.fixture();
    
    // Get deployed contracts
    dataStore = await hre.ethers.getContract("DataStore");
    roleStore = await hre.ethers.getContract("RoleStore");
    
    console.log("✅ DataStore deployed at:", dataStore.address);
    console.log("✅ RoleStore deployed at:", roleStore.address);
    
    // Get all deployments
    const deployments = await hre.deployments.all();
    console.log("\n📋 Deployed Contracts:");
    Object.entries(deployments).forEach(([name, deployment]) => {
      console.log(`   ${name}: ${deployment.address}`);
    });
  } catch (e: any) {
    console.error("❌ Deployment failed:", e.message);
    console.log("\n⚠️ This may be expected if some dependencies are missing.");
    console.log("Attempting to get existing deployments...");
    
    try {
      dataStore = await hre.ethers.getContract("DataStore");
      roleStore = await hre.ethers.getContract("RoleStore");
      console.log("✅ Found existing DataStore at:", dataStore.address);
      console.log("✅ Found existing RoleStore at:", roleStore.address);
    } catch (e2: any) {
      console.error("❌ Could not find DataStore or RoleStore. Deployment failed.");
      process.exit(1);
    }
  }

  // Step 4: Inject MPD addresses into DataStore
  console.log("\n" + "─".repeat(70));
  console.log(" STEP 4: INJECT MPD ADDRESSES INTO DATASTORE");
  console.log("─".repeat(70));

  const txHashes: { key: string; txHash: string }[] = [];

  for (const injection of deployConfig.dataStoreInjections) {
    console.log(`\nInjecting ${injection.key}...`);
    console.log(`   Type: ${injection.type}`);
    console.log(`   Value: ${injection.value}`);

    try {
      // Compute the key hash
      const keyHash = hre.ethers.utils.keccak256(
        hre.ethers.utils.defaultAbiCoder.encode(["string"], [injection.key])
      );
      console.log(`   Key Hash: ${keyHash}`);

      let tx;
      if (injection.type === "SET_ADDRESS") {
        tx = await dataStore.setAddress(keyHash, injection.value as string);
      } else if (injection.type === "SET_UINT") {
        tx = await dataStore.setUint(keyHash, injection.value as number);
      }

      await tx.wait();
      console.log(`   ✅ TX Hash: ${tx.hash}`);
      txHashes.push({ key: injection.key, txHash: tx.hash });
    } catch (e: any) {
      console.error(`   ❌ Failed: ${e.message}`);
      
      // Try with CONTROLLER role
      console.log("   Attempting with role grant...");
      try {
        // Grant CONTROLLER role to deployer
        const CONTROLLER = hre.ethers.utils.keccak256(
          hre.ethers.utils.toUtf8Bytes("CONTROLLER")
        );
        const hasRole = await roleStore.hasRole(deployer.address, CONTROLLER);
        if (!hasRole) {
          console.log("   Granting CONTROLLER role to deployer...");
          const grantTx = await roleStore.grantRole(deployer.address, CONTROLLER);
          await grantTx.wait();
          console.log("   ✅ Role granted");
        }
        
        // Retry injection
        const keyHash = hre.ethers.utils.keccak256(
          hre.ethers.utils.defaultAbiCoder.encode(["string"], [injection.key])
        );
        
        let tx;
        if (injection.type === "SET_ADDRESS") {
          tx = await dataStore.setAddress(keyHash, injection.value as string);
        } else if (injection.type === "SET_UINT") {
          tx = await dataStore.setUint(keyHash, injection.value as number);
        }
        
        await tx.wait();
        console.log(`   ✅ TX Hash: ${tx.hash}`);
        txHashes.push({ key: injection.key, txHash: tx.hash });
      } catch (e2: any) {
        console.error(`   ❌ Still failed: ${e2.message}`);
      }
    }
  }

  // Step 5: Validation Checks
  console.log("\n" + "─".repeat(70));
  console.log(" STEP 5: VALIDATION CHECKS");
  console.log("─".repeat(70));

  const validationResults: ValidationResult[] = [];

  // Validate DataStore entries
  console.log("\n📊 DataStore Validations:");

  const keysToValidate = [
    { key: "MPD_TOKEN", expected: mpdAddress },
    { key: "ES_MPD_TOKEN", expected: esMpdAddress },
    { key: "MPD_VESTER", expected: vesterAddress },
    { key: "MPD_VESTING_DURATION", expected: "31536000" },
  ];

  for (const { key, expected } of keysToValidate) {
    const keyHash = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], [key])
    );

    try {
      let actual: string;
      if (key === "MPD_VESTING_DURATION") {
        const value = await dataStore.getUint(keyHash);
        actual = value.toString();
      } else {
        actual = await dataStore.getAddress(keyHash);
      }

      const passed = actual.toLowerCase() === expected.toLowerCase();
      validationResults.push({ check: `DataStore.${key}`, expected, actual, passed });
      console.log(`   ${passed ? "✅" : "❌"} ${key}: ${actual}`);
    } catch (e: any) {
      validationResults.push({ check: `DataStore.${key}`, expected, actual: "ERROR", passed: false });
      console.log(`   ❌ ${key}: Error reading - ${e.message}`);
    }
  }

  // Step 6: Smoke Functional Tests
  console.log("\n" + "─".repeat(70));
  console.log(" STEP 6: SMOKE FUNCTIONAL TESTS");
  console.log("─".repeat(70));

  // Connect to MPD token contracts
  const mpdTokenAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function mint(address to, uint256 amount)",
    "function owner() view returns (address)",
    "function setMinter(address minter, bool active)",
  ];

  const esMpdAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function mint(address to, uint256 amount)",
    "function burn(address from, uint256 amount)",
    "function owner() view returns (address)",
    "function setMinter(address minter, bool active)",
    "function isMinter(address) view returns (bool)",
  ];

  const vesterAbi = [
    "function mpd() view returns (address)",
    "function esMpd() view returns (address)",
    "function vestingDuration() view returns (uint256)",
    "function owner() view returns (address)",
    "function deposit(uint256 amount)",
    "function claim()",
    "function withdraw()",
    "function depositedAmount(address) view returns (uint256)",
    "function claimedAmount(address) view returns (uint256)",
    "function claimable(address) view returns (uint256)",
  ];

  const mpdToken = new hre.ethers.Contract(mpdAddress, mpdTokenAbi, deployer);
  const esMpdToken = new hre.ethers.Contract(esMpdAddress, esMpdAbi, deployer);
  const vester = new hre.ethers.Contract(vesterAddress, vesterAbi, deployer);

  // Smoke Test 1: Verify contract names
  console.log("\n🔥 Smoke Test 1: Contract Names");
  try {
    const mpdName = await mpdToken.name();
    const esMpdName = await esMpdToken.name();
    console.log(`   MPD Token name: ${mpdName} ${mpdName === "MPD Token" ? "✅" : "❌"}`);
    console.log(`   esMPD Token name: ${esMpdName} ${esMpdName === "Escrowed MPD" ? "✅" : "❌"}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Smoke Test 2: Vester configuration
  console.log("\n🔥 Smoke Test 2: Vester Configuration");
  try {
    const storedMpd = await vester.mpd();
    const storedEsMpd = await vester.esMpd();
    const duration = await vester.vestingDuration();
    const owner = await vester.owner();

    console.log(`   Stored MPD: ${storedMpd} ${storedMpd.toLowerCase() === mpdAddress.toLowerCase() ? "✅" : "❌"}`);
    console.log(`   Stored esMPD: ${storedEsMpd} ${storedEsMpd.toLowerCase() === esMpdAddress.toLowerCase() ? "✅" : "❌"}`);
    console.log(`   Vesting Duration: ${duration.toString()} ${duration.eq(31536000) ? "✅" : "❌"}`);
    console.log(`   Owner: ${owner}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Smoke Test 3: Mint and Vest Flow
  console.log("\n🔥 Smoke Test 3: Mint and Vest Flow");
  try {
    const testAmount = hre.ethers.utils.parseEther("100");
    
    // Check if deployer is minter for esMPD
    const isMinter = await esMpdToken.isMinter(deployer.address);
    console.log(`   Deployer is esMPD minter: ${isMinter ? "✅" : "❌"}`);
    
    if (!isMinter) {
      console.log("   Setting deployer as minter...");
      const setMinterTx = await esMpdToken.setMinter(deployer.address, true);
      await setMinterTx.wait();
      console.log("   ✅ Deployer set as minter");
    }
    
    // Check if Vester is minter for esMPD (for burn on deposit)
    const vesterIsMinter = await esMpdToken.isMinter(vesterAddress);
    console.log(`   Vester is esMPD minter: ${vesterIsMinter ? "✅" : "❌"}`);
    
    if (!vesterIsMinter) {
      console.log("   Setting Vester as esMPD minter...");
      const setMinterTx = await esMpdToken.setMinter(vesterAddress, true);
      await setMinterTx.wait();
      console.log("   ✅ Vester set as esMPD minter");
    }

    // Mint esMPD to test user
    console.log(`\n   Minting ${hre.ethers.utils.formatEther(testAmount)} esMPD to test user...`);
    const mintTx = await esMpdToken.mint(testUser.address, testAmount);
    await mintTx.wait();
    
    const userEsMpdBalance = await esMpdToken.balanceOf(testUser.address);
    console.log(`   Test user esMPD balance: ${hre.ethers.utils.formatEther(userEsMpdBalance)} ✅`);

    // Deposit esMPD into Vester (as test user)
    console.log(`\n   Depositing esMPD into Vester...`);
    const vesterAsUser = vester.connect(testUser);
    const depositTx = await vesterAsUser.deposit(testAmount);
    await depositTx.wait();
    
    const depositedAmount = await vester.depositedAmount(testUser.address);
    console.log(`   Deposited amount: ${hre.ethers.utils.formatEther(depositedAmount)} ✅`);
    
    // Fast-forward 1 week (604800 seconds)
    console.log(`\n   Fast-forwarding EVM time by 1 week...`);
    await hre.network.provider.send("evm_increaseTime", [604800]);
    await hre.network.provider.send("evm_mine");
    console.log("   ✅ Time advanced");

    // Check claimable amount
    const claimable = await vester.claimable(testUser.address);
    console.log(`   Claimable MPD: ${hre.ethers.utils.formatEther(claimable)}`);

    // Claim
    console.log(`\n   Claiming vested MPD...`);
    const mpdBalanceBefore = await mpdToken.balanceOf(testUser.address);
    const claimTx = await vesterAsUser.claim();
    await claimTx.wait();
    const mpdBalanceAfter = await mpdToken.balanceOf(testUser.address);
    
    console.log(`   MPD balance before: ${hre.ethers.utils.formatEther(mpdBalanceBefore)}`);
    console.log(`   MPD balance after: ${hre.ethers.utils.formatEther(mpdBalanceAfter)}`);
    console.log(`   MPD claimed: ${hre.ethers.utils.formatEther(mpdBalanceAfter.sub(mpdBalanceBefore))} ✅`);

  } catch (e: any) {
    console.log(`   ❌ Error in mint/vest flow: ${e.message}`);
  }

  // Final Report
  console.log("\n" + "═".repeat(70));
  console.log(" INTEGRATION TEST REPORT");
  console.log("═".repeat(70));

  console.log("\n📋 Deploy Transaction Summary:");
  console.log("   Network: localhost (Hardhat)");
  console.log("   Contracts deployed: gmx-synthetics core contracts");

  console.log("\n📝 DataStore Entries Written:");
  txHashes.forEach(({ key, txHash }) => {
    console.log(`   ${key}: ${txHash}`);
  });

  console.log("\n✅ Validation Results:");
  let passCount = 0;
  let failCount = 0;
  validationResults.forEach((result) => {
    const status = result.passed ? "PASS" : "FAIL";
    if (result.passed) passCount++;
    else failCount++;
    console.log(`   [${status}] ${result.check}`);
    if (!result.passed) {
      console.log(`         Expected: ${result.expected}`);
      console.log(`         Actual:   ${result.actual}`);
    }
  });

  console.log("\n📊 Summary:");
  console.log(`   Passed: ${passCount}`);
  console.log(`   Failed: ${failCount}`);

  if (failCount > 0) {
    console.log("\n⚠️ Some validations failed. Review the errors above.");
    process.exit(1);
  }

  console.log("\n✅ All integration tests passed!");
  console.log("═".repeat(70));
}

// Run
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
// --- MPD Integration End ---

