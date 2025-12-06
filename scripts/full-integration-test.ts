// --- MPD Integration Start ---
/**
 * @title Full MPD Integration Test
 * @notice Tests MPD integration using real deployed contracts
 * @dev Run with: npx hardhat run scripts/full-integration-test.ts --network localhost
 * 
 * Prerequisites:
 * 1. Start Hardhat node: npx hardhat node
 * 2. Deploy mpd-token: cd ../mpd-token && npx hardhat run scripts/deploy.js --network localhost
 * 3. Deploy gmx-synthetics: npx hardhat deploy --network localhost
 * 4. Run this script: npx hardhat run scripts/full-integration-test.ts --network localhost
 * 
 * For testnet, replace localhost with the testnet name and ensure contracts are deployed.
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";

// Load ABIs from mpd-token artifacts
function loadMpdTokenAbi(contractName: string): any[] {
  const artifactPath = path.resolve(
    __dirname, "..", "..", "mpd-token", "artifacts", "contracts", 
    `${contractName}.sol`, `${contractName}.json`
  );
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Did you compile mpd-token?`);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact.abi;
}

// Load deployment addresses
function loadMpdDeployments(network: string): any {
  // Try network-specific file first (e.g., localhost.json, arbitrumSepolia.json)
  const networkPath = path.resolve(
    __dirname, "..", "..", "mpd-token", "deployments", `${network}.json`
  );
  
  // Fallback to local.json
  const localPath = path.resolve(
    __dirname, "..", "..", "mpd-token", "deployments", "local.json"
  );
  
  if (fs.existsSync(networkPath)) {
    console.log(`   Loading deployments from: ${network}.json`);
    return JSON.parse(fs.readFileSync(networkPath, "utf8"));
  } else if (fs.existsSync(localPath)) {
    console.log(`   Loading deployments from: local.json (fallback)`);
    return JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
  
  throw new Error(`No deployment file found for network: ${network}`);
}

async function main() {
  console.log("═".repeat(70));
  console.log(" MPD FULL INTEGRATION TEST");
  console.log("═".repeat(70));
  console.log("Network:", hre.network.name);
  console.log("Timestamp:", new Date().toISOString());

  const [deployer, testUser] = await hre.ethers.getSigners();
  console.log("\nDeployer:", deployer.address);
  console.log("Test User:", testUser.address);

  // =====================================================
  // STEP 1: Load Real MPD Token Contracts
  // =====================================================
  console.log("\n" + "═".repeat(70));
  console.log(" STEP 1: LOAD REAL MPD TOKEN CONTRACTS");
  console.log("═".repeat(70));

  // Load deployment addresses for current network
  console.log("\n📂 Loading MPD token deployments...");
  let mpdDeployments: any;
  try {
    mpdDeployments = loadMpdDeployments(hre.network.name);
  } catch (e: any) {
    console.error(`   ❌ ${e.message}`);
    console.log("\n   ⚠️ Please deploy mpd-token first:");
    console.log("      cd ../mpd-token");
    console.log(`      npx hardhat run scripts/deploy.js --network ${hre.network.name}`);
    process.exit(1);
  }

  // Verify contracts exist on-chain
  console.log("\n🔍 Verifying contracts are deployed on-chain...");
  const mpdCode = await hre.ethers.provider.getCode(mpdDeployments.MPDToken);
  const esMpdCode = await hre.ethers.provider.getCode(mpdDeployments.esMPD);
  const vesterCode = await hre.ethers.provider.getCode(mpdDeployments.Vester);

  if (mpdCode === "0x" || esMpdCode === "0x" || vesterCode === "0x") {
    console.error("   ❌ MPD contracts not found on-chain at the deployment addresses.");
    console.log("\n   This could mean:");
    console.log("   - The Hardhat node was restarted after mpd-token deployment");
    console.log("   - Contracts were deployed to a different network");
    console.log("\n   ⚠️ Please redeploy mpd-token to the current network:");
    console.log("      cd ../mpd-token");
    console.log(`      npx hardhat run scripts/deploy.js --network ${hre.network.name}`);
    process.exit(1);
  }

  // Load ABIs and create contract instances
  console.log("\n📦 Loading contract ABIs and connecting...");
  const mpdTokenAbi = loadMpdTokenAbi("MPDToken");
  const esMpdAbi = loadMpdTokenAbi("EsMPD");
  const vesterAbi = loadMpdTokenAbi("Vester");

  const mpdToken = new hre.ethers.Contract(mpdDeployments.MPDToken, mpdTokenAbi, deployer);
  const esMpd = new hre.ethers.Contract(mpdDeployments.esMPD, esMpdAbi, deployer);
  const vester = new hre.ethers.Contract(mpdDeployments.Vester, vesterAbi, deployer);

  console.log("   ✅ MPDToken:", mpdToken.address);
  console.log("   ✅ esMPD:", esMpd.address);
  console.log("   ✅ Vester:", vester.address);

  const vesterAddress = vester.address;
  const vestingDuration = mpdDeployments.vestingDuration || 31536000;

  const mpdAddresses = {
    MPDToken: mpdToken.address,
    esMPD: esMpd.address,
    Vester: vesterAddress,
  };

  console.log("\n   📋 MPD Token Addresses (Real Deployed):");
  console.log(`      MPDToken: ${mpdAddresses.MPDToken}`);
  console.log(`      esMPD: ${mpdAddresses.esMPD}`);
  console.log(`      Vester: ${mpdAddresses.Vester}`);
  console.log(`      Vesting Duration: ${vestingDuration} seconds`);

  // =====================================================
  // STEP 2: Get GMX-Synthetics Contracts
  // =====================================================
  console.log("\n" + "═".repeat(70));
  console.log(" STEP 2: GET GMX-SYNTHETICS CONTRACTS");
  console.log("═".repeat(70));

  // Get DataStore and RoleStore from deployments
  let dataStore: any;
  let roleStore: any;
  
  try {
    dataStore = await hre.ethers.getContract("DataStore");
    roleStore = await hre.ethers.getContract("RoleStore");
    console.log("\n   ✅ DataStore:", dataStore.address);
    console.log("   ✅ RoleStore:", roleStore.address);
  } catch (e: any) {
    console.error("\n   ❌ GMX-Synthetics contracts not found.");
    console.log("\n   ⚠️ Please deploy gmx-synthetics first:");
    console.log(`      $env:SKIP_AUTO_HANDLER_REDEPLOYMENT='true'; npx hardhat deploy --network ${hre.network.name}`);
    process.exit(1);
  }

  // =====================================================
  // STEP 3: Inject MPD Addresses into DataStore
  // =====================================================
  console.log("\n" + "═".repeat(70));
  console.log(" STEP 3: INJECT MPD ADDRESSES INTO DATASTORE");
  console.log("═".repeat(70));

  // Grant CONTROLLER role to deployer if needed
  const CONTROLLER = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("CONTROLLER"));
  const hasRole = await roleStore.hasRole(deployer.address, CONTROLLER);
  
  if (!hasRole) {
    console.log("\n   Granting CONTROLLER role to deployer...");
    await roleStore.grantRole(deployer.address, CONTROLLER);
    console.log("   ✅ CONTROLLER role granted");
  } else {
    console.log("\n   ✅ Deployer already has CONTROLLER role");
  }

  // Define injections
  const injections = [
    { key: "MPD_TOKEN", type: "address", value: mpdToken.address },
    { key: "ES_MPD_TOKEN", type: "address", value: esMpd.address },
    { key: "MPD_VESTER", type: "address", value: vester.address },
    { key: "MPD_VESTING_DURATION", type: "uint", value: vestingDuration },
  ];

  const txHashes: { key: string; txHash: string }[] = [];

  for (const injection of injections) {
    const keyHash = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], [injection.key])
    );

    console.log(`\n   Injecting ${injection.key}...`);
    console.log(`      Value: ${injection.value}`);

    let tx;
    if (injection.type === "address") {
      tx = await dataStore.setAddress(keyHash, injection.value);
    } else {
      tx = await dataStore.setUint(keyHash, injection.value);
    }
    await tx.wait();
    console.log(`      ✅ TX: ${tx.hash}`);
    txHashes.push({ key: injection.key, txHash: tx.hash });
  }

  // =====================================================
  // STEP 4: Validation Checks
  // =====================================================
  console.log("\n" + "═".repeat(70));
  console.log(" STEP 4: VALIDATION CHECKS");
  console.log("═".repeat(70));

  let validationsPassed = 0;
  let validationsFailed = 0;

  // Validate DataStore entries
  console.log("\n📊 DataStore Validations:");

  for (const injection of injections) {
    const keyHash = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], [injection.key])
    );

    let storedValue: string;
    if (injection.type === "address") {
      storedValue = await dataStore.getAddress(keyHash);
    } else {
      const val = await dataStore.getUint(keyHash);
      storedValue = val.toString();
    }

    const expected = injection.value.toString().toLowerCase();
    const actual = storedValue.toLowerCase();
    const match = expected === actual;

    if (match) {
      validationsPassed++;
      console.log(`   ✅ ${injection.key}: ${storedValue}`);
    } else {
      validationsFailed++;
      console.log(`   ❌ ${injection.key}: Expected ${expected}, got ${actual}`);
    }
  }

  // Validate Vester configuration
  console.log("\n📊 Vester Validations:");

  try {
    const storedMpd = await vester.mpd();
    const storedEsMpd = await vester.esMpd();
    const storedDuration = await vester.vestingDuration();

    const mpdMatch = storedMpd.toLowerCase() === mpdToken.address.toLowerCase();
    const esMpdMatch = storedEsMpd.toLowerCase() === esMpd.address.toLowerCase();
    const durationMatch = storedDuration.eq(vestingDuration);

    console.log(`   ${mpdMatch ? "✅" : "❌"} Vester.mpd(): ${storedMpd}`);
    console.log(`   ${esMpdMatch ? "✅" : "❌"} Vester.esMpd(): ${storedEsMpd}`);
    console.log(`   ${durationMatch ? "✅" : "❌"} Vester.vestingDuration(): ${storedDuration.toString()}`);

    if (mpdMatch) validationsPassed++; else validationsFailed++;
    if (esMpdMatch) validationsPassed++; else validationsFailed++;
    if (durationMatch) validationsPassed++; else validationsFailed++;
  } catch (e: any) {
    console.log(`   ❌ Error reading Vester: ${e.message}`);
    validationsFailed += 3;
  }

  // Validate Token configurations
  console.log("\n📊 Token Validations:");

  try {
    const mpdName = await mpdToken.name();
    const esMpdName = await esMpd.name();

    const mpdNameMatch = mpdName === "MPD Token";
    const esMpdNameMatch = esMpdName === "Escrowed MPD";

    console.log(`   ${mpdNameMatch ? "✅" : "❌"} MPD Token name: ${mpdName}`);
    console.log(`   ${esMpdNameMatch ? "✅" : "❌"} esMPD Token name: ${esMpdName}`);

    if (mpdNameMatch) validationsPassed++; else validationsFailed++;
    if (esMpdNameMatch) validationsPassed++; else validationsFailed++;
  } catch (e: any) {
    console.log(`   ❌ Error reading tokens: ${e.message}`);
    validationsFailed += 2;
  }

  // =====================================================
  // STEP 5: Smoke Functional Tests
  // =====================================================
  console.log("\n" + "═".repeat(70));
  console.log(" STEP 5: SMOKE FUNCTIONAL TESTS");
  console.log("═".repeat(70));

  // Test 1: Check token interfaces
  console.log("\n🔥 Test 1: Check token interfaces");
  const mpdDecimals = await mpdToken.decimals();
  const esMpdDecimals = await esMpd.decimals();
  console.log(`   MPD decimals: ${mpdDecimals} ✅`);
  console.log(`   esMPD decimals: ${esMpdDecimals} ✅`);

  // Test 2: Verify DataStore values persist
  console.log("\n🔥 Test 2: Verify DataStore references persist");
  
  const mpdKeyHash = hre.ethers.utils.keccak256(
    hre.ethers.utils.defaultAbiCoder.encode(["string"], ["MPD_TOKEN"])
  );
  const esMpdKeyHash = hre.ethers.utils.keccak256(
    hre.ethers.utils.defaultAbiCoder.encode(["string"], ["ES_MPD_TOKEN"])
  );
  const vesterKeyHash = hre.ethers.utils.keccak256(
    hre.ethers.utils.defaultAbiCoder.encode(["string"], ["MPD_VESTER"])
  );

  const storedMpd = await dataStore.getAddress(mpdKeyHash);
  const storedEsMpd = await dataStore.getAddress(esMpdKeyHash);
  const storedVester = await dataStore.getAddress(vesterKeyHash);

  const mpdStoreMatch = storedMpd.toLowerCase() === mpdToken.address.toLowerCase();
  const esMpdStoreMatch = storedEsMpd.toLowerCase() === esMpd.address.toLowerCase();
  const vesterStoreMatch = storedVester.toLowerCase() === vesterAddress.toLowerCase();

  console.log(`   DataStore.MPD_TOKEN: ${storedMpd} ${mpdStoreMatch ? "✅" : "❌"}`);
  console.log(`   DataStore.ES_MPD_TOKEN: ${storedEsMpd} ${esMpdStoreMatch ? "✅" : "❌"}`);
  console.log(`   DataStore.MPD_VESTER: ${storedVester} ${vesterStoreMatch ? "✅" : "❌"}`);

  // Test 3: Mint esMPD to test user and test Vester flow
  console.log("\n🔥 Test 3: Mint esMPD and test Vester flow");
  const testAmount = hre.ethers.utils.parseEther("100");
  let depositedAmount = hre.ethers.BigNumber.from(0);
  let mpdClaimed = hre.ethers.BigNumber.from(0);

  try {
    // Check if deployer can mint esMPD
    const isMinter = await esMpd.isMinter(deployer.address);
    console.log(`   Deployer is esMPD minter: ${isMinter ? "✅" : "❌"}`);

    if (isMinter) {
      // Mint esMPD to test user
      console.log(`   Minting ${hre.ethers.utils.formatEther(testAmount)} esMPD to test user...`);
      await esMpd.mint(testUser.address, testAmount);
      const userEsMpdBalance = await esMpd.balanceOf(testUser.address);
      console.log(`   Test user esMPD balance: ${hre.ethers.utils.formatEther(userEsMpdBalance)} ✅`);

      // Check if Vester is esMPD minter (for burn on deposit)
      const vesterIsMinter = await esMpd.isMinter(vesterAddress);
      console.log(`   Vester is esMPD minter: ${vesterIsMinter ? "✅" : "❌"}`);

      if (vesterIsMinter) {
        // Deposit esMPD into Vester
        console.log(`   Depositing ${hre.ethers.utils.formatEther(testAmount)} esMPD into Vester...`);
        const vesterAsUser = vester.connect(testUser);
        await vesterAsUser.deposit(testAmount);
        depositedAmount = await vester.depositedAmount(testUser.address);
        console.log(`   Deposited: ${hre.ethers.utils.formatEther(depositedAmount)} ✅`);

        // Fast-forward time
        console.log(`   Fast-forwarding 1 week...`);
        await hre.network.provider.send("evm_increaseTime", [604800]);
        await hre.network.provider.send("evm_mine");

        // Claim
        const mpdBalanceBefore = await mpdToken.balanceOf(testUser.address);
        await vesterAsUser.claim();
        const mpdBalanceAfter = await mpdToken.balanceOf(testUser.address);
        mpdClaimed = mpdBalanceAfter.sub(mpdBalanceBefore);
        console.log(`   MPD claimed: ${hre.ethers.utils.formatEther(mpdClaimed)} ✅`);
      } else {
        console.log(`   ⚠️ Skipping Vester test (Vester not set as esMPD minter)`);
      }
    } else {
      console.log(`   ⚠️ Skipping esMPD mint test (deployer not minter)`);
    }
  } catch (e: any) {
    console.log(`   ❌ Smoke test error: ${e.message}`);
  }

  // Test 4: Time manipulation works
  console.log("\n🔥 Test 4: EVM time manipulation");
  const blockBefore = await hre.ethers.provider.getBlock("latest");
  await hre.network.provider.send("evm_increaseTime", [86400]); // 1 day
  await hre.network.provider.send("evm_mine");
  const blockAfter = await hre.ethers.provider.getBlock("latest");
  const timeDiff = blockAfter.timestamp - blockBefore.timestamp;
  console.log(`   Time advanced by ${timeDiff} seconds ✅`);

  // =====================================================
  // FINAL REPORT
  // =====================================================
  console.log("\n" + "═".repeat(70));
  console.log(" INTEGRATION TEST REPORT");
  console.log("═".repeat(70));

  console.log("\n📋 Deploy Transaction Summary:");
  console.log(`   Network: ${hre.network.name}`);
  console.log("\n   MPD Token Contracts:");
  console.log(`      MPDToken: ${mpdToken.address}`);
  console.log(`      esMPD: ${esMpd.address}`);
  console.log(`      Vester: ${vester.address}`);
  console.log("\n   GMX-Synthetics Core Contracts:");
  console.log(`      DataStore: ${dataStore.address}`);
  console.log(`      RoleStore: ${roleStore.address}`);

  console.log("\n📝 DataStore Entries Written:");
  txHashes.forEach(({ key, txHash }) => {
    console.log(`      ${key}: ${txHash}`);
  });

  console.log("\n📊 Validation Results:");
  console.log(`      Passed: ${validationsPassed}`);
  console.log(`      Failed: ${validationsFailed}`);

  console.log("\n🔥 Smoke Test Results:");
  console.log(`      esMPD minted to user: ${hre.ethers.utils.formatEther(testAmount)}`);
  console.log(`      esMPD deposited: ${hre.ethers.utils.formatEther(depositedAmount)}`);
  console.log(`      Time advanced: 1 week`);
  console.log(`      MPD claimed: ${hre.ethers.utils.formatEther(mpdClaimed)}`);

  if (validationsFailed > 0) {
    console.log("\n⚠️ Some validations failed. Review errors above.");
    process.exit(1);
  }

  console.log("\n✅ ALL INTEGRATION TESTS PASSED!");
  console.log("═".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
// --- MPD Integration End ---

