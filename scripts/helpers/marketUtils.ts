/**
 * @title Market Utilities
 * @notice Helper functions for market and token operations
 */

import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { expandDecimals } from "../../utils/math";

const TOKENS_DIR = path.resolve(__dirname, "..", "..", "config", "tokens");
const MARKETS_DIR = path.resolve(__dirname, "..", "..", "config", "markets");

export interface TokenConfig {
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

export interface MarketConfig {
  marketTokenSymbol: string;
  marketTokenName: string;
  indexTokenSymbol: string;
  longTokenSymbol: string;
  shortTokenSymbol: string;
  reserveFactor: string;
  maxCumulativeDeltaDiff: string;
  tokenDecimals: number;
  marketTokenAddress?: string;
  oracleFeed?: string;
}

/**
 * Load token config from JSON file
 */
export function loadTokenConfig(symbol: string): TokenConfig {
  const tokenPath = path.join(TOKENS_DIR, `${symbol.toLowerCase()}.json`);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Token config not found: ${tokenPath}`);
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

/**
 * Load market config from JSON file
 */
export function loadMarketConfig(marketSymbol: string): MarketConfig {
  // Try to find market file by symbol (e.g., "WETH-USD" -> "weth-usd.json")
  const marketFile = marketSymbol.toLowerCase().replace("_", "-") + ".json";
  const marketPath = path.join(MARKETS_DIR, marketFile);
  
  if (!fs.existsSync(marketPath)) {
    throw new Error(`Market config not found: ${marketPath}`);
  }
  return JSON.parse(fs.readFileSync(marketPath, "utf8"));
}

/**
 * Get market token address from config
 */
export function getMarketAddress(marketConfig: MarketConfig): string {
  if (!marketConfig.marketTokenAddress || marketConfig.marketTokenAddress === "") {
    throw new Error(`Market ${marketConfig.marketTokenSymbol} has no deployed address`);
  }
  return marketConfig.marketTokenAddress;
}

/**
 * Get token address from config
 */
export function getTokenAddress(tokenConfig: TokenConfig): string {
  if (!tokenConfig.address || tokenConfig.address === "") {
    throw new Error(`Token ${tokenConfig.symbol} has no deployed address`);
  }
  return tokenConfig.address;
}

/**
 * Format number with specified decimals for display
 */
export function formatNumber(value: ethers.BigNumber, decimals: number): string {
  const divisor = ethers.BigNumber.from(10).pow(decimals);
  const whole = value.div(divisor);
  const fraction = value.mod(divisor);
  
  if (fraction.isZero()) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, "0");
  const trimmed = fractionStr.replace(/0+$/, "");
  return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
}

/**
 * Format USD value (30 decimals) for display
 */
export function formatUsd(value: ethers.BigNumber): string {
  return formatNumber(value, 30);
}

/**
 * Format token amount with token decimals
 */
export function formatTokenAmount(value: ethers.BigNumber, tokenDecimals: number): string {
  return formatNumber(value, tokenDecimals);
}

/**
 * Convert oracle price (8 decimals) to 30-decimal format for acceptablePrice
 * @param price8Dec Price in 8-decimal format (e.g., 2400 * 1e8)
 * @param tokenDecimals Token decimals (e.g., 18 for WETH)
 * @returns Price in 30-decimal format
 */
export function oraclePriceToAcceptablePrice(price8Dec: ethers.BigNumber, tokenDecimals: number): ethers.BigNumber {
  // Oracle price is in 8 decimals: price8Dec = price * 1e8
  // We need to convert to 30 decimals for acceptablePrice
  // acceptablePrice = price * 1e30
  // acceptablePrice = (price8Dec / 1e8) * 1e30 = price8Dec * 1e22
  
  // But actually, acceptablePrice uses 30 decimals for the price of 1 unit of token
  // If token has 18 decimals, then 1 token = 1e18 base units
  // Price of 1 base unit = price / 1e18
  // Price of 1 base unit in 30 decimals = (price / 1e18) * 1e30 = price * 1e12
  
  // For 8-decimal oracle price:
  // price8Dec = price * 1e8
  // acceptablePrice = price * 1e30 = (price8Dec / 1e8) * 1e30 = price8Dec * 1e22
  
  return price8Dec.mul(expandDecimals(1, 22));
}

/**
 * Resolve oracle price format - converts USD price to 8-decimal format
 * @param usdPrice Price in USD (e.g., 2400 for $2400)
 * @returns Price in 8-decimal format
 */
export function resolveOraclePrice(usdPrice: number): ethers.BigNumber {
  return expandDecimals(usdPrice, 8);
}

