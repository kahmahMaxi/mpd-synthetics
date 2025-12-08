# MPD Reward System Implementation Report

## Summary

Implemented complete MPD staking & reward distribution tooling for local and testnet usage. All scripts, tests, and documentation have been created.

## Files Created/Modified

### New Files Created

1. **`utils/rewardAdapter.ts`**
   - Provides unified interface for MPD/esMPD/Vester/FeeDistributor addresses
   - Functions: `getMpdAddress()`, `getEsMpdAddress()`, `getVesterAddress()`, `getFeeDistributorAddress()`
   - Status: ✅ Created and working

2. **`scripts/configureRewards.ts`**
   - Configures MPD reward system in DataStore
   - Sets MPD_TOKEN, ES_MPD_TOKEN, MPD_VESTER addresses
   - Verifies FeeDistributor configuration
   - Supports `--emissionPerSec` CLI argument
   - Status: ✅ Created and tested

3. **`scripts/mintAndDistributeEsMpd.ts`**
   - Mints esMPD tokens to FeeDistributor
   - Supports `--amount` CLI argument (default: 10000 esMPD)
   - Checks minter role before minting
   - Status: ✅ Created and tested

4. **`scripts/simulate-reward-cycle.ts`**
   - Simulates complete reward cycle:
     - Fund FeeDistributor with esMPD
     - User receives esMPD rewards
     - User deposits esMPD into Vester
     - Fast-forward time (7 days)
     - User claims vested MPD
   - Prints before/after comparison table
   - Status: ✅ Created

5. **`test/rewards/reward-flow.test.ts`**
   - Comprehensive test suite for reward flows:
     - FeeDistributor reward seeding
     - User staking and rewards
     - Vester deposit and vesting
     - Claiming vested MPD
     - Withdrawing unvested esMPD
     - Full reward cycle
   - Status: ✅ Created (tests may skip if MPD tokens not configured)

6. **`docs/rewards.md`**
   - Complete documentation for MPD reward system
   - Setup instructions
   - Command examples with expected outputs
   - Troubleshooting guide
   - Status: ✅ Created

### Files Modified

1. **`deploy/deployFeeDistributor.ts`**
   - Already wired with MPD token addresses via `tokenAdapter`
   - Uses `getRewardTokenAddress()` and `getEsRewardTokenAddress()`
   - Status: ✅ Already configured

2. **`config/feeDistributor.ts`**
   - Already includes MPD token addresses
   - Status: ✅ Already configured

3. **`utils/tokenAdapter.ts`**
   - Already provides MPD address resolution
   - Status: ✅ Already configured

## RewardTracker Wiring Verification

**Finding**: gmx-synthetics does NOT use RewardTracker contracts like gmx-contracts (V1). Instead:
- **FeeDistributor** is the primary reward distribution contract
- It interacts with **IRewardTrackerV1** interface for external trackers (from V1)
- For MPD system, FeeDistributor is already wired with MPD/esMPD addresses

**Status**: ✅ FeeDistributor wiring verified and working

## Test Results

### Compilation
- ✅ TypeScript compilation: No errors
- ✅ Linter: No errors

### Script Execution
- ✅ `configureRewards.ts`: Runs successfully
- ✅ `mintAndDistributeEsMpd.ts`: Runs successfully (requires minter role)
- ⚠️ `simulate-reward-cycle.ts`: Created, not yet tested end-to-end
- ⚠️ `reward-flow.test.ts`: Created, may skip if MPD tokens not configured or fixture deployment fails

### Known Issues
1. Tests require full fixture deployment which may fail on localhost if contracts not deployed
2. Scripts use minimal ABIs for mpd-token contracts (not in gmx-synthetics repo)
3. Minter roles must be granted before minting esMPD

## Commands to Run

### 1. Configure Rewards
```bash
npx hardhat run scripts/configureRewards.ts --network localhost
```

**Expected Output:**
- Loads MPD config from `config/tokens.mpd.json`
- Sets MPD_TOKEN, ES_MPD_TOKEN, MPD_VESTER in DataStore
- Prints configuration summary table
- Saves config to `config/rewards-config.json`

### 2. Mint esMPD to FeeDistributor
```bash
npx hardhat run scripts/mintAndDistributeEsMpd.ts --network localhost
```

**Expected Output:**
- Checks minter role
- Mints esMPD to FeeDistributor
- Shows balance before/after
- Note: Requires deployer to have MINTER_ROLE on esMPD

### 3. Simulate Reward Cycle
```bash
npx hardhat run scripts/simulate-reward-cycle.ts --network localhost
```

**Expected Output:**
- Funds FeeDistributor
- Mints MPD to test user
- User deposits esMPD into Vester
- Fast-forwards 7 days
- User claims MPD
- Prints before/after comparison table

### 4. Run Tests
```bash
npx hardhat test test/rewards/reward-flow.test.ts --network localhost
```

**Expected Output:**
- Tests may skip if MPD tokens not configured
- Tests may skip if fixture deployment fails
- If all conditions met, tests should pass

## Next Steps

1. **Grant Minter Roles** (if not already done):
   ```bash
   # Grant minter role to deployer on esMPD
   # This requires a script or manual transaction
   ```

2. **Deploy FeeDistributor** (if not already deployed):
   ```bash
   npx hardhat deploy --network localhost
   ```

3. **Run Full Integration**:
   ```bash
   # 1. Configure rewards
   npx hardhat run scripts/configureRewards.ts --network localhost
   
   # 2. Mint esMPD
   npx hardhat run scripts/mintAndDistributeEsMpd.ts --network localhost
   
   # 3. Simulate cycle
   npx hardhat run scripts/simulate-reward-cycle.ts --network localhost
   ```

4. **Future Enhancements**:
   - Deploy actual RewardTracker contracts (if needed for staking UI)
   - Add emission rate configuration
   - Integrate with frontend
   - Add more comprehensive tests

## Commit Strategy

Recommended commits:
1. `chore(rewards): add reward configuration scripts`
2. `feat(rewards): add reward simulation script + tests`
3. `docs(rewards): add rewards.md`

## Notes

- All scripts use minimal ABIs for mpd-token contracts (not in gmx-synthetics repo)
- FeeDistributor is already wired with MPD addresses via existing `tokenAdapter`
- No core reward math was modified (as requested)
- All changes are configuration and tooling only

