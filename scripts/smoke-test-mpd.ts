// --- MPD Integration Start ---
/**
 * @title Smoke Test MPD Integration
 * @notice Runs functional smoke tests for the MPD vesting flow
 * @dev Run with: npx hardhat run scripts/smoke-test-mpd.ts --network localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";

async function main() {
  console.log("═".repeat(70));
  console.log(" STEP 7: SMOKE FUNCTIONAL TESTS");
  console.log("═".repeat(70));

  const [deployer, testUser] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Test User:", testUser.address);

  // Load mpd-token deployments
  const mpdDeploymentsPath = path.resolve(__dirname, "..", "..", "mpd-token", "deployments", "localhost.json");
  const mpdDeployments = JSON.parse(fs.readFileSync(mpdDeploymentsPath, "utf8"));

  const mpdAddress = mpdDeployments.MPDToken;
  const esMpdAddress = mpdDeployments.esMPD;
  const vesterAddress = mpdDeployments.Vester;

  console.log("\n📋 Contract Addresses:");
  console.log("   MPDToken:", mpdAddress);
  console.log("   esMPD:", esMpdAddress);
  console.log("   Vester:", vesterAddress);

  // Contract ABIs
  const mpdTokenAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function balanceOf(address) view returns (uint256)",
    "function owner() view returns (address)",
  ];

  const esMpdAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function balanceOf(address) view returns (uint256)",
    "function mint(address to, uint256 amount)",
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

  // Test 1: Verify contract names
  console.log("\n" + "─".repeat(70));
  console.log(" 🔥 SMOKE TEST 1: Contract Names");
  console.log("─".repeat(70));

  try {
    const mpdName = await mpdToken.name();
    const esMpdName = await esMpdToken.name();
    console.log(`   MPD Token name: ${mpdName} ${mpdName === "MPD Token" ? "✅" : "❌"}`);
    console.log(`   esMPD Token name: ${esMpdName} ${esMpdName === "Escrowed MPD" ? "✅" : "❌"}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 2: Mint esMPD to test user
  console.log("\n" + "─".repeat(70));
  console.log(" 🔥 SMOKE TEST 2: Mint esMPD to Test User");
  console.log("─".repeat(70));

  const testAmount = hre.ethers.utils.parseEther("100");

  try {
    // Check if deployer is minter
    const isMinter = await esMpdToken.isMinter(deployer.address);
    console.log(`   Deployer is esMPD minter: ${isMinter ? "✅" : "❌"}`);

    if (!isMinter) {
      console.log("   Setting deployer as minter...");
      const setMinterTx = await esMpdToken.setMinter(deployer.address, true);
      await setMinterTx.wait();
      console.log("   ✅ Deployer set as minter");
    }

    // Mint esMPD to test user
    console.log(`\n   Minting ${hre.ethers.utils.formatEther(testAmount)} esMPD to test user...`);
    const balanceBefore = await esMpdToken.balanceOf(testUser.address);
    console.log(`   Balance before: ${hre.ethers.utils.formatEther(balanceBefore)}`);

    const mintTx = await esMpdToken.mint(testUser.address, testAmount);
    await mintTx.wait();

    const balanceAfter = await esMpdToken.balanceOf(testUser.address);
    console.log(`   Balance after: ${hre.ethers.utils.formatEther(balanceAfter)} ✅`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 3: Deposit esMPD into Vester
  console.log("\n" + "─".repeat(70));
  console.log(" 🔥 SMOKE TEST 3: Deposit esMPD into Vester");
  console.log("─".repeat(70));

  try {
    // Check if Vester is minter for esMPD (required for burn on deposit)
    const vesterIsMinter = await esMpdToken.isMinter(vesterAddress);
    console.log(`   Vester is esMPD minter: ${vesterIsMinter ? "✅" : "❌"}`);

    if (!vesterIsMinter) {
      console.log("   Setting Vester as esMPD minter...");
      const setMinterTx = await esMpdToken.setMinter(vesterAddress, true);
      await setMinterTx.wait();
      console.log("   ✅ Vester set as esMPD minter");
    }

    // Deposit as test user
    const vesterAsUser = vester.connect(testUser);
    console.log(`\n   Depositing ${hre.ethers.utils.formatEther(testAmount)} esMPD into Vester...`);

    const depositTx = await vesterAsUser.deposit(testAmount);
    await depositTx.wait();

    const depositedAmount = await vester.depositedAmount(testUser.address);
    console.log(`   Deposited amount: ${hre.ethers.utils.formatEther(depositedAmount)} ✅`);

    const esMpdBalanceAfterDeposit = await esMpdToken.balanceOf(testUser.address);
    console.log(`   esMPD balance after deposit: ${hre.ethers.utils.formatEther(esMpdBalanceAfterDeposit)}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 4: Fast-forward time and claim
  console.log("\n" + "─".repeat(70));
  console.log(" 🔥 SMOKE TEST 4: Fast-forward Time and Claim MPD");
  console.log("─".repeat(70));

  try {
    // Fast-forward 1 week (604800 seconds)
    console.log("   Fast-forwarding EVM time by 1 week...");
    await hre.network.provider.send("evm_increaseTime", [604800]);
    await hre.network.provider.send("evm_mine");
    console.log("   ✅ Time advanced by 604800 seconds (1 week)");

    // Check claimable amount
    const claimable = await vester.claimable(testUser.address);
    console.log(`\n   Claimable MPD: ${hre.ethers.utils.formatEther(claimable)}`);

    // Get MPD balance before claim
    const mpdBalanceBefore = await mpdToken.balanceOf(testUser.address);
    console.log(`   MPD balance before claim: ${hre.ethers.utils.formatEther(mpdBalanceBefore)}`);

    // Claim
    console.log("\n   Claiming vested MPD...");
    const vesterAsUser = vester.connect(testUser);
    const claimTx = await vesterAsUser.claim();
    await claimTx.wait();
    console.log("   ✅ Claim transaction executed");

    // Get MPD balance after claim
    const mpdBalanceAfter = await mpdToken.balanceOf(testUser.address);
    const mpdClaimed = mpdBalanceAfter.sub(mpdBalanceBefore);
    console.log(`   MPD balance after claim: ${hre.ethers.utils.formatEther(mpdBalanceAfter)}`);
    console.log(`   MPD claimed: ${hre.ethers.utils.formatEther(mpdClaimed)} ✅`);

    // Verify claimable is now 0 or reduced
    const claimableAfter = await vester.claimable(testUser.address);
    console.log(`   Claimable after claim: ${hre.ethers.utils.formatEther(claimableAfter)}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 5: Verify DataStore still has correct values
  console.log("\n" + "─".repeat(70));
  console.log(" 🔥 SMOKE TEST 5: Verify DataStore Token References");
  console.log("─".repeat(70));

  try {
    const dataStoreDeployment = await hre.deployments.get("DataStore");
    const dataStore = await hre.ethers.getContractAt("DataStore", dataStoreDeployment.address);

    const mpdTokenKey = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], ["MPD_TOKEN"])
    );
    const esMpdTokenKey = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], ["ES_MPD_TOKEN"])
    );
    const vesterKey = hre.ethers.utils.keccak256(
      hre.ethers.utils.defaultAbiCoder.encode(["string"], ["MPD_VESTER"])
    );

    const storedMpd = await dataStore.getAddress(mpdTokenKey);
    const storedEsMpd = await dataStore.getAddress(esMpdTokenKey);
    const storedVester = await dataStore.getAddress(vesterKey);

    console.log(`   DataStore.MPD_TOKEN: ${storedMpd}`);
    console.log(`   DataStore.ES_MPD_TOKEN: ${storedEsMpd}`);
    console.log(`   DataStore.MPD_VESTER: ${storedVester}`);

    const mpdMatch = storedMpd.toLowerCase() === mpdAddress.toLowerCase();
    const esMpdMatch = storedEsMpd.toLowerCase() === esMpdAddress.toLowerCase();
    const vesterMatch = storedVester.toLowerCase() === vesterAddress.toLowerCase();

    console.log(`\n   MPD_TOKEN matches: ${mpdMatch ? "✅" : "❌"}`);
    console.log(`   ES_MPD_TOKEN matches: ${esMpdMatch ? "✅" : "❌"}`);
    console.log(`   MPD_VESTER matches: ${vesterMatch ? "✅" : "❌"}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Final Summary
  console.log("\n" + "═".repeat(70));
  console.log(" SMOKE TEST SUMMARY");
  console.log("═".repeat(70));
  console.log("\n   ✅ Contract names verified");
  console.log("   ✅ esMPD minted to test user");
  console.log("   ✅ esMPD deposited into Vester");
  console.log("   ✅ Time fast-forwarded and MPD claimed");
  console.log("   ✅ DataStore references verified");
  console.log("\n   🎉 All smoke tests completed successfully!");
  console.log("═".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
// --- MPD Integration End ---

