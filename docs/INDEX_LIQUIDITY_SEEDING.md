# Index Market Liquidity Seeding

## Overview

This document explains how to seed initial USDC liquidity into the DFI/USDC index market. Seeding liquidity is required before the market becomes tradable, as it provides the collateral pool for positions.

## Why USDC-Only Liquidity?

For index perpetual markets with USDC/USDC configuration:

1. **Single Collateral Type**
   - All liquidity in USDC (stablecoin)
   - Simplifies pool management
   - Predictable value (pegged to $1)

2. **Index Exposure via Oracle**
   - Index price comes from `IndexPriceFeed` oracle
   - No need to deposit actual DFI tokens
   - Users trade on index price, not token balance

3. **Standard GMX V2 Pattern**
   - Matches GMX V2 conventions
   - Compatible with existing tooling
   - Well-tested approach

## How GM Tokens Work for Index Markets

### GM Token Mechanics

GM tokens represent liquidity provider shares in the market:

1. **Deposit Flow:**
   ```
   User deposits 10,000 USDC
       ↓
   Market receives USDC
       ↓
   User receives GM tokens (e.g., 10,000 GM-DFI-USDC)
   ```

2. **GM Token Price:**
   ```
   GM Price = (Total Pool Value) / (Total GM Supply)
   
   Pool Value = USDC deposits + Unrealized PnL + Accrued Fees
   ```

3. **Initial Deposit:**
   - First deposit: 1 GM = 1 USDC (approximately)
   - Subsequent deposits: Price depends on pool value
   - Pool value includes PnL from open positions

### Index Market Specifics

For index markets:
- **No DFI tokens in pool** - Index exposure is oracle-based
- **USDC-only deposits** - All liquidity in stablecoin
- **Index price from oracle** - `IndexPriceFeed` provides price
- **GM tokens track pool value** - Includes fees and PnL

## How Oracle Price Affects GM Pricing

### Price Resolution

```
IndexPriceFeed (Oracle)
    ↓
ChainlinkPriceFeedProvider
    ↓
Market Contract
    ↓
Position PnL Calculations
    ↓
Pool Value Updates
    ↓
GM Token Price
```

### Impact on GM Tokens

1. **Index Price Changes:**
   - Long positions profit → Pool value increases → GM price increases
   - Short positions profit → Pool value decreases → GM price decreases

2. **Fee Accumulation:**
   - Trading fees accrue to pool
   - Increases pool value
   - GM token holders benefit

3. **Pool Value Formula:**
   ```
   Pool Value = 
     USDC Deposits
     + Long Position PnL (if positive)
     - Short Position PnL (if negative)
     + Accrued Fees
   ```

## Liquidity Seeding Script

### Location

`scripts/seedIndexLiquidity.ts`

### Prerequisites

1. **Deployed Contracts:**
   - IndexToken deployed
   - IndexPriceFeed deployed and registered
   - DFI/USDC market created (Phase 3A)
   - ExchangeRouter deployed (GMX core)
   - DepositVault deployed (GMX core)

2. **Network:**
   - Arbitrum Sepolia (testnet)

3. **Requirements:**
   - USDC balance (or mintable USDC)
   - WNT (Wrapped Native Token) for execution fee
   - Sufficient ETH for gas

### Usage

```bash
npx hardhat run scripts/seedIndexLiquidity.ts --network arbitrumSepolia
```

### What the Script Does

1. **Loads Contracts:**
   - ExchangeRouter
   - Reader
   - DataStore
   - Market (DFI/USDC)
   - USDC token

2. **Safety Checks:**
   - Verifies market exists
   - Checks oracle is registered
   - Validates GM token address
   - Checks current GM supply

3. **Prepares USDC:**
   - Checks deployer balance
   - Mints USDC if needed (testnet only)
   - Approves ExchangeRouter (if needed)

4. **Prepares WNT:**
   - Checks WNT balance for execution fee
   - Wraps ETH to WNT if needed

5. **Creates Deposit:**
   - Transfers USDC to DepositVault
   - Transfers WNT (execution fee) to DepositVault
   - Calls `ExchangeRouter.createDeposit()`
   - Extracts deposit key from events

6. **Summary:**
   - Prints deposit details
   - Shows GM token information
   - Provides next steps

### Expected Output

```
══════════════════════════════════════════════════════════════════════
 SEED INDEX MARKET LIQUIDITY
══════════════════════════════════════════════════════════════════════
Network: arbitrumSepolia

Deployer: 0x...

📦 Loading deployed contracts...

✅ ExchangeRouter: 0x...
✅ Reader: 0x...
✅ DataStore: 0x...
✅ IndexToken: 0x...
✅ USDC: 0x... (6 decimals)

🔍 Finding DFI/USDC market...

✅ Market found!
   Market Token (GM): 0x...
   Index Token: 0x...
   Long Token: 0x...
   Short Token: 0x...

🔍 Performing safety checks...

✅ GM Token: GM: DFI/USDC (GM-DFI-USDC)
   Current Supply: 0.0 GM
✅ Oracle registered: 0x...

💰 Preparing USDC...

   Required: 10000.0 USDC
   Current Balance: 0.0 USDC

⚠️  Insufficient USDC balance. Minting 10000.0 USDC...

✅ Minted 10000.0 USDC

📝 Approving ExchangeRouter for USDC...
✅ Approved 10000.0 USDC

📝 Transferring tokens to DepositVault...

✅ Transferred 10000.0 USDC to DepositVault
✅ Transferred 0.001 WNT to DepositVault

📝 Creating deposit...

   Deposit Amount: 10000.0 USDC
   Execution Fee: 0.001 WNT
   Market: 0x...

✅ Deposit created!
   Transaction: 0x...

✅ Transaction confirmed (Block: 12345)

📋 Deposit Key: 0x...

⚠️  Note: Deposit must be executed by a keeper or manually.
   The deposit is now pending execution.

══════════════════════════════════════════════════════════════════════
 LIQUIDITY SEEDING SUMMARY
══════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────┐
│ Deposit Information                                                │
├────────────────────────────────────────────────────────────────────┤
│ USDC Deposited:   10000.0                                         │
│ GM Token:         0x...                                           │
│ GM Token Name:    GM: DFI/USDC                                    │
│ GM Token Symbol:  GM-DFI-USDC                                     │
├────────────────────────────────────────────────────────────────────┤
│ GM Total Supply:  0.0                                             │
│ Your GM Balance:  0.0                                             │
└────────────────────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════════════════════
 ✅ LIQUIDITY SEEDING INITIATED!
══════════════════════════════════════════════════════════════════════

📝 Next Steps:
   1. Wait for keeper to execute deposit (or execute manually)
   2. Verify GM tokens received after execution
   3. Check market liquidity via Reader
   4. Test opening positions in the market
```

### Error Handling

The script will fail with clear error messages if:

1. **Market Not Found:**
   ```
   ❌ Market not found! Run createIndexMarket.ts first.
   ```

2. **Oracle Not Registered:**
   ```
   ❌ Oracle not registered. Run registerIndexOracle.ts first.
   ```

3. **Insufficient USDC:**
   ```
   ❌ Insufficient USDC balance. Need 10000.0 USDC.
   ```

4. **Insufficient WNT:**
   ```
   ❌ Insufficient WNT for execution fee. Need 0.001 WNT.
   ```

## Deposit Execution

### Two-Step Process

GMX V2 deposits are asynchronous:

1. **Create Deposit** (User)
   - User calls `ExchangeRouter.createDeposit()`
   - Tokens transferred to DepositVault
   - Deposit request created in DataStore
   - Returns deposit key

2. **Execute Deposit** (Keeper)
   - Keeper calls `DepositHandler.executeDeposit()`
   - Oracle prices provided
   - GM tokens minted to user
   - Deposit completed

### Manual Execution (Testnet)

If no keeper is available, you can execute manually:

```typescript
const depositHandler = await hre.ethers.getContract("DepositHandler");
const depositKey = "0x..."; // From createDeposit transaction

// Get oracle prices
const oracle = await hre.ethers.getContract("Oracle");
const tokens = [usdcAddress, indexTokenAddress];
const precisions = [6, 8]; // USDC: 6, IndexToken: 8
const minPrices = [...]; // Oracle prices
const maxPrices = [...]; // Oracle prices

// Execute deposit
await depositHandler.executeDeposit(depositKey, {
  tokens,
  precisions,
  minPrices,
  maxPrices,
});
```

## Verification

After deposit execution, verify:

1. **GM Token Supply:**
   ```typescript
   const gmToken = await hre.ethers.getContractAt("MarketToken", market.marketToken);
   const totalSupply = await gmToken.totalSupply();
   console.log("GM Supply:", totalSupply.toString());
   ```

2. **Your GM Balance:**
   ```typescript
   const balance = await gmToken.balanceOf(deployer);
   console.log("Your GM Balance:", balance.toString());
   ```

3. **Market Liquidity:**
   ```typescript
   const reader = await hre.ethers.getContract("Reader");
   const marketInfo = await reader.getMarketInfo(dataStore.address, market.marketToken);
   console.log("Market Info:", marketInfo);
   ```

## Next Steps: Opening Trades

After liquidity is seeded:

1. ✅ **Market has liquidity** - GM tokens exist
2. ⏭️ **Open positions** - Users can trade
3. ⏭️ **Test trading** - Verify long/short positions work
4. ⏭️ **Monitor pool** - Track GM token price

### Opening a Position

Once liquidity is seeded, users can:

1. **Open Long Position:**
   - Deposit USDC as collateral
   - Profit if index price increases
   - Lose if index price decreases

2. **Open Short Position:**
   - Deposit USDC as collateral
   - Profit if index price decreases
   - Lose if index price increases

3. **Position PnL:**
   - Calculated using `IndexPriceFeed` price
   - Updates in real-time
   - Affects pool value and GM token price

## Troubleshooting

### Issue: "Market not found"

**Solution:** Run market creation first:
```bash
npx hardhat run scripts/createIndexMarket.ts --network arbitrumSepolia
```

### Issue: "Oracle not registered"

**Solution:** Register oracle first:
```bash
npx hardhat run scripts/registerIndexOracle.ts --network arbitrumSepolia
```

### Issue: "Insufficient USDC"

**Solution:**
- Get USDC from faucet (Arbitrum Sepolia)
- Or grant MINTER_ROLE to deployer if using mintable USDC
- Or reduce deposit amount in script

### Issue: "Deposit not executing"

**Solution:**
- Wait for keeper (if available)
- Or execute manually (see Manual Execution section)
- Check deposit key is correct
- Verify oracle prices are available

### Issue: "GM tokens not received"

**Solution:**
- Verify deposit was executed (not just created)
- Check GM token balance after execution
- Verify market token address is correct
- Check transaction logs for errors

## Related Documentation

- [Index Market Creation](./INDEX_MARKET_CREATION.md) - Market setup
- [Index Oracle Registration](./INDEX_ORACLE_REGISTRATION.md) - Oracle setup
- [Index Token Documentation](./INDEX_TOKEN.md) - IndexToken details
- [GMX V2 Documentation](https://docs.gmx.io/) - Official GMX documentation

