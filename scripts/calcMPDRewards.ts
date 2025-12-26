/**
 * @title Calculate MPD Rewards
 * @notice Calculates Market Participation Distribution rewards from participation snapshot
 * @dev This script reads a participation snapshot and calculates deterministic rewards
 *      Focus: Phase 4 (MPD Rewards) - Deterministic math, execution-independent
 *      Run with: npx hardhat run scripts/calcMPDRewards.ts --network arbitrumSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import {
  ParticipationSnapshot,
  UserParticipation,
  RewardCategory,
  REWARD_WEIGHTS,
  NORMALIZATION_RULES,
  RewardCalculation,
  logWithCap,
} from "../rewards/RewardTypes";

/**
 * Calculate Order Intent Score
 */
function calculateOrderIntentScore(user: UserParticipation): number {
  const rules = NORMALIZATION_RULES.OrderIntent;
  let score = 0;

  // Base score per order
  score += user.orders.length * rules.baseScorePerOrder;

  // Size multiplier (log scale)
  let totalSizeUsd = 0;
  for (const order of user.orders) {
    // sizeDeltaUsd is in 30 decimals, convert to USD
    const sizeUsd = parseFloat(order.sizeDeltaUsd) / 1e30;
    totalSizeUsd += sizeUsd;
  }

  if (totalSizeUsd > 0) {
    const sizeMultiplier = logWithCap(totalSizeUsd, rules.sizeMultiplierBase, rules.sizeMultiplierMax);
    score *= 1 + sizeMultiplier * 0.1; // 10% bonus per log unit
  }

  // Direction diversity bonus
  const hasLong = user.orders.some((o) => o.direction === "LONG");
  const hasShort = user.orders.some((o) => o.direction === "SHORT");
  if (hasLong && hasShort) {
    score += rules.directionDiversityBonus;
  }

  return score;
}

/**
 * Calculate Liquidity Intent Score
 */
function calculateLiquidityIntentScore(user: UserParticipation): number {
  const rules = NORMALIZATION_RULES.LiquidityIntent;
  let score = 0;

  // Base score per deposit
  score += user.deposits.length * rules.baseScorePerDeposit;

  // Amount multiplier (log scale)
  let totalAmountUsd = 0;
  for (const deposit of user.deposits) {
    totalAmountUsd += parseFloat(deposit.amountUsd);
  }

  if (totalAmountUsd > 0) {
    const amountMultiplier = logWithCap(totalAmountUsd, rules.amountMultiplierBase, rules.amountMultiplierMax);
    score *= 1 + amountMultiplier * 0.1; // 10% bonus per log unit
  }

  return score;
}

/**
 * Calculate Time Participation Score
 */
function calculateTimeParticipationScore(user: UserParticipation, currentTimestamp: number): number {
  const rules = NORMALIZATION_RULES.TimeParticipation;
  let score = 0;

  if (user.firstInteractionTimestamp > 0) {
    const daysSinceFirst = Math.floor((currentTimestamp - user.firstInteractionTimestamp) / 86400);
    const cappedDays = Math.min(daysSinceFirst, rules.maxDays);

    // Base score per day
    score = cappedDays * rules.baseScorePerDay;

    // Apply decay (older participation gets less weight)
    const weeksSinceFirst = daysSinceFirst / 7;
    const decayFactor = Math.pow(rules.decayFactorPerWeek, weeksSinceFirst);
    score *= decayFactor;
  }

  return score;
}

/**
 * Calculate Market Support Score
 */
function calculateMarketSupportScore(user: UserParticipation): number {
  const rules = NORMALIZATION_RULES.MarketSupport;
  let score = 0;

  // Count unique order types
  const orderTypes = new Set(user.orders.map((o) => o.orderType));
  score += orderTypes.size * rules.baseScorePerOrderType;

  // Direction diversity bonus
  const hasLong = user.orders.some((o) => o.direction === "LONG");
  const hasShort = user.orders.some((o) => o.direction === "SHORT");
  if (hasLong && hasShort) {
    score += rules.directionDiversityBonus;
  }

  // Size diversity bonus
  const sizeRanges = rules.sizeRanges;
  const sizeCategories = new Set<number>();
  for (const order of user.orders) {
    const sizeUsd = parseFloat(order.sizeDeltaUsd) / 1e30;
    for (let i = 0; i < sizeRanges.length; i++) {
      if (sizeUsd <= sizeRanges[i]) {
        sizeCategories.add(i);
        break;
      }
    }
  }
  if (sizeCategories.size > 1) {
    score += rules.sizeDiversityBonus;
  }

  return score;
}

/**
 * Calculate all scores for a user
 */
function calculateUserScores(user: UserParticipation, currentTimestamp: number): void {
  user.scores.OrderIntent = calculateOrderIntentScore(user);
  user.scores.LiquidityIntent = calculateLiquidityIntentScore(user);
  user.scores.TimeParticipation = calculateTimeParticipationScore(user, currentTimestamp);
  user.scores.MarketSupport = calculateMarketSupportScore(user);

  // Calculate total score (sum of all category scores)
  user.totalScore =
    user.scores.OrderIntent + user.scores.LiquidityIntent + user.scores.TimeParticipation + user.scores.MarketSupport;
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" CALCULATE MPD REWARDS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  // =====================================================
  // STEP 1: Load Snapshot
  // =====================================================
  const snapshotFile = process.env.SNAPSHOT_FILE;
  let snapshotPath: string;

  if (snapshotFile) {
    snapshotPath = path.resolve(snapshotFile);
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`Snapshot file not found: ${snapshotPath}`);
    }
    console.log(`📂 Loading snapshot: ${snapshotFile}\n`);
  } else {
    // Try to find latest snapshot
    const snapshotDir = path.resolve(__dirname, "..", "snapshots");
    if (!fs.existsSync(snapshotDir)) {
      throw new Error("No snapshot directory found. Run indexParticipationSnapshot.ts first.");
    }

    const files = fs
      .readdirSync(snapshotDir)
      .filter((f) => f.startsWith("participation-snapshot-") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error("No snapshot files found. Run indexParticipationSnapshot.ts first.");
    }

    const latestFile = files[0];
    snapshotPath = path.resolve(snapshotDir, latestFile);
    console.log(`📂 Loading latest snapshot: ${latestFile}\n`);
  }

  const snapshot: ParticipationSnapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

  console.log(`   Market: ${snapshot.marketAddress}`);
  console.log(`   Block: ${snapshot.blockNumber}`);
  console.log(`   Timestamp: ${new Date(snapshot.timestamp * 1000).toISOString()}`);
  console.log(`   Participants: ${snapshot.users.length}\n`);

  // =====================================================
  // STEP 2: Calculate Scores
  // =====================================================
  console.log("📊 Calculating participation scores...\n");

  const currentTimestamp = Math.floor(Date.now() / 1000);

  for (const user of snapshot.users) {
    calculateUserScores(user, currentTimestamp);
  }

  // =====================================================
  // STEP 3: Calculate Weighted Scores and Shares
  // =====================================================
  console.log("⚖️  Calculating weighted scores and reward shares...\n");

  const rewardCalculations: RewardCalculation[] = [];

  // Calculate total weighted score
  let totalWeightedScore = 0;
  for (const user of snapshot.users) {
    const weightedScore =
      user.scores.OrderIntent * REWARD_WEIGHTS[RewardCategory.OrderIntent] +
      user.scores.LiquidityIntent * REWARD_WEIGHTS[RewardCategory.LiquidityIntent] +
      user.scores.TimeParticipation * REWARD_WEIGHTS[RewardCategory.TimeParticipation] +
      user.scores.MarketSupport * REWARD_WEIGHTS[RewardCategory.MarketSupport];

    totalWeightedScore += weightedScore;

    rewardCalculations.push({
      user: user.address,
      score: user.totalScore,
      sharePercent: 0, // Will calculate below
      categoryScores: { ...user.scores },
      weightedScores: {
        OrderIntent: user.scores.OrderIntent * REWARD_WEIGHTS[RewardCategory.OrderIntent],
        LiquidityIntent: user.scores.LiquidityIntent * REWARD_WEIGHTS[RewardCategory.LiquidityIntent],
        TimeParticipation: user.scores.TimeParticipation * REWARD_WEIGHTS[RewardCategory.TimeParticipation],
        MarketSupport: user.scores.MarketSupport * REWARD_WEIGHTS[RewardCategory.MarketSupport],
      },
    });
  }

  // Calculate share percentages
  if (totalWeightedScore > 0) {
    for (const calc of rewardCalculations) {
      const weightedScore =
        calc.categoryScores.OrderIntent * REWARD_WEIGHTS[RewardCategory.OrderIntent] +
        calc.categoryScores.LiquidityIntent * REWARD_WEIGHTS[RewardCategory.LiquidityIntent] +
        calc.categoryScores.TimeParticipation * REWARD_WEIGHTS[RewardCategory.TimeParticipation] +
        calc.categoryScores.MarketSupport * REWARD_WEIGHTS[RewardCategory.MarketSupport];

      calc.sharePercent = (weightedScore / totalWeightedScore) * 100;
    }
  }

  // Sort by weighted score (descending)
  rewardCalculations.sort((a, b) => {
    const aWeighted =
      a.categoryScores.OrderIntent * REWARD_WEIGHTS[RewardCategory.OrderIntent] +
      a.categoryScores.LiquidityIntent * REWARD_WEIGHTS[RewardCategory.LiquidityIntent] +
      a.categoryScores.TimeParticipation * REWARD_WEIGHTS[RewardCategory.TimeParticipation] +
      a.categoryScores.MarketSupport * REWARD_WEIGHTS[RewardCategory.MarketSupport];
    const bWeighted =
      b.categoryScores.OrderIntent * REWARD_WEIGHTS[RewardCategory.OrderIntent] +
      b.categoryScores.LiquidityIntent * REWARD_WEIGHTS[RewardCategory.LiquidityIntent] +
      b.categoryScores.TimeParticipation * REWARD_WEIGHTS[RewardCategory.TimeParticipation] +
      b.categoryScores.MarketSupport * REWARD_WEIGHTS[RewardCategory.MarketSupport];
    return bWeighted - aWeighted;
  });

  // =====================================================
  // STEP 4: Display Leaderboard
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" REWARD CALCULATION LEADERBOARD");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(
    "┌─────┬────────────────────────────────────────────────────────────┬──────────┬─────────────┬──────────────┐"
  );
  console.log(
    "│ Rank│ User Address                                               │ Score    │ Share %     │ Weighted    │"
  );
  console.log(
    "├─────┼────────────────────────────────────────────────────────────┼──────────┼─────────────┼──────────────┤"
  );

  for (let i = 0; i < Math.min(rewardCalculations.length, 20); i++) {
    const calc = rewardCalculations[i];
    const weightedScore =
      calc.categoryScores.OrderIntent * REWARD_WEIGHTS[RewardCategory.OrderIntent] +
      calc.categoryScores.LiquidityIntent * REWARD_WEIGHTS[RewardCategory.LiquidityIntent] +
      calc.categoryScores.TimeParticipation * REWARD_WEIGHTS[RewardCategory.TimeParticipation] +
      calc.categoryScores.MarketSupport * REWARD_WEIGHTS[RewardCategory.MarketSupport];

    console.log(
      `│ ${String(i + 1).padStart(3)} │ ${calc.user.padEnd(58)} │ ${calc.score
        .toFixed(2)
        .padStart(8)} │ ${calc.sharePercent.toFixed(4).padStart(11)}% │ ${weightedScore.toFixed(4).padStart(12)} │`
    );
  }

  console.log(
    "└─────┴────────────────────────────────────────────────────────────┴──────────┴─────────────┴──────────────┘\n"
  );

  // =====================================================
  // STEP 5: Save Results
  // =====================================================
  console.log("💾 Saving reward calculations...\n");

  const resultsDir = path.resolve(__dirname, "..", "rewards", "calculations");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsFile = path.resolve(resultsDir, `rewards-${hre.network.name}-${snapshot.timestamp}.json`);

  fs.writeFileSync(resultsFile, JSON.stringify(rewardCalculations, null, 2));

  console.log(`✅ Reward calculations saved: ${resultsFile}\n`);

  // =====================================================
  // STEP 6: Summary
  // =====================================================
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" ✅ REWARD CALCULATION COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("📊 Summary:");
  console.log(`   Total Participants: ${rewardCalculations.length}`);
  console.log(`   Total Weighted Score: ${totalWeightedScore.toFixed(4)}`);
  console.log(`   Top Participant Share: ${rewardCalculations[0]?.sharePercent.toFixed(4)}%\n`);

  console.log("📝 Next Steps:");
  console.log(`   1. Run exportRewardsForClaims.ts with results: ${path.basename(resultsFile)}`);
  console.log(`   2. Review reward distribution`);
  console.log(`   3. Prepare for onchain distribution\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
