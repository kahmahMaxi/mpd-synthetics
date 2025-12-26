/**
 * @title Export Rewards for Claims
 * @notice Exports calculated rewards into claimable format
 * @dev This script converts reward calculations into formats suitable for:
 *      - Merkle tree generation
 *      - Onchain distributor
 *      - Backend cron job
 *      Focus: Phase 4 (MPD Rewards) - Export format conversion
 *      Run with: npx hardhat run scripts/exportRewardsForClaims.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { RewardCalculation, RewardClaim } from "../rewards/RewardTypes";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" EXPORT REWARDS FOR CLAIMS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  // =====================================================
  // STEP 1: Load Reward Calculations
  // =====================================================
  const rewardsFile = process.env.REWARDS_FILE;
  let rewardsPath: string;

  if (rewardsFile) {
    rewardsPath = path.resolve(rewardsFile);
    if (!fs.existsSync(rewardsPath)) {
      throw new Error(`Rewards file not found: ${rewardsPath}`);
    }
    console.log(`📂 Loading rewards: ${rewardsFile}\n`);
  } else {
    // Try to find latest rewards file
    const rewardsDir = path.resolve(__dirname, "..", "rewards", "calculations");
    if (!fs.existsSync(rewardsDir)) {
      throw new Error("No rewards directory found. Run calcMPDRewards.ts first.");
    }

    const files = fs
      .readdirSync(rewardsDir)
      .filter((f) => f.startsWith("rewards-") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error("No rewards files found. Run calcMPDRewards.ts first.");
    }

    const latestFile = files[0];
    rewardsPath = path.resolve(rewardsDir, latestFile);
    console.log(`📂 Loading latest rewards: ${latestFile}\n`);
  }

  const rewardCalculations: RewardCalculation[] = JSON.parse(fs.readFileSync(rewardsPath, "utf8"));

  console.log(`   Loaded ${rewardCalculations.length} reward calculation(s)\n`);

  // =====================================================
  // STEP 2: Convert to Claim Format
  // =====================================================
  console.log("🔄 Converting to claim format...\n");

  const claims: RewardClaim[] = rewardCalculations.map((calc, index) => ({
    user: calc.user,
    score: calc.score,
    sharePercent: calc.sharePercent,
    // Merkle leaf will be populated when generating merkle tree
    merkleLeaf: undefined,
  }));

  // Filter out users with zero share
  const validClaims = claims.filter((claim) => claim.sharePercent > 0);

  console.log(`   Valid claims: ${validClaims.length}`);
  console.log(`   Zero-share claims filtered: ${claims.length - validClaims.length}\n`);

  // =====================================================
  // STEP 3: Export Formats
  // =====================================================
  console.log("💾 Exporting in multiple formats...\n");

  const exportDir = path.resolve(__dirname, "..", "rewards", "exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const networkName = hre.network.name;

  // Format 1: JSON (for backend/cron)
  const jsonFile = path.resolve(exportDir, `claims-${networkName}-${timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(validClaims, null, 2));
  console.log(`✅ JSON format: ${path.basename(jsonFile)}`);

  // Format 2: CSV (for spreadsheet analysis)
  const csvFile = path.resolve(exportDir, `claims-${networkName}-${timestamp}.csv`);
  const csvHeader = "user,score,sharePercent\n";
  const csvRows = validClaims.map((c) => `${c.user},${c.score},${c.sharePercent}\n`).join("");
  fs.writeFileSync(csvFile, csvHeader + csvRows);
  console.log(`✅ CSV format: ${path.basename(csvFile)}`);

  // Format 3: Simple array format (for onchain distributor)
  const simpleFormat = {
    timestamp,
    network: networkName,
    totalParticipants: validClaims.length,
    claims: validClaims.map((c) => ({
      user: c.user,
      sharePercent: c.sharePercent,
    })),
  };
  const simpleFile = path.resolve(exportDir, `claims-simple-${networkName}-${timestamp}.json`);
  fs.writeFileSync(simpleFile, JSON.stringify(simpleFormat, null, 2));
  console.log(`✅ Simple format: ${path.basename(simpleFile)}`);

  // Format 4: Merkle-ready format (for future merkle tree generation)
  const merkleFormat = {
    timestamp,
    network: networkName,
    totalParticipants: validClaims.length,
    merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000", // Placeholder
    leaves: validClaims.map((c, index) => ({
      index,
      user: c.user,
      sharePercent: c.sharePercent,
      proof: [], // Will be populated when generating merkle tree
    })),
  };
  const merkleFile = path.resolve(exportDir, `claims-merkle-${networkName}-${timestamp}.json`);
  fs.writeFileSync(merkleFile, JSON.stringify(merkleFormat, null, 2));
  console.log(`✅ Merkle-ready format: ${path.basename(merkleFile)}\n`);

  // =====================================================
  // STEP 4: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ EXPORT COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📊 Export Summary:");
  console.log(`   Total Claims: ${validClaims.length}`);
  console.log(`   Total Share: ${validClaims.reduce((sum, c) => sum + c.sharePercent, 0).toFixed(4)}%`);
  console.log(`   Top Claim: ${validClaims[0]?.user} (${validClaims[0]?.sharePercent.toFixed(4)}%)\n`);

  console.log("📁 Exported Files:");
  console.log(`   JSON: ${jsonFile}`);
  console.log(`   CSV: ${csvFile}`);
  console.log(`   Simple: ${simpleFile}`);
  console.log(`   Merkle-ready: ${merkleFile}\n`);

  console.log("📝 Next Steps:");
  console.log("   1. Review exported claims");
  console.log("   2. Generate merkle tree (if using merkle distribution)");
  console.log("   3. Deploy onchain distributor (if using direct distribution)");
  console.log("   4. Set up backend cron job for periodic snapshots\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
