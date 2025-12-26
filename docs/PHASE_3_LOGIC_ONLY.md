# Phase 3C-3D: Logic-Only Validation for Index Market

## Overview

This phase focuses on **validating the logic and configuration** of the DFI/USDC index market on Arbitrum Sepolia testnet **without executing deposits or orders**. This is a critical validation step that ensures:

- Market configuration is correct
- Order creation logic works
- Position PnL calculations are accurate
- Funding and borrowing formulas behave as expected

## Why Execution is Skipped

### GMX V2 Oracle Execution Constraints

GMX V2 requires **oracle timestamps and block numbers** for executing deposits and orders:

1. **Oracle Requirements:**
   - `executeDeposit()` and `executeOrder()` need valid oracle timestamps
   - Oracle prices must be recent and block-aligned
   - Empty `oracleTimestamps`, `minOracleBlockNumbers`, `maxOracleBlockNumbers` will cause revert

2. **ChainlinkPriceFeedProvider Limitation:**
   - Designed for **read-resolution**, not manual execution
   - Cannot provide execution timestamps required by GMX V2
   - Works for price queries but not for order/deposit execution

3. **Testnet Keeper Limitations:**
   - GMX testnet keepers may not be available or reliable
   - Manual execution requires keeper infrastructure
   - Local fork execution is the recommended alternative

### What This Phase Validates

✅ **Market Configuration:**
- Max open interest limits
- Position impact factors
- Funding rate factors
- Max leverage settings

✅ **Order Creation:**
- LONG and SHORT order creation
- Order parameters validation
- Collateral and size calculations
- Order storage in DataStore

✅ **Position Logic:**
- Position data structure
- Entry price tracking
- Collateral management
- Size calculations

✅ **PnL Calculations:**
- Unrealized PnL formulas
- Funding fee accumulation
- Borrowing fee calculations
- Net PnL after fees

## Scripts

### 1. `configureIndexMarket.ts`

**Purpose:** Configure market parameters in DataStore

**What it does:**
- Sets max open interest (long and short)
- Configures position impact factors
- Sets funding rate factors
- Configures max leverage (min collateral factor)

**Usage:**
```bash
npx hardhat run scripts/configureIndexMarket.ts --network arbitrumSepolia
```

**Features:**
- Idempotent (safe to rerun)
- Shows before/after values
- Validates configuration

### 2. `openIndexPosition.ts`

**Purpose:** Create LONG or SHORT orders (no execution)

**What it does:**
- Creates market increase orders
- Transfers collateral to OrderVault
- Stores order in DataStore
- Returns order key

**Usage:**
```bash
# LONG position
npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia -- --direction LONG --size 1000 --collateral 100 --leverage 10

# SHORT position
npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia -- --direction SHORT --size 1000 --collateral 100 --leverage 10
```

**Parameters:**
- `--direction`: LONG or SHORT
- `--size`: Position size in USD
- `--collateral`: Collateral amount in USDC
- `--leverage`: Leverage multiplier

**Note:** Orders remain **pending** until executed by keepers or in local fork.

### 3. `inspectIndexState.ts`

**Purpose:** Read-only inspection of market state

**What it shows:**
- Market configuration
- Open interest (long and short)
- Pending orders
- Active positions
- Collateral, size, entry price
- Funding and borrowing metrics

**Usage:**
```bash
npx hardhat run scripts/inspectIndexState.ts --network arbitrumSepolia
```

**Output:**
- Clean summary tables
- All market state information
- Position details
- Order status

### 4. `calcIndexPnL.ts`

**Purpose:** Calculate PnL for positions (read-only)

**What it calculates:**
- Unrealized PnL (based on current vs entry price)
- Funding fee impact
- Borrowing fees
- Net PnL after fees

**Usage:**
```bash
npx hardhat run scripts/calcIndexPnL.ts --network arbitrumSepolia
```

**Features:**
- Fetches current index price from IndexPriceFeed
- Calculates PnL for all positions
- Shows profit/loss status
- Displays funding and borrowing metrics

## Workflow

### Step 1: Configure Market
```bash
npx hardhat run scripts/configureIndexMarket.ts --network arbitrumSepolia
```

### Step 2: Create Orders
```bash
# Create LONG order
npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia -- --direction LONG --size 1000 --collateral 100 --leverage 10

# Create SHORT order
npx hardhat run scripts/openIndexPosition.ts --network arbitrumSepolia -- --direction SHORT --size 1000 --collateral 100 --leverage 10
```

### Step 3: Inspect State
```bash
npx hardhat run scripts/inspectIndexState.ts --network arbitrumSepolia
```

### Step 4: Calculate PnL
```bash
npx hardhat run scripts/calcIndexPnL.ts --network arbitrumSepolia
```

## Expected Behavior

### ✅ What Works

- Market configuration is applied correctly
- Orders are created and stored in DataStore
- Position data is readable via Reader
- PnL calculations match GMX V2 formulas
- Funding and borrowing metrics are accessible

### ⚠️ What Doesn't Work (Expected)

- **Orders remain pending** - No automatic execution on testnet
- **Deposits remain pending** - No automatic execution on testnet
- **Positions are not opened** - Until orders are executed
- **PnL is calculated but not realized** - Until positions are opened

## Testing Strategy

### On Testnet (Arbitrum Sepolia)

1. **Configuration Validation:**
   - Verify market parameters are set correctly
   - Check max open interest limits
   - Validate funding and impact factors

2. **Order Creation Validation:**
   - Create LONG and SHORT orders
   - Verify orders are stored in DataStore
   - Check order parameters are correct

3. **State Inspection:**
   - Read market configuration
   - Check open interest
   - List pending orders
   - Verify position data structure

4. **PnL Calculation Validation:**
   - Fetch current index price
   - Calculate unrealized PnL
   - Verify funding fee formulas
   - Check borrowing fee calculations

### On Local Fork (Recommended for Full Testing)

For complete testing including execution:

1. Fork Arbitrum Sepolia
2. Use mock oracles with controllable prices
3. Execute deposits and orders
4. Validate full position lifecycle
5. Test liquidation scenarios

## Limitations

### Testnet Limitations

- **No Automatic Execution:** Orders and deposits remain pending
- **Keeper Dependency:** Execution requires GMX keeper infrastructure
- **Price Staleness:** Oracle prices may be stale on testnet
- **Limited Liquidity:** Testnet has limited liquidity pools

### What This Phase Does NOT Test

- ❌ Order execution flow
- ❌ Deposit execution flow
- ❌ Position opening/closing
- ❌ Liquidation logic
- ❌ ADL (Auto-Deleveraging)
- ❌ Real-time funding fee updates

## Next Steps

After validating logic in Phase 3C-3D:

1. **Phase 4 (Future):** Full execution testing on local fork
2. **Mainnet Deployment:** Deploy to mainnet with proper keeper infrastructure
3. **Monitoring:** Set up monitoring for market state and positions
4. **Integration:** Integrate with frontend for user interaction

## Troubleshooting

### Orders Not Executing

**Expected:** Orders remain pending on testnet without keeper infrastructure.

**Solution:** Use local fork for execution testing.

### PnL Calculations Seem Incorrect

**Check:**
- Current index price is fetched correctly
- Entry price is stored correctly
- Position size matches expected value
- Funding fees are accumulating correctly

### Market Configuration Not Applied

**Check:**
- Deployer has CONTROLLER role
- DataStore is accessible
- Configuration values are valid
- Transaction succeeded

## Summary

Phase 3C-3D validates the **logic and configuration** of the index market without requiring execution. This approach:

- ✅ Validates market configuration
- ✅ Tests order creation logic
- ✅ Verifies PnL calculations
- ✅ Confirms funding/borrowing formulas
- ⚠️ Does NOT execute orders (expected on testnet)
- ⚠️ Does NOT open positions (expected on testnet)

This phase provides confidence that the market is configured correctly and the logic behaves as expected before moving to full execution testing.

