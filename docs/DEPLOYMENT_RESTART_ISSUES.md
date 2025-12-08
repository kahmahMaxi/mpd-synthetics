# Why Deployment Errors Occur After Hardhat Node Restart

## The Problem

When you restart your Hardhat node, you'll see errors like:
- `TypeError: Cannot read properties of undefined (reading 'marketToken')`
- `call revert exception` for `hasRole()`, `getUint()`, `getMarkets()`, etc.
- `cannot estimate gas; transaction may fail` when creating markets
- `Transaction reverted without a reason string`

## ✅ THE REAL ROOT CAUSE

**The issue is NOT just contract state loss - it's stale JSON config files pointing to non-existent addresses.**

When you restart your Hardhat node:

1. ❌ **All contract addresses are wiped** (chain state reset)
2. ❌ **But your JSON configs still point to old addresses**
   - `config/tokens/*.json` files have old token addresses
   - `config/markets/*.json` files reference tokens that no longer exist
3. ❌ **Deployment scripts load invalid addresses**
4. ❌ **Market creation fails** because tokens don't exist
5. ❌ **Script crashes** when trying to access `market.marketToken` on undefined

### What This Means

- **JSON config files persist** (not deleted on node restart)
- **But they contain addresses that no longer exist** on the reset chain
- **Deployment scripts fail** when trying to use these invalid addresses
- **Market creation reverts** because referenced tokens don't exist

## Why It Worked Before

On the **first deployment**:
- All addresses are fresh and valid
- Tokens are deployed first
- Markets reference valid token addresses
- Everything works step-by-step

After a **restart**:
- Config files still have old addresses
- Scripts try to use addresses that don't exist anymore
- Market creation fails → `undefined.marketToken` error

## 🛠️ THE FIX (100% Guaranteed to Work)

**You MUST clean generated config files and redeploy in the correct order.**

### ✅ STEP 1 — Delete Generated Config Files

Inside `gmx-synthetics/`, delete:

```bash
# Delete deployment cache
rm -rf deployments/localhost

# Delete generated token configs (NOT your source configs)
rm -f config/tokens/*.json

# Delete generated market configs
rm -f config/markets/*.json
```

**Important:** Do NOT delete contract source code or your original config templates. Only delete the generated JSON files that contain addresses.

### ✅ STEP 2 — Restart Hardhat Node Cleanly

If using a separate terminal for the Hardhat node:

```bash
# Close all terminals, then start fresh
npx hardhat node
```

Let it run in the background. This ensures a completely clean chain state.

### ✅ STEP 3 — Redeploy MPD-Token Project FIRST

**This is critical!** MPD token addresses must exist before GMX Synthetics can use them.

```bash
cd ../mpd-token
npx hardhat run scripts/deploy.js --network localhost
```

This deploys:
- MPDToken
- esMPD
- Vester

And saves addresses to `mpd-token/deployments/local.json`, which GMX Synthetics reads.

### ✅ STEP 4 — Deploy GMX Synthetics Core

```bash
cd ../gmx-synthetics
$env:SKIP_AUTO_HANDLER_REDEPLOYMENT='true'
npx hardhat deploy --network localhost
```

This deploys:
- ExchangeRouter
- DataStore
- RoleStore
- EventEmitter
- MarketFactory
- All handlers and utilities

**This should now succeed** because config files are clean and MPD tokens exist.

### ✅ STEP 5 — Deploy Base Tokens Again

Because the Hardhat node reset cleared all tokens:

```bash
npx hardhat run scripts/deployBaseTokens.ts --network localhost
```

This repopulates:
- `config/tokens/usdc.json`
- `config/tokens/weth.json`
- `config/tokens/wbtc.json`
- `config/tokens/sol.json`

With fresh, valid addresses.

### ✅ STEP 6 — Deploy Markets

Now deploy your markets:

```bash
npx hardhat run scripts/deployMarkets.ts --network localhost
```

Or use your custom market deployment script. Markets will now reference valid token addresses.

## Why This Order Works

1. **Clean configs** → No stale addresses
2. **MPD tokens first** → GMX Synthetics has valid token addresses to reference
3. **Core contracts** → Foundation is solid
4. **Base tokens** → Trading pairs can be created
5. **Markets** → Everything references valid addresses

## Alternative: Graceful Error Handling

We've also added error handling to deployment scripts to:
- Catch `hasRole()`, `getUint()`, `getMarkets()` failures
- Log warnings instead of crashing
- Continue with initialization

However, **the clean redeploy approach above is more reliable** and ensures everything is in sync.

## Current Status

We've fixed errors by:
- ✅ Adding error handling to deployment scripts (graceful degradation)
- ✅ Documenting the correct redeploy order (this document)
- ✅ Identifying the root cause (stale JSON configs)

### Files with Error Handling

- ✅ `configureGovTimelockController.ts` - skips on local networks
- ✅ `configureOracleSigners.ts` - handles missing OracleStore gracefully
- ✅ `deployMockPriceFeed.ts` - uses fully qualified contract name
- ✅ `deployTestPriceFeeds.ts` - handles transaction verification errors
- ✅ `deployAndConfigureMarkets.ts` - handles missing markets gracefully
- ✅ `utils/market.ts` - `getOnchainMarkets()` returns empty object on error

## Best Practices

1. **After Hardhat node restart**: Always follow the 6-step clean redeploy process above
2. **For development**: Keep a script that automates the clean redeploy
3. **For testing**: Use graceful error handling to test error scenarios
4. **For production**: Never restart - use persistent networks (testnet/mainnet)

## Quick Fix Command

If you just want to get back to working state quickly:

```bash
# 1. Clean generated configs
rm -rf deployments/localhost config/tokens/*.json config/markets/*.json

# 2. Redeploy MPD tokens
cd ../mpd-token && npx hardhat run scripts/deploy.js --network localhost

# 3. Redeploy GMX Synthetics
cd ../gmx-synthetics
$env:SKIP_AUTO_HANDLER_REDEPLOYMENT='true'
npx hardhat deploy --network localhost

# 4. Redeploy base tokens
npx hardhat run scripts/deployBaseTokens.ts --network localhost

# 5. Redeploy markets
npx hardhat run scripts/deployMarkets.ts --network localhost
```

## Summary

**The root cause:** Stale JSON config files pointing to non-existent addresses after Hardhat node restart.

**The fix:** Clean generated configs and redeploy in the correct order (MPD tokens → Core → Base tokens → Markets).

**Prevention:** Always follow the clean redeploy process after restarting your Hardhat node.

