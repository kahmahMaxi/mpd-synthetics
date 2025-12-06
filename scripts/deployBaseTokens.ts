/**
 * @title Deploy Base Tokens
 * @notice Deploys mock ERC20 tokens for base assets (USDC, WETH, WBTC, SOL) and updates JSON configs
 * @dev Run with: npx hardhat run scripts/deployBaseTokens.ts --network localhost
 */

import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
import { expandDecimals } from "../utils/math";

interface TokenConfig {
  symbol: string;
  decimals: number;
  address: string;
  oracleId: string;
  priceFeedMultiplier: string;
  priceFeedDecimals: number;
  tokenType: "stable" | "volatile";
  isCollateralToken: boolean;
  isSwapToken: boolean;
}

const TOKENS_DIR = path.resolve(__dirname, "..", "config", "tokens");
const TOKEN_FILES = ["usdc.json", "weth.json", "wbtc.json", "sol.json"];

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" DEPLOY BASE TOKENS");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name}\n`);

  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deployer: ${deployer}\n`);

  const results: Array<{
    symbol: string;
    address: string;
    decimals: number;
    oracleId: string;
    tokenType: string;
    status: string;
  }> = [];

  // Deploy each token
  for (const tokenFile of TOKEN_FILES) {
    const tokenPath = path.join(TOKENS_DIR, tokenFile);
    
    if (!fs.existsSync(tokenPath)) {
      console.error(`❌ Config file not found: ${tokenPath}`);
      continue;
    }

    const config: TokenConfig = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    const symbol = config.symbol;

    console.log(`📦 Deploying ${symbol}...`);

    try {
      let address: string;
      let newlyDeployed: boolean;

      if (symbol === "WETH") {
        // WETH uses WNT (Wrapped Native Token) contract
        const deployment = await deploy(symbol, {
          from: deployer,
          log: true,
          contract: "WNT",
          args: [],
        });
        address = deployment.address;
        newlyDeployed = deployment.newlyDeployed;
      } else {
        // Other tokens use MintableToken
        const deployment = await deploy(symbol, {
          from: deployer,
          log: true,
          contract: "MintableToken",
          args: [symbol, symbol, config.decimals],
        });
        address = deployment.address;
        newlyDeployed = deployment.newlyDeployed;

        // Mint tokens to deployer if newly deployed
        if (newlyDeployed) {
          const tokenContract = await hre.ethers.getContractAt("MintableToken", address);
          const mintAmount = expandDecimals(1000000000, config.decimals);
          console.log(`   Minting ${mintAmount.toString()} ${symbol} to deployer...`);
          await tokenContract.mint(deployer, mintAmount);
          console.log(`   ✅ Minted successfully`);
        }
      }

      // Update config with deployed address
      config.address = address;
      fs.writeFileSync(tokenPath, JSON.stringify(config, null, 2));

      results.push({
        symbol,
        address,
        decimals: config.decimals,
        oracleId: config.oracleId,
        tokenType: config.tokenType,
        status: newlyDeployed ? "✅ Deployed" : "♻️  Reused",
      });

      console.log(`   ✅ ${symbol} at ${address}\n`);
    } catch (error) {
      console.error(`   ❌ Failed to deploy ${symbol}:`, error);
      results.push({
        symbol,
        address: "FAILED",
        decimals: config.decimals,
        oracleId: config.oracleId,
        tokenType: config.tokenType,
        status: "❌ Failed",
      });
    }
  }

  // Print summary table
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(" DEPLOYMENT SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(
    "┌────────┬──────────────────────────────────────────┬─────────┬───────────┬────────────┐"
  );
  console.log(
    "│ Symbol │ Address                                  │ Decimals│ Oracle ID │ Token Type │"
  );
  console.log(
    "├────────┼──────────────────────────────────────────┼─────────┼───────────┼────────────┤"
  );

  for (const result of results) {
    const addressDisplay = result.address.length > 42 
      ? result.address 
      : result.address.slice(0, 10) + "..." + result.address.slice(-8);
    console.log(
      `│ ${result.symbol.padEnd(6)} │ ${addressDisplay.padEnd(40)} │ ${result.decimals.toString().padEnd(7)} │ ${result.oracleId.padEnd(9)} │ ${result.tokenType.padEnd(10)} │`
    );
  }

  console.log(
    "└────────┴──────────────────────────────────────────┴─────────┴───────────┴────────────┘"
  );

  console.log("\n📝 Config files updated:");
  for (const tokenFile of TOKEN_FILES) {
    console.log(`   ✅ config/tokens/${tokenFile}`);
  }

  console.log("\n✅ Deployment complete!");
  console.log("══════════════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

