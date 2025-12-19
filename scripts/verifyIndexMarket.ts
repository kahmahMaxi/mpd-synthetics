/**
 * @title Verify Index Market
 * @notice Verifies the DFI/USDC index market exists and is properly configured
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getMarketKey, getOnchainMarkets } from "../utils/market";
import { DEFAULT_MARKET_TYPE } from "../utils/market";
import { hashData, hashString } from "../utils/hash";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" VERIFY INDEX MARKET");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const { get, read } = hre.deployments;

  // Load contracts
  const dataStore = await get("DataStore");
  const indexToken = await get("IndexToken");

  // Load USDC
  const usdcConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "config", "tokens", "usdc.json"), "utf8")
  );
  const usdcAddress = usdcConfig.address;

  console.log(`IndexToken: ${indexToken.address}`);
  console.log(`USDC: ${usdcAddress}\n`);

  // Get market key
  const marketKey = getMarketKey(indexToken.address, usdcAddress, usdcAddress);
  console.log(`Market Key: ${marketKey}\n`);

  // Check if market exists using the salt hash method
  const salt = hashData(
    ["string", "address", "address", "address", "bytes32"],
    ["GMX_MARKET", indexToken.address, usdcAddress, usdcAddress, DEFAULT_MARKET_TYPE]
  );
  const marketSalt = hashString("MARKET_SALT");
  const marketSaltHash = hashData(["bytes32", "bytes32"], [marketSalt, salt]);

  const dataStoreContract = await hre.ethers.getContractAt("DataStore", dataStore.address);
  const marketTokenAddress = await dataStoreContract.getAddress(marketSaltHash);

  if (marketTokenAddress && marketTokenAddress !== hre.ethers.constants.AddressZero) {
    console.log("✅ Market found via salt hash!");
    console.log(`   Market Token (GM): ${marketTokenAddress}\n`);

    // Try to get market details using Reader if available
    try {
      const reader = await get("Reader");
      const readerContract = await hre.ethers.getContractAt("Reader", reader.address);
      const market = await readerContract.getMarket(dataStore.address, marketTokenAddress);

      console.log("✅ Market details from Reader:");
      console.log(`   Index Token: ${market.indexToken}`);
      console.log(`   Long Token: ${market.longToken}`);
      console.log(`   Short Token: ${market.shortToken}\n`);

      // Verify addresses match
      if (
        market.indexToken.toLowerCase() === indexToken.address.toLowerCase() &&
        market.longToken.toLowerCase() === usdcAddress.toLowerCase() &&
        market.shortToken.toLowerCase() === usdcAddress.toLowerCase()
      ) {
        console.log("✅ All token addresses match correctly!\n");
      } else {
        console.log("⚠️  Token address mismatch detected!\n");
      }
    } catch (readerError: any) {
      console.log(`⚠️  Could not read market details from Reader: ${readerError.message}\n`);
    }
  } else {
    console.log("❌ Market not found in DataStore");
    console.log(`   Market Key: ${marketKey}`);
    console.log(`   Salt Hash: ${marketSaltHash}\n`);
  }

  // Also try getOnchainMarkets as fallback
  try {
    const markets = await getOnchainMarkets(read, dataStore.address);
    const market = markets[marketKey];
    if (market) {
      console.log("✅ Market also found via getOnchainMarkets!");
      console.log(`   Market Token (GM): ${market.marketToken}\n`);
    }
  } catch (error: any) {
    // Ignore - we already checked via salt hash
  }

  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
