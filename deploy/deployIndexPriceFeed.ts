import { HardhatRuntimeEnvironment } from "hardhat/types";
import { expandDecimals } from "../utils/math";

/**
 * @title Deploy IndexPriceFeed
 * @notice Deploys an IndexPriceFeed contract for aggregating multiple Chainlink price feeds
 * @dev For Arbitrum Sepolia, uses real Chainlink feeds. For localhost, uses MockPriceFeed addresses.
 * 
 * DeFi-5 Index Configuration:
 * - ETH: 40% weight
 * - AAVE: 20% weight
 * - CRV: 15% weight
 * - UNI: 15% weight
 * - LDO: 10% weight
 */
const func = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";

  // Chainlink price feed addresses on Arbitrum Sepolia
  // Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum-sepolia
  const ARBITRUM_SEPOLIA_FEEDS = {
    ETH_USD: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165", // ETH / USD
    BTC_USD: "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69", // BTC / USD
    // Note: AAVE, CRV, UNI, LDO feeds may not be available on Arbitrum Sepolia
    // For production, use mainnet feeds or deploy mock feeds for testing
    // updated Chainlink feed addresses
    AAVE_USD: "0x20b1061Acd37302925D9A8c3fD94eb765039dBd5", // real AAVE/USD feed
    // CRV_USD: "0x0000000000000000000000000000000000000000", // real CRV/USD feed(not available on Arbitrum Sepolia-i'll replace with-ASTR)
    ASTR_USD: "0x902ac56C78058f6DE82C0610a851017901280217", // real ASTR/USD feed
    UNI_USD: "0x850A128C3f67C3D13B58a88AC2f4742D90705c0a", // real UNI/USD feed
    // LDO_USD: "0x0000000000000000000000000000000000000000", // real LDO/USD feed(not available on Arbitrum Sepolia-i'll replace with-AVAX)
    AVAX_USD: "0xe27498c9Cc8541033F265E63c8C29A97CfF9aC6D", // real AVAX/USD feed
  };

  let feeds: string[];
  let weights: string[];
  let maxHeartbeats: string[];

  if (isLocalNetwork) {
    // For localhost, use MockPriceFeed contracts
    // Deploy mock feeds if they don't exist
    const mockFeeds = ["ETH", "AAVE", "ASTR", "UNI", "AVAX"];
    const mockPrices = [
      expandDecimals(2000, 8), // ETH: $2000
      expandDecimals(100, 8), // AAVE: $100
      expandDecimals(1, 8), // ASTR: $1
      expandDecimals(10, 8), // UNI: $10
      expandDecimals(2, 8), // AVAX: $2
    ];

    feeds = [];
    for (let i = 0; i < mockFeeds.length; i++) {
      const feedName = `${mockFeeds[i]}PriceFeed`;
      const existing = await deployments.getOrNull(feedName);
      if (!existing) {
        await deploy(feedName, {
          from: deployer,
          log: true,
          contract: "contracts/oracle/MockPriceFeed.sol:MockPriceFeed",
          args: [mockPrices[i]],
        });
      }
      const deployment = await get(feedName);
      feeds.push(deployment.address);
    }

    // Weights: ETH 40%, AAVE 20%, ASTR 15%, UNI 15%, AVAX 10%
    weights = [
      expandDecimals(40, 16).toString(), // 0.4 * 1e18 = 4e17
      expandDecimals(20, 16).toString(), // 0.2 * 1e18 = 2e17
      expandDecimals(15, 16).toString(), // 0.15 * 1e18 = 1.5e17
      expandDecimals(15, 16).toString(), // 0.15 * 1e18 = 1.5e17
      expandDecimals(10, 16).toString(), // 0.1 * 1e18 = 1e17
    ];

    // Max heartbeat: 24 hours for all feeds
    maxHeartbeats = [
      (24 * 60 * 60).toString(), // 86400 seconds
      (24 * 60 * 60).toString(),
      (24 * 60 * 60).toString(),
      (24 * 60 * 60).toString(),
      (24 * 60 * 60).toString(),
    ];
  } else if (network.name === "arbitrumSepolia") {
    // For Arbitrum Sepolia, use real Chainlink feeds
    // Note: Some feeds may not be available - use mock feeds or mainnet addresses
    feeds = [
      ARBITRUM_SEPOLIA_FEEDS.ETH_USD,
      ARBITRUM_SEPOLIA_FEEDS.AAVE_USD,
      ARBITRUM_SEPOLIA_FEEDS.ASTR_USD,
      ARBITRUM_SEPOLIA_FEEDS.UNI_USD,
      ARBITRUM_SEPOLIA_FEEDS.AVAX_USD,
    ];

    // Weights: ETH 40%, AAVE 20%, ASTR 15%, UNI 15%, AVAX 10%
    weights = [
      expandDecimals(40, 16).toString(), // 0.4 * 1e18
      expandDecimals(20, 16).toString(), // 0.2 * 1e18
      expandDecimals(15, 16).toString(), // 0.15 * 1e18
      expandDecimals(15, 16).toString(), // 0.15 * 1e18
      expandDecimals(10, 16).toString(), // 0.1 * 1e18
    ];

    // Max heartbeat: 24 hours for all feeds
    maxHeartbeats = [
      (24 * 60 * 60).toString(), // 86400 seconds
      (24 * 60 * 60).toString(),
      (24 * 60 * 60).toString(),
      (24 * 60 * 60).toString(),
      (24 * 60 * 60).toString(),
    ];
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  // Deploy IndexPriceFeed
  await deploy("IndexPriceFeed", {
    from: deployer,
    log: true,
    contract: "contracts/oracle/IndexPriceFeed.sol:IndexPriceFeed",
    args: [
      "DeFi-5 Index", // name
      "DeFi-5 Index: ETH 40%, AAVE 20%, ASTR 15%, UNI 15%, AVAX 10%", // description
      feeds,
      weights,
      maxHeartbeats,
    ],
  });
};

func.dependencies = [];
func.tags = ["IndexPriceFeed"];

export default func;

