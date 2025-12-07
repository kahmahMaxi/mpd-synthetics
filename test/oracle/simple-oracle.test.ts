/**
 * @title Simple Oracle Test
 * @notice Tests for MockPriceFeed and MockOracle contracts
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { expandDecimals } from "../../utils/math";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MockOracle", function () {
  async function deployFixture() {
    const [owner, otherAccount] = await ethers.getSigners();

    // Deploy MockPriceFeed contracts (use fully qualified name to avoid conflict)
    const MockPriceFeed = await ethers.getContractFactory("contracts/oracle/MockPriceFeed.sol:MockPriceFeed");
    const wethPriceFeed = await MockPriceFeed.deploy(expandDecimals(2000, 8)); // $2000
    const wbtcPriceFeed = await MockPriceFeed.deploy(expandDecimals(90000, 8)); // $90000
    const solPriceFeed = await MockPriceFeed.deploy(expandDecimals(120, 8)); // $120
    const usdcPriceFeed = await MockPriceFeed.deploy(expandDecimals(1, 8)); // $1

    // Deploy MockOracle
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const mockOracle = await MockOracle.deploy();

    // Deploy mock tokens for testing
    const MintableToken = await ethers.getContractFactory("MintableToken");
    const weth = await MintableToken.deploy("WETH", "WETH", 18);
    const wbtc = await MintableToken.deploy("WBTC", "WBTC", 8);
    const sol = await MintableToken.deploy("SOL", "SOL", 18);
    const usdc = await MintableToken.deploy("USDC", "USDC", 6);

    return {
      owner,
      otherAccount,
      wethPriceFeed,
      wbtcPriceFeed,
      solPriceFeed,
      usdcPriceFeed,
      mockOracle,
      weth,
      wbtc,
      sol,
      usdc,
    };
  }

  describe("MockPriceFeed", function () {
    it("Should deploy with initial price", async function () {
      const { wethPriceFeed } = await loadFixture(deployFixture);
      expect(await wethPriceFeed.price()).to.equal(expandDecimals(2000, 8));
      expect(await wethPriceFeed.decimals()).to.equal(8);
    });

    it("Should allow owner to set price", async function () {
      const { owner, wethPriceFeed } = await loadFixture(deployFixture);
      const newPrice = expandDecimals(2500, 8);

      await expect(wethPriceFeed.connect(owner).setPrice(newPrice))
        .to.emit(wethPriceFeed, "PriceUpdated")
        .withArgs(expandDecimals(2000, 8), newPrice);

      expect(await wethPriceFeed.price()).to.equal(newPrice);
    });

    it("Should not allow non-owner to set price", async function () {
      const { otherAccount, wethPriceFeed } = await loadFixture(deployFixture);
      const newPrice = expandDecimals(2500, 8);

      await expect(wethPriceFeed.connect(otherAccount).setPrice(newPrice)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should return latestRoundData correctly", async function () {
      const { wethPriceFeed } = await loadFixture(deployFixture);
      const price = expandDecimals(2000, 8);

      const [roundId, answer, startedAt, updatedAt, answeredInRound] = await wethPriceFeed.latestRoundData();

      expect(roundId).to.equal(1);
      expect(answer).to.equal(price);
      expect(startedAt).to.be.gt(0);
      expect(updatedAt).to.be.gt(0);
      expect(answeredInRound).to.equal(1);
    });

    it("Should return latestAnswer correctly", async function () {
      const { wethPriceFeed } = await loadFixture(deployFixture);
      const price = expandDecimals(2000, 8);

      expect(await wethPriceFeed.latestAnswer()).to.equal(price);
    });
  });

  describe("MockOracle", function () {
    it("Should register price feeds", async function () {
      const { owner, mockOracle, weth, wethPriceFeed } = await loadFixture(deployFixture);

      await expect(mockOracle.connect(owner).registerPriceFeed(weth.address, wethPriceFeed.address))
        .to.emit(mockOracle, "PriceFeedRegistered")
        .withArgs(weth.address, wethPriceFeed.address);

      expect(await mockOracle.getPriceFeed(weth.address)).to.equal(wethPriceFeed.address);
      expect(await mockOracle.hasPriceFeed(weth.address)).to.be.true;
    });

    it("Should get price from registered feed", async function () {
      const { owner, mockOracle, weth, wethPriceFeed } = await loadFixture(deployFixture);

      await mockOracle.connect(owner).registerPriceFeed(weth.address, wethPriceFeed.address);

      const price = await mockOracle.getPrice(weth.address);
      expect(price).to.equal(expandDecimals(2000, 8));
    });

    it("Should return 0 for unregistered token", async function () {
      const { mockOracle, weth } = await loadFixture(deployFixture);

      expect(await mockOracle.getPrice(weth.address)).to.equal(0);
      expect(await mockOracle.hasPriceFeed(weth.address)).to.be.false;
    });

    it("Should not allow non-owner to register feeds", async function () {
      const { otherAccount, mockOracle, weth, wethPriceFeed } = await loadFixture(deployFixture);

      await expect(
        mockOracle.connect(otherAccount).registerPriceFeed(weth.address, wethPriceFeed.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should remove price feeds", async function () {
      const { owner, mockOracle, weth, wethPriceFeed } = await loadFixture(deployFixture);

      await mockOracle.connect(owner).registerPriceFeed(weth.address, wethPriceFeed.address);
      expect(await mockOracle.hasPriceFeed(weth.address)).to.be.true;

      await expect(mockOracle.connect(owner).removePriceFeed(weth.address))
        .to.emit(mockOracle, "PriceFeedRemoved")
        .withArgs(weth.address);

      expect(await mockOracle.hasPriceFeed(weth.address)).to.be.false;
      expect(await mockOracle.getPrice(weth.address)).to.equal(0);
    });

    it("Should handle multiple price feeds", async function () {
      const { owner, mockOracle, weth, wbtc, sol, usdc, wethPriceFeed, wbtcPriceFeed, solPriceFeed, usdcPriceFeed } =
        await loadFixture(deployFixture);

      await mockOracle.connect(owner).registerPriceFeed(weth.address, wethPriceFeed.address);
      await mockOracle.connect(owner).registerPriceFeed(wbtc.address, wbtcPriceFeed.address);
      await mockOracle.connect(owner).registerPriceFeed(sol.address, solPriceFeed.address);
      await mockOracle.connect(owner).registerPriceFeed(usdc.address, usdcPriceFeed.address);

      expect(await mockOracle.getPrice(weth.address)).to.equal(expandDecimals(2000, 8));
      expect(await mockOracle.getPrice(wbtc.address)).to.equal(expandDecimals(90000, 8));
      expect(await mockOracle.getPrice(sol.address)).to.equal(expandDecimals(120, 8));
      expect(await mockOracle.getPrice(usdc.address)).to.equal(expandDecimals(1, 8));
    });

    it("Should update price when feed price changes", async function () {
      const { owner, mockOracle, weth, wethPriceFeed } = await loadFixture(deployFixture);

      await mockOracle.connect(owner).registerPriceFeed(weth.address, wethPriceFeed.address);
      expect(await mockOracle.getPrice(weth.address)).to.equal(expandDecimals(2000, 8));

      // Update price in feed
      const newPrice = expandDecimals(2500, 8);
      await wethPriceFeed.connect(owner).setPrice(newPrice);

      // Oracle should return updated price
      expect(await mockOracle.getPrice(weth.address)).to.equal(newPrice);
    });
  });
});

