# Index Deposit Execution Guide

## Overview

This document explains the two-step deposit process in GMX V2 and how to execute deposits for the DFI/USDC index market on Arbitrum Sepolia testnet.

## Two-Step Deposit Process

GMX V2 uses a **two-step deposit process** for security and gas efficiency:

### Step 1: Create Deposit (`createDeposit`)

1. **User Action**: User calls `ExchangeRouter.createDeposit()` with deposit parameters
2. **What Happens**:
   - Tokens are transferred to `DepositVault`
   - Deposit record is created in `DataStore`
   - Deposit is added to pending deposits list
   - **No GM tokens are minted yet**

3. **State**: Deposit is **pending execution**

### Step 2: Execute Deposit (`executeDeposit`)

1. **Keeper Action**: Keeper (or user with `MARKET_KEEPER` role) calls `DepositHandler.executeDeposit()`
2. **What Happens**:
   - Oracle prices are validated
   - Tokens are converted to market tokens (GM tokens)
   - GM tokens are minted to the receiver
   - Deposit is removed from pending list
   - **Liquidity is now live**

3. **State**: Deposit is **executed**, GM tokens minted

## Why Two Steps?

### Security Benefits

1. **Oracle Price Validation**: Execution requires fresh oracle prices, preventing price manipulation
2. **Gas Efficiency**: Users don't pay for oracle price fetching (keepers do)
3. **Error Handling**: Failed executions can be retried without user action

### Operational Benefits

1. **Keeper Network**: Automated keepers can batch execute multiple deposits
2. **Price Updates**: Execution uses latest oracle prices at execution time
3. **Gas Optimization**: Keepers can optimize gas usage across multiple deposits

## Testnet vs Mainnet

### Testnet (Arbitrum Sepolia)

**Manual Execution Required**:
- No automated keeper network on testnet
- Deployer must manually execute deposits
- Use `scripts/executeIndexDeposits.ts` to execute pending deposits

**Why Manual?**:
- Testnet doesn't have the same keeper infrastructure as mainnet
- Allows for testing and debugging
- Gives full control over execution timing

### Mainnet

**Automated Execution**:
- Keeper network automatically executes deposits
- Execution happens within minutes (usually < 5 minutes)
- No manual intervention required

**Keeper Network**:
- Multiple keepers monitor pending deposits
- First keeper to execute gets the execution fee
- Competitive execution ensures fast processing

## Executing Deposits on Testnet

### Prerequisites

1. **MARKET_KEEPER Role**: Deployer must have `MARKET_KEEPER` role
   - This is automatically granted in `createIndexMarket.ts` if deployer has `ROLE_ADMIN`
   - Verify with: Check DataStore for role assignments

2. **Oracle Prices**: Oracle must have valid prices for:
   - Index Token (DFI) - via IndexPriceFeed
   - Collateral Token (USDC) - via Chainlink feed

3. **Gas**: Sufficient ETH/WNT for gas fees

### Execution Script

**Run the execution script**:

```bash
npx hardhat run scripts/executeIndexDeposits.ts --network arbitrumSepolia
```

**What the script does**:

1. **Finds Pending Deposits**:
   - Queries `DataStore` for all deposits created by deployer
   - Uses `accountDepositListKey(deployer)` to get deposit keys

2. **Fetches Oracle Prices**:
   - Gets prices from Chainlink feeds for DFI and USDC
   - Constructs `SetPricesParams` for oracle validation

3. **Executes Each Deposit**:
   - Calls `DepositHandler.executeDeposit(depositKey, oracleParams)`
   - Handles gas limits safely (5M gas limit)
   - Prints success or error messages

4. **Verifies Execution**:
   - Checks for `DepositExecuted` events
   - Displays GM tokens received

### Expected Output

```
══════════════════════════════════════════════════════════════════════
 EXECUTE INDEX DEPOSITS
══════════════════════════════════════════════════════════════════════
Network: arbitrumSepolia

Deployer: 0x...

📦 Loading contracts...

✅ DepositHandler: 0x...
✅ Reader: 0x...
✅ IndexToken: 0x...
✅ USDC: 0x...

🔍 Finding pending deposits...

   Found 1 deposit(s) for deployer

📝 Executing deposits...

────────────────────────────────────────────────────────────────────
 Deposit 1/1
────────────────────────────────────────────────────────────────────
   Key: 0x...

   Account: 0x...
   Market: 0x...
   Long Token: 0x...
   Short Token: 0x...
   Long Amount: 10.0 USDC
   Short Amount: 10.0 USDC
   Min Market Tokens: 0.0

   📊 Fetching oracle prices...
   ✅ Oracle prices fetched

   ⚡ Executing deposit...
   📝 Transaction sent: 0x...
   ✅ Deposit executed! (Block: 227730200, Gas: 2345678)

   🎉 GM Tokens Received: 9.95 GM

══════════════════════════════════════════════════════════════════════
 ✅ DEPOSIT EXECUTION COMPLETE
══════════════════════════════════════════════════════════════════════
```

## Verifying Liquidity

After executing deposits, verify that liquidity is live:

```bash
npx hardhat run scripts/verifyIndexLiquidity.ts --network arbitrumSepolia
```

**What to check**:

1. **GM Total Supply**: Should be > 0 if deposits executed
2. **Deployer GM Balance**: Should match expected GM tokens received
3. **Market Status**: Market should be ready for trading

**Expected Output**:

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    LIQUIDITY LIVE ✅                              │
│                                                                   │
└────────────────────────────────────────────────────────────────────┘

✅ GM tokens have been minted successfully!
✅ Total Supply: 9.95 GM
✅ Your Balance: 9.95 GM
```

## Troubleshooting

### Error: "onlyOrderKeeper"

**Problem**: Deployer doesn't have `MARKET_KEEPER` role

**Solution**:
1. Grant `MARKET_KEEPER` role to deployer:
   ```bash
   npx hardhat run scripts/grantControllerToDeployer.ts --network arbitrumSepolia
   ```
2. Or use `createIndexMarket.ts` which auto-grants the role

### Error: "Oracle not registered"

**Problem**: IndexPriceFeed not registered in DataStore

**Solution**:
1. Run oracle registration script:
   ```bash
   npx hardhat run scripts/registerIndexOracle.ts --network arbitrumSepolia
   ```

### Error: "Insufficient gas"

**Problem**: Gas limit too low

**Solution**:
1. Increase gas limit in script (default: 5M)
2. Check network gas prices
3. Ensure sufficient ETH/WNT balance

### Error: "Deposit not found"

**Problem**: Deposit already executed or invalid key

**Solution**:
1. Check deposit status via `scripts/printDeposits.ts`
2. Verify deposit key is correct
3. Check if deposit was already executed

## Best Practices

1. **Execute Soon After Creation**: Execute deposits within a few blocks to avoid stale prices
2. **Monitor Gas Prices**: Execute when gas prices are reasonable
3. **Verify After Execution**: Always run `verifyIndexLiquidity.ts` after execution
4. **Check Events**: Monitor `DepositExecuted` events for confirmation
5. **Handle Errors Gracefully**: Script continues with next deposit if one fails

## Summary

- **Two-step process**: Create → Execute
- **Testnet**: Manual execution required
- **Mainnet**: Automated by keeper network
- **Verification**: Always verify liquidity after execution
- **Troubleshooting**: Check roles, oracle registration, and gas limits

For questions or issues, refer to the GMX V2 documentation or contact the development team.

