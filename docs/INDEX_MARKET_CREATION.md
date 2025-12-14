# Index Market Creation

## Overview

This document explains how to create a GMX V2 market for the IndexToken (DFI) using the `createIndexMarket.ts` script. The market enables trading perpetual contracts on the DeFi Index price with USDC as collateral.

## Market Structure

### Market Components

A GMX V2 market consists of three token types:

1. **Index Token (DFI)**: The asset being traded
   - Represents the DeFi Index (weighted basket of assets)
   - Price determined by `IndexPriceFeed` oracle
   - Users trade perpetual contracts on this price

2. **Long Token (USDC)**: Collateral for long positions
   - Users deposit USDC to open long positions
   - Profits when index price increases
   - Losses when index price decreases

3. **Short Token (USDC)**: Collateral for short positions
   - Users deposit USDC to open short positions
   - Profits when index price decreases
   - Losses when index price increases

### Market Specification

- **Market Name**: DFI / USDC
- **Index Token**: IndexToken (DFI) - 18 decimals
- **Long Token**: USDC - 6 decimals
- **Short Token**: USDC - 6 decimals
- **Market Type**: `basic-v1` (isolated GM pool)

## Why USDC/USDC?

Using USDC for both long and short tokens is a standard GMX V2 pattern for index/stablecoin markets:

### Benefits

1. **Simplified Collateral Management**
   - Single collateral type reduces complexity
   - No need to manage multiple token balances
   - Easier for users to understand

2. **Price Stability**
   - USDC is a stablecoin (pegged to $1)
   - Reduces collateral volatility risk
   - Predictable margin requirements

3. **Liquidity Efficiency**
   - All liquidity in one token (USDC)
   - Better capital efficiency
   - Easier to manage pool reserves

4. **Standard Practice**
   - Matches GMX V2 conventions
   - Compatible with existing tooling
   - Well-tested pattern

### Alternative Configurations

While USDC/USDC is recommended, other configurations are possible:

- **USDC/USDT**: Different stablecoins for long/short
- **USDC/DAI**: Mix of stablecoins
- **ETH/USDC**: Volatile asset for long, stable for short

For index perpetuals, USDC/USDC is the most practical choice.

## GM Tokens (Market Tokens)

### What are GM Tokens?

GM tokens (also called Market Tokens) are ERC20 tokens that represent liquidity provider shares in a specific GMX market. They are automatically deployed when a market is created.

### GM Token Properties

- **Name**: Generated from market configuration (e.g., "GM: DFI/USDC")
- **Symbol**: Generated symbol (e.g., "GM-DFI-USDC")
- **Decimals**: 18 (standard)
- **Total Supply**: Increases as liquidity is deposited
- **Price**: Represents the value of the liquidity pool

### How GM Tokens Work

1. **Liquidity Deposit**
   ```
   User deposits USDC → Receives GM tokens
   ```

2. **Pool Value**
   - GM token price = (Total Pool Value) / (Total GM Supply)
   - Pool value includes:
     - Collateral deposits (USDC)
     - Unrealized PnL from positions
     - Accrued fees

3. **Liquidity Withdrawal**
   ```
   User burns GM tokens → Receives USDC (proportional to pool value)
   ```

4. **Fee Distribution**
   - Trading fees accrue to the pool
   - Increases pool value
   - GM token holders benefit from fee accumulation

### GM Token vs Other Tokens

| Token Type | Purpose | Example |
|------------|---------|---------|
| **GM Token** | LP shares in a specific market | GM-DFI-USDC |
| **IndexToken** | The index asset being traded | DFI (DeFi Index) |
| **MPD Token** | Governance token | MPD |
| **GLV Token** | Multi-market vault shares | GLV |

**Key Difference**: GM tokens are market-specific, while IndexToken represents the traded asset itself.

## Index Pricing Flow

### Price Resolution Chain

```
IndexPriceFeed (Oracle)
    ↓
DataStore (priceFeedKey mapping)
    ↓
ChainlinkPriceFeedProvider
    ↓
Market Contract
    ↓
Position PnL, Liquidation, Funding
```

### Step-by-Step Flow

1. **Oracle Registration** (Phase 2)
   - `IndexPriceFeed` registered in DataStore
   - Key: `priceFeedKey(IndexToken)`
   - Value: `IndexPriceFeed` address

2. **Price Aggregation**
   - `IndexPriceFeed` reads from multiple Chainlink feeds
   - Applies configured weights (ETH 40%, AAVE 20%, etc.)
   - Returns weighted index price in 8 decimals

3. **Price Resolution**
   - Market contract requests index token price
   - `ChainlinkPriceFeedProvider` reads from DataStore
   - Calls `IndexPriceFeed.latestRoundData()`
   - Receives aggregated price

4. **Price Usage**
   - **Position PnL**: Calculate profit/loss for open positions
   - **Liquidation**: Check if position is underwater
   - **Funding Rate**: Balance long/short positions
   - **Order Execution**: Validate execution prices

### Price Precision

- **IndexPriceFeed Output**: 8 decimals (Chainlink standard)
- **GMX Internal**: 30 decimals (for precision)
- **Conversion**: Applied via `priceFeedMultiplier` in DataStore

For 18-decimal IndexToken with 8-decimal feed:
```
multiplier = 10^(60 - 8 - 18) = 10^34
```

## Market Creation Script

### Location

`scripts/createIndexMarket.ts`

### Prerequisites

1. **Deployed Contracts:**
   - `IndexToken` deployed
   - `IndexPriceFeed` deployed and registered in DataStore
   - `MarketFactory` deployed (GMX core)
   - `DataStore` deployed (GMX core)
   - USDC deployed or configured

2. **Network:**
   - Arbitrum Sepolia (testnet)

3. **Permissions:**
   - Deployer must have permission to call `MarketFactory.createMarket()`

### Usage

```bash
npx hardhat run scripts/createIndexMarket.ts --network arbitrumSepolia
```

### What the Script Does

1. **Loads Contracts:**
   - MarketFactory
   - DataStore
   - IndexToken
   - USDC (from config or deployments)

2. **Safety Checks:**
   - Validates addresses are not zero
   - Verifies token decimals (IndexToken: 18, USDC: 6)
   - Checks oracle mapping exists in DataStore
   - Detects if market already exists

3. **Market Creation:**
   - Calls `MarketFactory.createMarket(indexToken, usdc, usdc, marketType)`
   - Waits for transaction confirmation

4. **Verification:**
   - Reads market from DataStore via Reader
   - Verifies all token addresses match
   - Retrieves GM token address

5. **Summary:**
   - Prints market address, market key, GM token address
   - Displays all token addresses
   - Provides next steps

### Expected Output

```
══════════════════════════════════════════════════════════════════════
 CREATE INDEX MARKET
══════════════════════════════════════════════════════════════════════
Network: arbitrumSepolia

Deployer: 0x...

📦 Loading deployed contracts...

✅ MarketFactory: 0x...
✅ DataStore: 0x...
✅ IndexToken: 0x...
✅ USDC: 0x... (6 decimals)

🔍 Performing safety checks...

✅ IndexToken address is valid
✅ USDC address is valid
✅ IndexToken decimals: 18
✅ USDC decimals: 6
✅ Oracle registered: 0x...
✅ Market does not exist yet

📝 Creating market...

   Market Name: DFI / USDC
   Index Token: 0x... (DFI)
   Long Token:  0x... (USDC)
   Short Token: 0x... (USDC)
   Market Type: 0x...

✅ Market creation transaction: 0x...
✅ Transaction confirmed

🔍 Verifying market creation...

✅ Market found in DataStore!
   Market Token (GM): 0x...
   Index Token: 0x...
   Long Token: 0x...
   Short Token: 0x...
✅ All token addresses match

══════════════════════════════════════════════════════════════════════
 MARKET CREATION SUMMARY
══════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────┐
│ Market Information                                                 │
├────────────────────────────────────────────────────────────────────┤
│ Market Name:    DFI / USDC                                        │
│ Market Key:     0x...:0x...:0x...                                 │
│ Market Token:   0x...                                             │
├────────────────────────────────────────────────────────────────────┤
│ Index Token:    0x...                                             │
│ Long Token:     0x...                                             │
│ Short Token:    0x...                                             │
└────────────────────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════════════════════
 ✅ INDEX MARKET CREATION COMPLETE!
══════════════════════════════════════════════════════════════════════

📝 Next Steps:
   1. Configure market parameters (funding, borrowing, limits)
   2. Seed initial liquidity to the market
   3. Test market operations (deposits, trades, withdrawals)
   4. Verify GM token functionality
```

### Error Handling

The script will fail with clear error messages if:

1. **Missing Contracts:**
   ```
   ❌ Failed to load IndexToken. Ensure it's deployed first.
   ```

2. **Zero Addresses:**
   ```
   ❌ IndexToken address is zero
   ```

3. **Invalid Decimals:**
   ```
   ❌ IndexToken must have 18 decimals, got 8
   ```

4. **Oracle Not Registered:**
   ```
   ❌ Oracle not registered for IndexToken. Run registerIndexOracle.ts first.
   ```

5. **Market Already Exists:**
   ```
   ⚠️  Market already exists!
   ```
   (Script will skip creation and print existing market info)

## Market State After Creation

After successful market creation:

✅ **Market exists** in DataStore  
✅ **GM token deployed** and addressable  
❌ **Market not yet tradable** (no liquidity)  
❌ **Market parameters not configured** (funding, limits, etc.)

The market is created but requires:
1. Market parameter configuration
2. Initial liquidity seeding
3. Testing and verification

## Next Steps: Liquidity Seeding

After market creation, the next phase is to seed initial liquidity:

1. **Deposit USDC** to the market
2. **Receive GM tokens** as LP shares
3. **Enable trading** by providing liquidity
4. **Test operations** (deposits, trades, withdrawals)

See Phase 3B documentation for liquidity seeding details.

## Market Configuration (Future)

After liquidity seeding, configure market parameters:

- **Funding Factors**: Min/max funding rates
- **Borrowing Factors**: Base, optimal, above-optimal rates
- **Position Limits**: Max open interest, max collateral
- **Impact Factors**: Price impact for trades
- **Fee Factors**: Trading fees, execution fees

These configurations are typically done via `configureMarkets.ts` or similar scripts.

## Verification

After market creation, verify the market:

1. **Check DataStore:**
   ```typescript
   const reader = await hre.ethers.getContract("Reader");
   const markets = await reader.getMarkets(dataStore.address, 0, 1000);
   const market = markets.find(m => 
     m.indexToken === indexToken.address &&
     m.longToken === usdcAddress &&
     m.shortToken === usdcAddress
   );
   console.log("Market:", market);
   ```

2. **Check GM Token:**
   ```typescript
   const gmToken = await hre.ethers.getContractAt("MarketToken", market.marketToken);
   const name = await gmToken.name();
   const symbol = await gmToken.symbol();
   const totalSupply = await gmToken.totalSupply();
   console.log(`GM Token: ${name} (${symbol}), Supply: ${totalSupply}`);
   ```

3. **Check Market State:**
   ```typescript
   const marketInfo = await reader.getMarketInfo(dataStore.address, market.marketToken);
   console.log("Market Info:", marketInfo);
   ```

## Troubleshooting

### Issue: "Oracle not registered"

**Solution:** Run oracle registration first:
```bash
npx hardhat run scripts/registerIndexOracle.ts --network arbitrumSepolia
```

### Issue: "Market already exists"

**Solution:** This is not an error. The script will print the existing market info. If you need to recreate:
- Markets cannot be deleted in GMX V2
- Use a different token combination
- Or use the existing market

### Issue: "Permission denied"

**Solution:** Ensure deployer has permission to call `MarketFactory.createMarket()`:
- Check MarketFactory access control
- Verify deployer has required role
- Check if MarketFactory is paused

### Issue: "USDC not found"

**Solution:** Ensure USDC is deployed or configured:
- Deploy USDC if using localhost
- Update `config/tokens/usdc.json` with correct address
- Or ensure USDC is in `gmx.getTokens()` config

## Related Documentation

- [Index Oracle Registration](./INDEX_ORACLE_REGISTRATION.md) - Oracle setup
- [Index Token Documentation](./INDEX_TOKEN.md) - IndexToken details
- [Index Oracle Implementation](./INDEX_ORACLE_IMPLEMENTATION.md) - Oracle technical details
- [GMX V2 Documentation](https://docs.gmx.io/) - Official GMX documentation

