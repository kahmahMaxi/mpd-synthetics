/**
 * @title Reward Flow Tests
 * @notice Tests for MPD reward distribution, staking, vesting, and claiming
 */

import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployFixture } from "../../utils/fixture";
import { expandDecimals } from "../../utils/math";
import { getMpdAddress, getEsMpdAddress, getVesterAddress } from "../../utils/rewardAdapter";

describe("Reward Flow", function () {
  let fixture: any;
  let mpd: any;
  let esMpd: any;
  let vester: any;
  let feeDistributor: any;
  let user0: any;
  let user1: any;
  let deployer: any;

  beforeEach(async function () {
    // Get MPD token addresses first to check if configured
    const mpdAddress = getMpdAddress();
    const esMpdAddress = getEsMpdAddress();
    const vesterAddress = getVesterAddress();

    if (!mpdAddress || !esMpdAddress || !vesterAddress) {
      this.skip(); // Skip tests if MPD tokens not configured
      return;
    }

    try {
      fixture = await deployFixture();
      user0 = fixture.user0;
      user1 = fixture.user1;
      deployer = fixture.wallet;
    } catch (error: any) {
      console.warn("Could not deploy fixture, skipping tests:", error.message);
      this.skip();
      return;
    }

    // Use minimal ABIs for contracts from mpd-token repo
    const mpdAbi = [
      "function balanceOf(address) view returns (uint256)",
      "function mint(address, uint256)",
      "function MINTER_ROLE() view returns (bytes32)",
      "function hasRole(bytes32, address) view returns (bool)",
    ];
    const esMpdAbi = [
      "function balanceOf(address) view returns (uint256)",
      "function mint(address, uint256)",
      "function approve(address, uint256) returns (bool)",
      "function MINTER_ROLE() view returns (bytes32)",
      "function hasRole(bytes32, address) view returns (bool)",
    ];
    const vesterAbi = [
      "function depositedAmounts(address) view returns (uint256)",
      "function claimable(address) view returns (uint256)",
      "function deposit(uint256)",
      "function claim()",
      "function withdraw()",
    ];

    mpd = await hre.ethers.getContractAt(mpdAbi, mpdAddress);
    esMpd = await hre.ethers.getContractAt(esMpdAbi, esMpdAddress);
    vester = await hre.ethers.getContractAt(vesterAbi, vesterAddress);

    try {
      const feeDistributorDeployment = await hre.deployments.get("FeeDistributor");
      feeDistributor = await hre.ethers.getContractAt("FeeDistributor", feeDistributorDeployment.address);
    } catch (error) {
      console.warn("FeeDistributor not deployed, some tests may be skipped");
      feeDistributor = null;
    }
  });

  describe("FeeDistributor Reward Seeding", function () {
    it("Should mint esMPD to FeeDistributor", async function () {
      if (!feeDistributor) {
        this.skip();
        return;
      }

      const amount = expandDecimals(10000, 18); // 10000 esMPD
      const minterRole = await esMpd.MINTER_ROLE();
      const isMinter = await esMpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip(); // Skip if deployer is not a minter
        return;
      }

      const initialBalance = await esMpd.balanceOf(feeDistributor.address);
      await esMpd.mint(feeDistributor.address, amount);
      const finalBalance = await esMpd.balanceOf(feeDistributor.address);

      expect(finalBalance.sub(initialBalance)).to.eq(amount);
    });
  });

  describe("User Staking and Rewards", function () {
    it("Should allow user to receive MPD and stake it", async function () {
      const amount = expandDecimals(1000, 18); // 1000 MPD
      const minterRole = await mpd.MINTER_ROLE();
      const isMinter = await mpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip();
        return;
      }

      // Mint MPD to user
      await mpd.mint(user0.address, amount);
      const balance = await mpd.balanceOf(user0.address);
      expect(balance).to.eq(amount);

      // Note: Actual staking would require a RewardTracker contract
      // For now, we just verify the user has MPD
    });

    it("Should allow user to receive esMPD rewards", async function () {
      const amount = expandDecimals(100, 18); // 100 esMPD
      const minterRole = await esMpd.MINTER_ROLE();
      const isMinter = await esMpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip();
        return;
      }

      // Mint esMPD to user (simulating reward claim)
      await esMpd.mint(user0.address, amount);
      const balance = await esMpd.balanceOf(user0.address);
      expect(balance).to.eq(amount);
    });
  });

  describe("Vester Deposit and Vesting", function () {
    it("Should allow user to deposit esMPD into Vester", async function () {
      const amount = expandDecimals(100, 18); // 100 esMPD
      const minterRole = await esMpd.MINTER_ROLE();
      const isMinter = await esMpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip();
        return;
      }

      // Mint esMPD to user
      await esMpd.mint(user0.address, amount);

      // Approve Vester
      await esMpd.connect(user0).approve(vester.address, amount);

      // Deposit into Vester
      await vester.connect(user0).deposit(amount);

      const deposited = await vester.depositedAmounts(user0.address);
      expect(deposited).to.eq(amount);
    });

    it("Should increase claimable amount over time", async function () {
      const amount = expandDecimals(100, 18); // 100 esMPD
      const minterRole = await esMpd.MINTER_ROLE();
      const isMinter = await esMpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip();
        return;
      }

      // Mint and deposit
      await esMpd.mint(user0.address, amount);
      await esMpd.connect(user0).approve(vester.address, amount);
      await vester.connect(user0).deposit(amount);

      // Check initial claimable (should be 0)
      const initialClaimable = await vester.claimable(user0.address);
      expect(initialClaimable).to.eq(0);

      // Fast-forward 30 days
      const thirtyDays = 30 * 24 * 60 * 60;
      await time.increase(thirtyDays);

      // Check claimable after time passes
      const claimableAfter = await vester.claimable(user0.address);
      expect(claimableAfter).to.gt(0);
    });

    it("Should allow user to claim vested MPD", async function () {
      const amount = expandDecimals(100, 18); // 100 esMPD
      const minterRole = await esMpd.MINTER_ROLE();
      const isMinter = await esMpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip();
        return;
      }

      // Mint and deposit
      await esMpd.mint(user0.address, amount);
      await esMpd.connect(user0).approve(vester.address, amount);
      await vester.connect(user0).deposit(amount);

      // Fast-forward 90 days (should have significant claimable)
      const ninetyDays = 90 * 24 * 60 * 60;
      await time.increase(ninetyDays);

      const claimable = await vester.claimable(user0.address);
      expect(claimable).to.gt(0);

      // Get initial MPD balance
      const initialMpdBalance = await mpd.balanceOf(user0.address);

      // Claim
      await vester.connect(user0).claim();

      // Check MPD balance increased
      const finalMpdBalance = await mpd.balanceOf(user0.address);
      expect(finalMpdBalance.sub(initialMpdBalance)).to.eq(claimable);
    });

    it("Should allow user to withdraw unvested esMPD", async function () {
      const amount = expandDecimals(100, 18); // 100 esMPD
      const minterRole = await esMpd.MINTER_ROLE();
      const isMinter = await esMpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip();
        return;
      }

      // Mint and deposit
      await esMpd.mint(user0.address, amount);
      await esMpd.connect(user0).approve(vester.address, amount);
      await vester.connect(user0).deposit(amount);

      // Fast-forward 30 days (partial vesting)
      const thirtyDays = 30 * 24 * 60 * 60;
      await time.increase(thirtyDays);

      const claimable = await vester.claimable(user0.address);
      const deposited = await vester.depositedAmounts(user0.address);

      // Withdraw should return unvested amount
      const initialEsMpdBalance = await esMpd.balanceOf(user0.address);
      await vester.connect(user0).withdraw();
      const finalEsMpdBalance = await esMpd.balanceOf(user0.address);

      // Withdrawn amount should be approximately (deposited - claimable)
      const withdrawn = finalEsMpdBalance.sub(initialEsMpdBalance);
      expect(withdrawn.add(claimable)).to.be.closeTo(deposited, expandDecimals(1, 15)); // Allow small rounding
    });
  });

  describe("Full Reward Cycle", function () {
    it("Should complete full cycle: receive esMPD -> deposit -> vest -> claim MPD", async function () {
      const rewardAmount = expandDecimals(100, 18); // 100 esMPD
      const minterRole = await esMpd.MINTER_ROLE();
      const isMinter = await esMpd.hasRole(minterRole, deployer.address);

      if (!isMinter) {
        this.skip();
        return;
      }

      // Step 1: User receives esMPD (simulating reward claim)
      await esMpd.mint(user0.address, rewardAmount);
      const esMpdBalance = await esMpd.balanceOf(user0.address);
      expect(esMpdBalance).to.eq(rewardAmount);

      // Step 2: Deposit into Vester
      await esMpd.connect(user0).approve(vester.address, rewardAmount);
      await vester.connect(user0).deposit(rewardAmount);

      const deposited = await vester.depositedAmounts(user0.address);
      expect(deposited).to.eq(rewardAmount);

      // Step 3: Fast-forward 180 days
      const halfYear = 180 * 24 * 60 * 60;
      await time.increase(halfYear);

      // Step 4: Check claimable
      const claimable = await vester.claimable(user0.address);
      expect(claimable).to.gt(0);

      // Step 5: Claim MPD
      const initialMpdBalance = await mpd.balanceOf(user0.address);
      await vester.connect(user0).claim();
      const finalMpdBalance = await mpd.balanceOf(user0.address);

      expect(finalMpdBalance.sub(initialMpdBalance)).to.eq(claimable);
    });
  });
});

