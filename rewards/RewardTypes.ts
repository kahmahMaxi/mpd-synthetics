/**
 * @title MPD Reward Types
 * @notice Defines reward categories, weights, and normalization rules for Market Participation Distribution
 * @dev This module defines the reward system structure for tracking user participation
 *      in the DFI/USDC index market, independent of execution status.
 */

/**
 * Reward Categories
 *
 * These categories represent different types of participation that contribute to rewards:
 */
export enum RewardCategory {
  /** User created orders (intent to trade) */
  OrderIntent = "OrderIntent",
  /** User provided liquidity (deposits) */
  LiquidityIntent = "LiquidityIntent",
  /** User's time-based participation (early adopter bonus) */
  TimeParticipation = "TimeParticipation",
  /** User's support for market health (diversity of orders) */
  MarketSupport = "MarketSupport",
}

/**
 * Reward Weights
 *
 * These weights determine the relative importance of each reward category.
 * All weights should sum to 1.0 (100%).
 */
export const REWARD_WEIGHTS = {
  [RewardCategory.OrderIntent]: 0.5, // 50% - Primary participation metric
  [RewardCategory.LiquidityIntent]: 0.3, // 30% - Liquidity provision is valuable
  [RewardCategory.TimeParticipation]: 0.1, // 10% - Early adopter bonus
  [RewardCategory.MarketSupport]: 0.1, // 10% - Market health diversity
} as const;

/**
 * Normalization Rules
 *
 * These rules define how raw participation metrics are normalized to scores.
 */
export const NORMALIZATION_RULES = {
  /**
   * Order Intent Normalization
   * - Base score: 1 point per order
   * - Size multiplier: log10(sizeInUsd) capped at 5.0
   * - Direction diversity: +0.5 if both LONG and SHORT orders exist
   */
  OrderIntent: {
    baseScorePerOrder: 1.0,
    sizeMultiplierMax: 5.0,
    sizeMultiplierBase: 10, // log base
    directionDiversityBonus: 0.5,
  },

  /**
   * Liquidity Intent Normalization
   * - Base score: 1 point per deposit
   * - Amount multiplier: log10(amountInUsd) capped at 4.0
   */
  LiquidityIntent: {
    baseScorePerDeposit: 1.0,
    amountMultiplierMax: 4.0,
    amountMultiplierBase: 10, // log base
  },

  /**
   * Time Participation Normalization
   * - Base score: Days since first interaction
   * - Decay factor: 0.95 per week (encourages early participation)
   * - Max days: 90 days (3 months)
   */
  TimeParticipation: {
    baseScorePerDay: 1.0,
    decayFactorPerWeek: 0.95,
    maxDays: 90,
  },

  /**
   * Market Support Normalization
   * - Base score: 0.5 per unique order type
   * - Direction diversity: +1.0 if both LONG and SHORT
   * - Size diversity: +0.5 if orders span multiple size ranges
   */
  MarketSupport: {
    baseScorePerOrderType: 0.5,
    directionDiversityBonus: 1.0,
    sizeDiversityBonus: 0.5,
    sizeRanges: [100, 1000, 10000, 100000], // USD ranges
  },
} as const;

/**
 * Participation Snapshot Structure
 */
export interface ParticipationSnapshot {
  /** Snapshot timestamp */
  timestamp: number;
  /** Block number when snapshot was taken */
  blockNumber: number;
  /** Market address */
  marketAddress: string;
  /** User participation data */
  users: UserParticipation[];
}

/**
 * User Participation Data
 */
export interface UserParticipation {
  /** User address */
  address: string;
  /** Orders created by user */
  orders: OrderParticipation[];
  /** Deposits made by user */
  deposits: DepositParticipation[];
  /** Timestamp of first interaction */
  firstInteractionTimestamp: number;
  /** Calculated scores per category */
  scores: {
    [RewardCategory.OrderIntent]: number;
    [RewardCategory.LiquidityIntent]: number;
    [RewardCategory.TimeParticipation]: number;
    [RewardCategory.MarketSupport]: number;
  };
  /** Total participation score */
  totalScore: number;
}

/**
 * Order Participation Data
 */
export interface OrderParticipation {
  /** Order key */
  orderKey: string;
  /** Order type (MarketIncrease, LimitIncrease, etc.) */
  orderType: string;
  /** Direction (LONG or SHORT) */
  direction: "LONG" | "SHORT";
  /** Size in USD (30 decimals format) */
  sizeDeltaUsd: string;
  /** Collateral amount */
  collateralAmount: string;
  /** Timestamp when order was created */
  createdAt: number;
  /** Order status */
  status: "pending" | "executed" | "cancelled";
}

/**
 * Deposit Participation Data
 */
export interface DepositParticipation {
  /** Deposit key */
  depositKey: string;
  /** Amount in USD */
  amountUsd: string;
  /** Timestamp when deposit was created */
  createdAt: number;
  /** Deposit status */
  status: "pending" | "executed" | "cancelled";
}

/**
 * Reward Calculation Result
 */
export interface RewardCalculation {
  /** User address */
  user: string;
  /** Total participation score */
  score: number;
  /** Reward share percentage (0-100) */
  sharePercent: number;
  /** Breakdown by category */
  categoryScores: {
    [key in RewardCategory]: number;
  };
  /** Weighted category scores */
  weightedScores: {
    [key in RewardCategory]: number;
  };
}

/**
 * Export Format for Claims
 */
export interface RewardClaim {
  /** User address */
  user: string;
  /** Participation score */
  score: number;
  /** Reward share percentage */
  sharePercent: number;
  /** Merkle tree leaf data (for future use) */
  merkleLeaf?: {
    index: number;
    amount: string;
    proof: string[];
  };
}

/**
 * Helper function to validate reward weights sum to 1.0
 */
export function validateRewardWeights(): boolean {
  const sum = Object.values(REWARD_WEIGHTS).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.0001; // Allow small floating point errors
}

/**
 * Helper function to calculate log with cap
 */
export function logWithCap(value: number, base: number, max: number): number {
  if (value <= 0) return 0;
  const logValue = Math.log10(value) / Math.log10(base);
  return Math.min(logValue, max);
}
