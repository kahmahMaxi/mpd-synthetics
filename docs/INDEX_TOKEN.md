# Index Token Implementation

## Overview

The `IndexToken` is an ERC20 token that represents an index (e.g., DeFi Index) for use in GMX V2 index perpetual markets. This token serves as the **index asset** in GMX markets, with its price determined by the `IndexPriceFeed` oracle.

## Purpose

The IndexToken is distinct from other tokens in the MPD DEX ecosystem:

| Token Type | Purpose | Example |
|------------|---------|---------|
| **IndexToken** | Represents the index asset in perpetual markets | DeFi Index (DFI) |
| **MPD** | Governance token | MPD Token |
| **GM** | Liquidity provider token | Market Token |

The IndexToken is used as the `indexToken` in GMX markets, allowing users to trade perpetual contracts on the index price (e.g., DeFi-5 Index) rather than individual assets.

## Contract Specification

### IndexToken.sol

**Location:** `contracts/tokens/IndexToken.sol`

**Features:**
- ✅ Standard ERC20 implementation
- ✅ Name: "DeFi Index"
- ✅ Symbol: "DFI"
- ✅ Decimals: 18
- ✅ Owner-controlled minting (`mint()`)
- ✅ Owner-controlled burning (`burn()`)
- ✅ No transfer restrictions
- ✅ Production-safe (uses OpenZeppelin Ownable)

**Access Control:**
- Uses OpenZeppelin `Ownable` for admin functions
- Only owner can mint/burn tokens
- All users can transfer tokens freely

## Deployment

### Target Network

**Arbitrum Sepolia** (testnet)

### Deployment Script

**Location:** `deploy/deployIndexToken.ts`

**Usage:**
```bash
npx hardhat deploy --network arbitrumSepolia --tags IndexToken
```

**What it does:**
1. Deploys IndexToken contract with:
   - Name: "DeFi Index"
   - Symbol: "DFI"
   - Decimals: 18
   - Owner: Deployer address
2. Mints initial supply: 1,000,000 DFI to deployer
3. Prints deployment summary

**Output:**
```
══════════════════════════════════════════════════════════════════════
 DEPLOYMENT SUMMARY
══════════════════════════════════════════════════════════════════════

│ Name:        DeFi Index                                           │
│ Symbol:      DFI                                                   │
│ Decimals:    18                                                    │
│ Address:     0x...                                                 │
│ Owner:       0x...                                                 │
│ Total Supply:    1000000000000000000000000                         │
│ Deployer Balance: 1000000000000000000000000                        │
```

## GMX Integration

### Compatibility

The IndexToken is fully compatible with GMX V2 contracts:

1. **MarketFactory**
   - Can be used as `indexToken` in market creation
   - No modifications needed to MarketFactory

2. **DataStore**
   - Token address can be registered for oracle configuration
   - Uses standard `priceFeedKey(indexToken)` pattern

3. **Reader & ExchangeRouter**
   - Standard ERC20 interface works with all GMX contracts
   - No special handling required

### Integration Steps (Future)

1. **Register Oracle** (Phase 2)
   ```typescript
   // Register IndexPriceFeed for IndexToken
   dataStore.setAddress(
     Keys.priceFeedKey(indexTokenAddress),
     indexPriceFeedAddress
   );
   dataStore.setUint(
     Keys.priceFeedMultiplierKey(indexTokenAddress),
     expandDecimals(1, 34) // 10^34 for 18-decimal token
   );
   ```

2. **Create Market** (Phase 3)
   ```typescript
   // Create market with IndexToken as indexToken
   marketFactory.createMarket({
     indexToken: indexTokenAddress,
     longToken: wethAddress,
     shortToken: usdcAddress,
     // ... other params
   });
   ```

## Usage in Markets

### Market Structure

When used in a GMX market:

```
Market: DFI-USD
├─ indexToken: IndexToken (DFI) - Price from IndexPriceFeed
├─ longToken: WETH (or other collateral)
└─ shortToken: USDC (or other collateral)
```

### Price Resolution

1. User opens position on DFI-USD market
2. GMX reads `IndexPriceFeed.latestRoundData()`
3. Gets aggregated index price (e.g., $821.85)
4. Uses price for PnL, liquidation, funding calculations

### Example Trade

```
User wants to long DeFi Index:
- Market: DFI-USD
- Position: Long DFI
- Collateral: USDC
- Index Price: $821.85 (from IndexPriceFeed)
- User profits if DeFi Index price increases
```

## Testing

### Run Tests

```bash
npx hardhat test test/tokens/IndexToken.test.ts
```

### Test Coverage

1. **Deployment**
   - Name, symbol, decimals correctness
   - Owner assignment
   - Zero initial supply

2. **Minting**
   - Owner can mint
   - Non-owner cannot mint
   - Zero address rejection
   - Zero amount rejection

3. **Burning**
   - Owner can burn
   - Non-owner cannot burn
   - Balance validation
   - Zero address/amount rejection

4. **ERC20 Transfers**
   - Standard transfers work
   - TransferFrom with approval
   - No transfer restrictions

5. **Metadata**
   - Name, symbol, decimals

6. **Ownership**
   - Ownership transfer
   - New owner can mint

7. **Integration Readiness**
   - ERC20 interface compatibility
   - Standard function support

## Token Economics

### Initial Supply

- **Testnet:** 1,000,000 DFI minted to deployer
- **Purpose:** Testing and market seeding

### Future Supply Management

- Minting controlled by owner (can be transferred to governance)
- Burning available for supply reduction
- No automatic minting/burning
- Supply changes require owner action

## Security Considerations

### Access Control

- **Owner Role:** Controls minting and burning
- **Recommendation:** Transfer ownership to multi-sig or timelock for production
- **Current:** Deployer is owner (testnet only)

### Transfer Safety

- No transfer restrictions (standard ERC20)
- Users can freely transfer tokens
- Compatible with all DEXs and wallets

### Production Deployment

Before mainnet:
1. Transfer ownership to governance/timelock
2. Verify contract on block explorer
3. Audit contract code
4. Set up monitoring for mint/burn events

## Differences from Other Tokens

### vs. MPD Token

| Feature | IndexToken | MPD Token |
|---------|-----------|-----------|
| Purpose | Index asset for markets | Governance |
| Minting | Owner-controlled | Owner-controlled |
| Usage | Market indexToken | Governance voting |
| Price Source | IndexPriceFeed | Market price |

### vs. GM Token (Market Token)

| Feature | IndexToken | GM Token |
|---------|-----------|----------|
| Purpose | Index asset | LP token |
| Minting | Owner-controlled | Controller-controlled |
| Usage | Market indexToken | LP position tracking |
| Price Source | IndexPriceFeed | Market value |

## Next Steps

### Phase 2: Oracle Registration

1. Deploy `IndexPriceFeed` (already done)
2. Register in DataStore:
   ```typescript
   setAddress(priceFeedKey(indexToken), indexPriceFeedAddress)
   setUint(priceFeedMultiplierKey(indexToken), multiplier)
   setUint(priceFeedHeartbeatDurationKey(indexToken), heartbeat)
   ```

### Phase 3: Market Creation

1. Create GMX market with IndexToken as `indexToken`
2. Configure market parameters
3. Seed initial liquidity

### Phase 4: Testing

1. Test market operations
2. Verify price updates
3. Test position opening/closing
4. Validate PnL calculations

## Contract Addresses

### Arbitrum Sepolia

**IndexToken (DFI):** `0x...` (deploy to get address)

**To find deployed address:**
```bash
cat deployments/arbitrumSepolia/IndexToken.json | jq .address
```

## Summary

The IndexToken is a production-ready ERC20 token designed for use as the index asset in GMX V2 index perpetual markets. It provides:

- ✅ Standard ERC20 functionality
- ✅ Owner-controlled supply management
- ✅ Full GMX V2 compatibility
- ✅ No transfer restrictions
- ✅ Production-safe implementation

**Status:** Ready for testnet deployment and market integration.

---

**Implementation Date:** $(date)  
**Contract Version:** 1  
**Status:** Production-Ready for Testnet

