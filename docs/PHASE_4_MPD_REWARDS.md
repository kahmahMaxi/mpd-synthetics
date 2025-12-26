# Phase 4: MPD Rewards System

## Overview

The Market Participation Distribution (MPD) rewards system is a deterministic, execution-independent reward mechanism that tracks and rewards user participation in the DFI/USDC index market. This system operates **without requiring order or deposit execution**, making it suitable for testnet environments where execution may be limited.

## Reward Philosophy

### Why Execution is Not Required

The MPD rewards system is designed to reward **intent and participation**, not just execution:

1. **Order Intent**: Users who create orders demonstrate market participation intent, regardless of execution status
2. **Liquidity Intent**: Users who deposit liquidity show commitment to market health
3. **Time Participation**: Early adopters who participate early deserve recognition
4. **Market Support**: Users who create diverse orders (LONG/SHORT, various sizes) support market health

### Execution-Independent Design

- **No Keeper Dependency**: Rewards are calculated from on-chain data (orders, deposits) without requiring execution
- **Deterministic**: Same participation data always produces the same rewards
- **Fair**: All participants are evaluated on the same criteria
- **Transparent**: All calculations are open and verifiable

### How Rewards Evolve Once Execution Exists

When execution becomes available (mainnet or local fork):

1. **Additional Metrics**: Can add execution-based metrics (volume, realized PnL)
2. **Weight Adjustments**: Can adjust weights to favor executed trades
3. **Time Decay**: Can reduce weight of pending orders over time
4. **Hybrid Scoring**: Combine intent-based and execution-based scores

The current system provides a **foundation** that can be extended with execution metrics.

## Reward Categories

### 1. Order Intent (50% weight)

Rewards users for creating orders, demonstrating trading intent.

**Scoring:**
- Base: 1 point per order
- Size multiplier: log10(sizeInUsd) capped at 5.0
- Direction diversity: +0.5 bonus if both LONG and SHORT orders exist

**Rationale**: Users who create orders show market participation, even if orders remain pending.

### 2. Liquidity Intent (30% weight)

Rewards users for providing liquidity to the market.

**Scoring:**
- Base: 1 point per deposit
- Amount multiplier: log10(amountInUsd) capped at 4.0

**Rationale**: Liquidity providers are essential for market health, regardless of execution status.

### 3. Time Participation (10% weight)

Rewards early adopters who participate early in the market lifecycle.

**Scoring:**
- Base: 1 point per day since first interaction
- Decay: 0.95 per week (encourages early participation)
- Max: 90 days (3 months)

**Rationale**: Early participants help bootstrap the market and deserve recognition.

### 4. Market Support (10% weight)

Rewards users who create diverse orders that support market health.

**Scoring:**
- Base: 0.5 per unique order type
- Direction diversity: +1.0 if both LONG and SHORT
- Size diversity: +0.5 if orders span multiple size ranges

**Rationale**: Market diversity (both directions, various sizes) improves market health.

## System Architecture

### Data Flow

```
1. indexParticipationSnapshot.ts
   ↓
   Reads: Reader + DataStore
   Output: participation-snapshot-*.json

2. calcMPDRewards.ts
   ↓
   Input: participation-snapshot-*.json
   Output: rewards-*.json

3. exportRewardsForClaims.ts
   ↓
   Input: rewards-*.json
   Output: claims-*.json (multiple formats)
```

### Components

1. **RewardTypes.ts**: Defines reward categories, weights, normalization rules
2. **indexParticipationSnapshot.ts**: Snapshot user participation from on-chain data
3. **calcMPDRewards.ts**: Calculate deterministic rewards from snapshot
4. **exportRewardsForClaims.ts**: Export rewards in claimable formats

## Usage

### Step 1: Create Participation Snapshot

```bash
npx hardhat run scripts/indexParticipationSnapshot.ts --network arbitrumSepolia
```

**What it does:**
- Scans all orders and deposits for the DFI/USDC market
- Groups by user address
- Records order details (type, direction, size, status)
- Records deposit details (amount, status)
- Tracks first interaction timestamp
- Outputs normalized JSON snapshot

**Output:** `snapshots/participation-snapshot-arbitrumSepolia-<timestamp>.json`

### Step 2: Calculate Rewards

```bash
npx hardhat run scripts/calcMPDRewards.ts --network arbitrumSepolia
```

Or with specific snapshot:
```bash
SNAPSHOT_FILE=snapshots/participation-snapshot-arbitrumSepolia-1234567890.json npx hardhat run scripts/calcMPDRewards.ts --network arbitrumSepolia
```

**What it does:**
- Loads participation snapshot
- Calculates scores for each category
- Applies reward weights
- Calculates share percentages
- Ranks users by weighted score
- Outputs reward calculations

**Output:** `rewards/calculations/rewards-arbitrumSepolia-<timestamp>.json`

### Step 3: Export for Claims

```bash
npx hardhat run scripts/exportRewardsForClaims.ts --network arbitrumSepolia
```

Or with specific rewards file:
```bash
REWARDS_FILE=rewards/calculations/rewards-arbitrumSepolia-1234567890.json npx hardhat run scripts/exportRewardsForClaims.ts --network arbitrumSepolia
```

**What it does:**
- Loads reward calculations
- Converts to claim format
- Exports in multiple formats:
  - JSON (for backend/cron)
  - CSV (for spreadsheet analysis)
  - Simple format (for onchain distributor)
  - Merkle-ready format (for merkle tree generation)

**Output:** Multiple files in `rewards/exports/`

## Reward Calculation Details

### Score Normalization

Scores are normalized to prevent any single metric from dominating:

- **Logarithmic Scaling**: Large orders/deposits use log scale to prevent whale dominance
- **Caps**: Maximum multipliers prevent extreme scores
- **Diversity Bonuses**: Encourage balanced participation

### Weighted Scoring

Final reward share = weighted sum of category scores:

```
weightedScore = 
  (OrderIntent * 0.50) +
  (LiquidityIntent * 0.30) +
  (TimeParticipation * 0.10) +
  (MarketSupport * 0.10)

sharePercent = (userWeightedScore / totalWeightedScore) * 100
```

### Deterministic Math

- Same input data always produces same output
- No randomness or external dependencies
- Fully reproducible and verifiable

## Integration Points

### Frontend Integration

The rewards system can be integrated into a frontend:

1. **Display Leaderboard**: Show top participants and their scores
2. **User Dashboard**: Show individual participation metrics
3. **Claim Interface**: Allow users to claim their rewards
4. **Real-time Updates**: Refresh snapshots periodically

### Backend Integration

The rewards system can be integrated into a backend:

1. **Cron Job**: Periodically run snapshot and calculation scripts
2. **API Endpoints**: Serve reward data to frontend
3. **Database Storage**: Store historical snapshots and calculations
4. **Notification System**: Notify users of reward updates

### Onchain Distribution

Rewards can be distributed onchain:

1. **Merkle Tree**: Generate merkle tree from claims
2. **Merkle Distributor**: Deploy contract that verifies merkle proofs
3. **Direct Transfer**: Use simple distributor for small participant counts
4. **Vesting**: Add vesting schedules if needed

## File Structure

```
gmx-synthetics/
├── rewards/
│   ├── RewardTypes.ts          # Reward category definitions
│   ├── calculations/            # Reward calculation results
│   │   └── rewards-*.json
│   └── exports/                 # Exported claim formats
│       ├── claims-*.json
│       ├── claims-*.csv
│       ├── claims-simple-*.json
│       └── claims-merkle-*.json
├── snapshots/                   # Participation snapshots
│   └── participation-snapshot-*.json
└── scripts/
    ├── indexParticipationSnapshot.ts
    ├── calcMPDRewards.ts
    └── exportRewardsForClaims.ts
```

## Example Workflow

### Weekly Reward Cycle

1. **Monday**: Run `indexParticipationSnapshot.ts` to capture current state
2. **Tuesday**: Run `calcMPDRewards.ts` to calculate rewards
3. **Wednesday**: Run `exportRewardsForClaims.ts` to prepare claims
4. **Thursday**: Review and validate reward distribution
5. **Friday**: Generate merkle tree and deploy onchain distributor
6. **Weekend**: Users claim rewards

### Continuous Monitoring

- Run snapshots daily or weekly
- Track participation trends
- Adjust weights if needed
- Monitor reward distribution fairness

## Limitations

### Current Limitations

- **No Execution Metrics**: Cannot reward based on executed volume or PnL
- **No Real-time Updates**: Snapshots are point-in-time
- **No Historical Tracking**: Each snapshot is independent
- **No Sybil Resistance**: Does not prevent multiple accounts

### Future Enhancements

- **Execution Metrics**: Add volume, PnL, fees paid
- **Historical Tracking**: Track participation over time
- **Sybil Resistance**: Add identity verification
- **Dynamic Weights**: Adjust weights based on market conditions
- **Time-based Decay**: Reduce weight of old pending orders

## Troubleshooting

### No Participants Found

**Check:**
- Market address is correct
- Orders/deposits exist for the market
- DataStore is accessible
- Reader contract is working

### Zero Scores

**Check:**
- Orders have valid sizeDeltaUsd
- Deposits have valid amounts
- First interaction timestamp is set
- Normalization rules are applied correctly

### Share Percentages Don't Sum to 100%

**Expected**: May be slightly off due to rounding
**Fix**: Normalize shares to sum to exactly 100% if needed

## Summary

The MPD rewards system provides a **fair, transparent, and execution-independent** way to reward market participation. It:

- ✅ Rewards intent and participation
- ✅ Works without execution
- ✅ Uses deterministic math
- ✅ Provides multiple export formats
- ✅ Can be extended with execution metrics
- ✅ Integrates with frontend and backend
- ✅ Supports onchain distribution

This system ensures that early participants and active users are recognized and rewarded, even in testnet environments where execution may be limited.

