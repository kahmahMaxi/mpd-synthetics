# Index Oracle Registration

## Overview

This document explains how to register the `IndexPriceFeed` for the `IndexToken` (DFI) in GMX V2's `DataStore`. This registration is required for GMX to resolve the index token's price when creating markets and executing trades.

## Why DataStore Registration is Required

GMX V2 uses a centralized `DataStore` contract to manage all configuration, including price feed mappings. When GMX needs to resolve a token's price:

1. **Price Resolution Flow:**
   ```
   Market Contract
       ↓
   Oracle Provider (ChainlinkPriceFeedProvider)
       ↓
   DataStore.getAddress(priceFeedKey(token))
       ↓
   IPriceFeed.latestRoundData()
       ↓
   Price returned to market
   ```

2. **Key Mapping:**
   - `DataStore` maps `priceFeedKey(tokenAddress)` → `priceFeedAddress`
   - Without this mapping, GMX cannot resolve the token's price
   - The mapping must exist before creating markets using the token

3. **Price Feed Key Computation:**
   ```solidity
   priceFeedKey = keccak256(abi.encodePacked("PRICE_FEED", tokenAddress))
   ```

## How GMX Resolves Prices

### ChainlinkPriceFeedProvider Flow

1. **Oracle Request:**
   - Market contract requests price for `indexToken`
   - Calls `ChainlinkPriceFeedProvider.getOraclePrice(token)`

2. **DataStore Lookup:**
   ```solidity
   address priceFeedAddress = dataStore.getAddress(Keys.priceFeedKey(token));
   if (priceFeedAddress == address(0)) {
       revert Errors.EmptyChainlinkPriceFeed(token);
   }
   ```

3. **Price Feed Call:**
   ```solidity
   IPriceFeed priceFeed = IPriceFeed(priceFeedAddress);
   (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) 
       = priceFeed.latestRoundData();
   ```

4. **Price Validation:**
   - Checks price is positive
   - Checks heartbeat (price freshness)
   - Applies price feed multiplier
   - Returns price in 30-decimal format

5. **Market Usage:**
   - Position PnL calculations
   - Liquidation checks
   - Funding rate calculations
   - Order execution validation

### IndexPriceFeed Integration

The `IndexPriceFeed` implements the `IPriceFeed` interface, making it compatible with GMX's price resolution:

```solidity
interface IPriceFeed {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
}
```

When GMX calls `IndexPriceFeed.latestRoundData()`:
- The contract aggregates prices from multiple Chainlink feeds
- Applies configured weights
- Performs safety checks (stale prices, zero prices)
- Returns the weighted index price in 8 decimals

## Registration Script

### Location

`scripts/registerIndexOracle.ts`

### Prerequisites

1. **Deployed Contracts:**
   - `IndexToken` must be deployed
   - `IndexPriceFeed` must be deployed
   - `DataStore` must be deployed (part of GMX core)

2. **Network:**
   - Arbitrum Sepolia (testnet)

3. **Permissions:**
   - Deployer must have `CONTROLLER` role in `DataStore`
   - Or deployer must be the `DataStore` owner

### Usage

```bash
npx hardhat run scripts/registerIndexOracle.ts --network arbitrumSepolia
```

### What the Script Does

1. **Loads Deployed Contracts:**
   - Reads `IndexToken` address from deployments
   - Reads `IndexPriceFeed` address from deployments
   - Reads `DataStore` address from deployments

2. **Safety Checks:**
   - Validates addresses are not zero
   - Checks if mapping already exists
   - Warns if overwriting existing mapping

3. **Registration:**
   - Computes `priceFeedKey(indexToken)`
   - Calls `DataStore.setAddress(priceFeedKey, indexPriceFeed)`
   - Uses `setAddressIfDifferent` helper (skips if already set)

4. **Verification:**
   - Reads back the registered address
   - Confirms it matches `IndexPriceFeed` address
   - Prints success/failure

### Expected Output

```
══════════════════════════════════════════════════════════════════════
 REGISTER INDEX ORACLE
══════════════════════════════════════════════════════════════════════
Network: arbitrumSepolia

Deployer: 0x...

📦 Loading deployed contracts...

✅ DataStore: 0x...
✅ IndexToken: 0x...
✅ IndexPriceFeed: 0x...

🔍 Performing safety checks...

✅ IndexToken address is valid
✅ IndexPriceFeed address is valid
✅ No existing oracle mapping found

📝 Registering IndexPriceFeed in DataStore...

   Token:        0x...
   Price Feed:   0x...
   Key:          0x...

✅ Oracle registered successfully!

🔍 Verifying registration...

✅ Verification successful!
   Registered oracle: 0x...

══════════════════════════════════════════════════════════════════════
 REGISTRATION SUMMARY
══════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────┐
│ Oracle Registration                                               │
├────────────────────────────────────────────────────────────────────┤
│ IndexToken:     0x...                                             │
│ IndexPriceFeed: 0x...                                             │
│ DataStore:      0x...                                             │
│ Key:            0x...                                             │
└────────────────────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════════════════════
 ✅ INDEX ORACLE REGISTRATION COMPLETE!
══════════════════════════════════════════════════════════════════════

📝 Next Steps:
   1. Verify oracle price using: npx hardhat run scripts/getOraclePrice.ts
   2. Create GMX market using IndexToken as indexToken
   3. Seed testnet liquidity
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

3. **Permission Denied:**
   ```
   ❌ Permission denied. Ensure deployer has CONTROLLER role in DataStore.
   ```

4. **Verification Failure:**
   ```
   ❌ Verification failed!
      Expected: 0x...
      Got:      0x...
   ```

## Manual Registration (Alternative)

If you need to register manually or via a different method:

```typescript
import hre from "hardhat";
import * as keys from "../utils/keys";

const dataStore = await hre.ethers.getContract("DataStore");
const indexToken = await hre.ethers.getContract("IndexToken");
const indexPriceFeed = await hre.ethers.getContract("IndexPriceFeed");

const priceFeedKey = keys.priceFeedKey(indexToken.address);
await dataStore.setAddress(priceFeedKey, indexPriceFeed.address);
```

## Additional Configuration (Optional)

While the registration script only sets the price feed address, you may also want to configure:

1. **Price Feed Multiplier:**
   ```typescript
   const multiplierKey = keys.priceFeedMultiplierKey(indexToken.address);
   // For 18-decimal token with 8-decimal feed: 10^(60-8-18) = 10^34
   const multiplier = expandDecimals(1, 34);
   await dataStore.setUint(multiplierKey, multiplier);
   ```

2. **Heartbeat Duration:**
   ```typescript
   const heartbeatKey = keys.priceFeedHeartbeatDurationKey(indexToken.address);
   const heartbeat = 86400; // 24 hours in seconds
   await dataStore.setUint(heartbeatKey, heartbeat);
   ```

**Note:** The `IndexPriceFeed` contract already enforces heartbeats internally, so setting this in DataStore is optional but recommended for consistency.

## Verification

After registration, verify the oracle is working:

1. **Check DataStore:**
   ```typescript
   const dataStore = await hre.ethers.getContract("DataStore");
   const priceFeedKey = keys.priceFeedKey(indexToken.address);
   const registeredFeed = await dataStore.getAddress(priceFeedKey);
   console.log("Registered feed:", registeredFeed);
   ```

2. **Test Price Resolution:**
   ```typescript
   const indexPriceFeed = await hre.ethers.getContractAt("IndexPriceFeed", registeredFeed);
   const (roundId, price, startedAt, updatedAt, answeredInRound) = 
       await indexPriceFeed.latestRoundData();
   console.log("Index price:", price.toString());
   ```

3. **Test GMX Integration:**
   ```typescript
   const oracleProvider = await hre.ethers.getContract("ChainlinkPriceFeedProvider");
   const price = await oracleProvider.getOraclePrice(indexToken.address, "0x");
   console.log("GMX resolved price:", price.price.toString());
   ```

## Troubleshooting

### Issue: "Permission denied"

**Solution:** Ensure deployer has `CONTROLLER` role:
```typescript
const roleStore = await hre.ethers.getContract("RoleStore");
const CONTROLLER = await roleStore.CONTROLLER();
await roleStore.grantRole(deployer, CONTROLLER);
```

### Issue: "Oracle already registered with different address"

**Solution:** This means another oracle is already registered. You can:
- Overwrite it (if you have permission)
- Use a different token address
- Remove the existing mapping first (requires admin)

### Issue: "Verification failed"

**Solution:** 
- Check transaction was mined successfully
- Verify you're reading from the correct network
- Ensure DataStore address is correct

## Next Steps

After successful registration:

1. ✅ **Oracle is registered** - GMX can now resolve index token prices
2. ⏭️ **Create GMX Market** - Use `IndexToken` as `indexToken` in market creation
3. ⏭️ **Seed Liquidity** - Add initial liquidity to the market
4. ⏭️ **Test Trading** - Verify positions can be opened/closed

## Related Documentation

- [Index Oracle Implementation](./INDEX_ORACLE_IMPLEMENTATION.md) - Technical details of `IndexPriceFeed`
- [Index Token Documentation](./INDEX_TOKEN.md) - Details about `IndexToken` contract
- [GMX V2 Documentation](https://docs.gmx.io/) - Official GMX documentation

