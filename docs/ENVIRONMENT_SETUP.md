# Environment Setup Guide

This guide explains how to configure your environment variables, API keys, and private keys for deploying and interacting with the GMX Synthetics contracts.

## Quick Start

1. Create a `.env` file in the `gmx-synthetics` root directory
2. Add your private key and API keys (see sections below)
3. Optionally create `.rpcs.json` for custom RPC URLs
4. Optionally create `keys/` directory for secure key storage

## Required Environment Variables

### Private Keys (Deployer Account)

You have **three options** for providing your deployer private key:

#### Option 1: Direct Environment Variable (Simplest)

Add to `.env`:
```bash
# For Arbitrum Sepolia (recommended for testing)
ARBITRUM_SEPOLIA_ACCOUNT_KEY=your_private_key_here_without_0x_prefix

# OR for general use (any network)
ACCOUNT_KEY=your_private_key_here_without_0x_prefix

# OR for Arbitrum mainnet
ARBITRUM_ACCOUNT_KEY=your_private_key_here_without_0x_prefix
```

**Priority Order:**
1. `ARBITRUM_SEPOLIA_ACCOUNT_KEY` (if deploying to arbitrumSepolia)
2. `ARBITRUM_ACCOUNT_KEY` (if deploying to arbitrum)
3. `ACCOUNT_KEY` (fallback for any network)

#### Option 2: Key File (More Secure)

1. Create a `keys/` directory in the project root:
   ```bash
   mkdir keys
   ```

2. Create a JSON file in `keys/` (e.g., `keys/deployer.json`):
   ```json
   {
     "key": "your_private_key_here_without_0x_prefix"
   }
   ```

   OR use a mnemonic:
   ```json
   {
     "mnemonic": "word1 word2 word3 ... word12"
   }
   ```

3. Add to `.env`:
   ```bash
   ACCOUNT_KEY_FILE=deployer.json
   ```

#### Option 3: Mnemonic in Key File

Same as Option 2, but the script will derive the private key from the mnemonic.

### API Keys (For Contract Verification)

#### Arbitrum Sepolia (Testnet)

**Required for:** Contract verification on Arbiscan

**How to get:**
1. Go to [Arbiscan Sepolia](https://sepolia.arbiscan.io/)
2. Sign up for a free account
3. Go to API Keys section
4. Create a new API key
5. Copy the API key

**Add to `.env`:**
```bash
ARBISCAN_API_KEY=your_arbiscan_api_key_here
```

#### Base Sepolia (If using Base)

**How to get:**
1. Go to [Basescan Sepolia](https://sepolia.basescan.org/)
2. Sign up for a free account
3. Create an API key

**Add to `.env`:**
```bash
BASESCAN_API_KEY=your_basescan_api_key_here
```

#### Other Networks (Optional)

```bash
# Ethereum Sepolia
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Avalanche (Snowtrace)
SNOWTRACE_API_KEY=your_snowtrace_api_key_here
```

### Optional: Custom RPC URLs

If you want to use a custom RPC provider (e.g., Alchemy, Infura, QuickNode), create `.rpcs.json`:

```json
{
  "arbitrumSepolia": "https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
  "arbitrum": "https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
  "baseSepolia": "https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
}
```

**Note:** The config has default public RPC URLs, so this is optional unless you need:
- Higher rate limits
- Better reliability
- WebSocket support

## Complete .env File Example

Create `.env` in the `gmx-synthetics` root directory:

```bash
# ============================================
# DEPLOYER PRIVATE KEYS
# ============================================
# Use ONE of these options:

# Option A: Direct private key for Arbitrum Sepolia (recommended)
ARBITRUM_SEPOLIA_ACCOUNT_KEY=your_64_character_hex_private_key_without_0x

# Option B: General private key (fallback)
# ACCOUNT_KEY=your_64_character_hex_private_key_without_0x

# Option C: Use key file (set ACCOUNT_KEY_FILE instead)
# ACCOUNT_KEY_FILE=deployer.json

# ============================================
# API KEYS (For Contract Verification)
# ============================================
# Required for Arbitrum Sepolia
ARBISCAN_API_KEY=your_arbiscan_api_key_here

# Optional: For other networks
# BASESCAN_API_KEY=your_basescan_api_key_here
# ETHERSCAN_API_KEY=your_etherscan_api_key_here
# SNOWTRACE_API_KEY=your_snowtrace_api_key_here

# ============================================
# OPTIONAL: GAS REPORTING
# ============================================
# Set to "true" to enable gas reporting in tests
# REPORT_GAS=false

# ============================================
# OPTIONAL: SKIP AUTO HANDLER REDEPLOYMENT
# ============================================
# Set to "true" to skip automatic handler redeployment
# SKIP_AUTO_HANDLER_REDEPLOYMENT=false
```

## Security Best Practices

### ⚠️ NEVER Commit Private Keys

1. **Verify `.env` is in `.gitignore`:**
   ```bash
   # Check if .env is ignored
   cat .gitignore | grep "\.env"
   ```

2. **Use separate accounts:**
   - Testnet: Use a dedicated testnet account with minimal funds
   - Mainnet: Use a hardware wallet or secure key management

3. **Key file option is more secure:**
   - Store keys in `keys/` directory (already in `.gitignore`)
   - Use environment variable to point to key file
   - Never commit the `keys/` directory

### Private Key Format

- **With 0x prefix:** `0x1234567890abcdef...` (64 hex chars after 0x)
- **Without 0x prefix:** `1234567890abcdef...` (64 hex chars)
- Both formats are accepted

### Mnemonic Format

If using mnemonic in key file:
```json
{
  "mnemonic": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
}
```

The script will automatically derive the private key from the mnemonic.

## Getting API Keys

### 1. Arbiscan API Key (Arbitrum Sepolia)

**Steps:**
1. Visit: https://sepolia.arbiscan.io/
2. Click "Sign Up" or "Login"
3. Go to "API-KEYs" in your account menu
4. Click "Add" to create a new API key
5. Name it (e.g., "GMX Synthetics")
6. Copy the API key

**Free tier:** Usually sufficient for testnet verification

### 2. Basescan API Key (Base Sepolia)

**Steps:**
1. Visit: https://sepolia.basescan.org/
2. Sign up / Login
3. Go to API Keys section
4. Create new API key
5. Copy the API key

### 3. Custom RPC Providers (Optional)

**Alchemy:**
1. Visit: https://www.alchemy.com/
2. Create free account
3. Create new app → Select network (Arbitrum Sepolia)
4. Copy HTTP URL (includes API key)

**Infura:**
1. Visit: https://www.infura.io/
2. Create free account
3. Create new project → Select network
4. Copy endpoint URL (includes API key)

**QuickNode:**
1. Visit: https://www.quicknode.com/
2. Create free account
3. Create endpoint → Select network
4. Copy HTTP URL (includes API key)

## File Structure

After setup, your project should look like:

```
gmx-synthetics/
├── .env                    # Your environment variables (NOT committed)
├── .rpcs.json             # Optional: Custom RPC URLs (NOT committed)
├── keys/                   # Optional: Secure key storage (NOT committed)
│   └── deployer.json      # Your key file (if using key file option)
├── hardhat.config.ts
└── ...
```

## Verification

### Test Your Setup

1. **Check environment variables are loaded:**
   ```bash
   # This should not error
   npx hardhat run scripts/createIndexMarket.ts --network arbitrumSepolia --dry-run
   ```

2. **Verify private key format:**
   ```bash
   # If using direct key, check it's 64 hex characters
   echo $ARBITRUM_SEPOLIA_ACCOUNT_KEY | wc -c
   # Should output 65 (64 chars + newline) or 66 (with 0x prefix)
   ```

3. **Test network connection:**
   ```bash
   npx hardhat run scripts/createIndexMarket.ts --network arbitrumSepolia
   # Should connect to network (may fail on other checks, but connection should work)
   ```

## Troubleshooting

### Error: "Invalid private key"

**Solution:**
- Ensure private key is 64 hex characters (or 66 with 0x)
- Remove any spaces or newlines
- Check if key file exists and is valid JSON

### Error: "API key not found"

**Solution:**
- Verify API key is in `.env` file
- Check variable name matches exactly (case-sensitive)
- Restart terminal/IDE after adding to `.env`

### Error: "RPC URL not found"

**Solution:**
- Default RPC URLs are provided, but if you need custom:
- Create `.rpcs.json` with network name as key
- Or check network name matches exactly

### Error: "Account not found"

**Solution:**
- Ensure at least one of these is set:
  - `ARBITRUM_SEPOLIA_ACCOUNT_KEY`
  - `ARBITRUM_ACCOUNT_KEY`
  - `ACCOUNT_KEY`
  - `ACCOUNT_KEY_FILE` (with valid key file)

## Example: Full Setup for Arbitrum Sepolia

1. **Create `.env`:**
   ```bash
   ARBITRUM_SEPOLIA_ACCOUNT_KEY=abc123def456...your_64_char_key
   ARBISCAN_API_KEY=your_arbiscan_key_here
   ```

2. **Optional: Create `.rpcs.json` for better RPC:**
   ```json
   {
     "arbitrumSepolia": "https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY"
   }
   ```

3. **Test deployment:**
   ```bash
   npx hardhat run deploy/deployIndexToken.ts --network arbitrumSepolia
   ```

## Next Steps

After setting up your environment:

1. ✅ Deploy IndexToken
2. ✅ Deploy IndexPriceFeed
3. ✅ Register oracle in DataStore
4. ✅ Create index market
5. ✅ Seed liquidity

See individual phase documentation for detailed steps.

