# MPD Reward System Documentation

This document describes the MPD reward distribution system for MPD DEX, including staking, vesting, and claiming flows.

## Overview

The MPD reward system consists of:
- **MPD Token**: Governance token (replaces GMX)
- **esMPD Token**: Escrowed reward token (replaces esGMX)
- **Vester Contract**: Converts esMPD to MPD over time
- **FeeDistributor**: Distributes protocol fees as esMPD rewards

## Architecture

```
FeeDistributor (collects fees)
    ↓
esMPD rewards
    ↓
Users claim esMPD
    ↓
Users deposit esMPD into Vester
    ↓
Vester vests esMPD → MPD over time
    ↓
Users claim MPD
```

## Setup

### 1. Configure Rewards

Configure the reward system with MPD token addresses:

```bash
npx hardhat run scripts/configureRewards.ts --network localhost
```

Optional: Set emission rate:
```bash
npx hardhat run scripts/configureRewards.ts --network localhost --emissionPerSec 1000000000000000000
```

**Expected Output:**
```
══════════════════════════════════════════════════════════════════════
 CONFIGURE REWARDS
══════════════════════════════════════════════════════════════════════
Network: localhost

📂 Loaded MPD Config:
   MPD Token: 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0
   esMPD: 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82
   Vester: 0x9A676e781A523b5d0C0e43731313A708CB607508

1️⃣  Setting MPD token addresses in DataStore...
   ✅ MPD_TOKEN: 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0
   ✅ ES_MPD_TOKEN: 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82
   ✅ MPD_VESTER: 0x9A676e781A523b5d0C0e43731313A708CB607508

✅ REWARD CONFIGURATION COMPLETE!
```

### 2. Mint esMPD to FeeDistributor

Fund the FeeDistributor with esMPD for reward distribution:

```bash
npx hardhat run scripts/mintAndDistributeEsMpd.ts --network localhost
```

Optional: Specify amount:
```bash
npx hardhat run scripts/mintAndDistributeEsMpd.ts --network localhost --amount 10000000000000000000000
```

**Expected Output:**
```
══════════════════════════════════════════════════════════════════════
 MINT AND DISTRIBUTE esMPD
══════════════════════════════════════════════════════════════════════
Network: localhost

📦 Addresses:
   esMPD: 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82
   FeeDistributor: 0x...
   Amount: 10000.0 esMPD

Minting 10000.0 esMPD to FeeDistributor...
✅ Minted successfully!

New FeeDistributor esMPD balance: 10000.0 esMPD

✅ MINTING COMPLETE!
```

## Reward Flow Simulation

Simulate a complete reward cycle:

```bash
npx hardhat run scripts/simulate-reward-cycle.ts --network localhost
```

**Expected Output:**
```
══════════════════════════════════════════════════════════════════════
 SIMULATE REWARD CYCLE
══════════════════════════════════════════════════════════════════════

STEP 1: INITIAL STATE
Test User Balances:
   MPD: 0.0
   esMPD: 0.0
   Vester Deposited: 0.0
   Vester Claimable: 0.0

STEP 2: FUND FEE DISTRIBUTOR
✅ Minted successfully

STEP 5: USER DEPOSITS esMPD INTO VESTER
✅ Deposited successfully

STEP 6: FAST-FORWARD TIME (7 DAYS)
Fast-forwarding 604800 seconds (7 days)...

STEP 7: CHECK CLAIMABLE AMOUNT
Claimable MPD: 1.9178 MPD

STEP 8: CLAIM FROM VESTER
✅ Claimed successfully

══════════════════════════════════════════════════════════════════════
 BEFORE / AFTER COMPARISON
══════════════════════════════════════════════════════════════════════

┌──────────────────────────┬──────────────────┬──────────────────┬──────────────┐
│ Token                   │ Before           │ After            │ Change       │
├──────────────────────────┼──────────────────┼──────────────────┼──────────────┤
│ MPD                     │ 0.0              │ 1.9178           │ +1.9178      │
│ esMPD                   │ 0.0              │ 0.0              │ 0.0          │
│ Vester Deposited        │ 0.0              │ 100.0            │ +100.0       │
│ Vester Claimable        │ 0.0              │ 0.0              │ 0.0          │
└──────────────────────────┴──────────────────┴──────────────────┴──────────────┘

✅ REWARD CYCLE SIMULATION COMPLETE!
```

## Testing

Run the reward flow tests:

```bash
npx hardhat test test/rewards/reward-flow.test.ts --network localhost
```

**Test Coverage:**
- FeeDistributor reward seeding
- User staking and rewards
- Vester deposit and vesting
- Claiming vested MPD
- Withdrawing unvested esMPD
- Full reward cycle

## Key Contracts

### MPDToken
- **Address**: From `config/tokens.mpd.json`
- **Purpose**: Governance token
- **Features**: Mintable by owner, standard ERC20

### EsMPD
- **Address**: From `config/tokens.mpd.json`
- **Purpose**: Escrowed reward token
- **Features**: Non-transferable, mintable/burnable by authorized minters

### Vester
- **Address**: From `config/tokens.mpd.json`
- **Purpose**: Converts esMPD to MPD over time
- **Features**: Linear vesting, deposit/claim/withdraw functions

### FeeDistributor
- **Address**: Deployed via `deployFeeDistributor.ts`
- **Purpose**: Distributes protocol fees as rewards
- **Features**: Multi-chain support, fee collection, reward distribution

## Configuration Files

- `config/tokens.mpd.json`: MPD token addresses
- `config/deploy-config.mpd.json`: Full deployment configuration
- `config/rewards-config.json`: Generated reward configuration summary

## Troubleshooting

### "MPD token addresses not configured"
Run `configureRewards.ts` first to set up token addresses in DataStore.

### "Deployer does not have MINTER_ROLE"
Grant minter role to deployer:
```bash
# For esMPD
npx hardhat run scripts/grantMinterRole.ts --network localhost
```

### "FeeDistributor not deployed"
Deploy FeeDistributor first:
```bash
npx hardhat deploy --network localhost
```

## Next Steps

1. Deploy RewardTracker contracts (if needed for staking)
2. Configure emission rates
3. Set up reward distribution schedule
4. Integrate with frontend

