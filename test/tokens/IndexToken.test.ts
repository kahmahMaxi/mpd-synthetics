/**
 * @title IndexToken Tests
 * @notice Comprehensive tests for IndexToken contract
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expandDecimals } from "../../utils/math";

describe("IndexToken", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const IndexToken = await ethers.getContractFactory("IndexToken");
    const indexToken = await IndexToken.deploy("DeFi Index", "DFI", owner.address);

    return {
      indexToken,
      owner,
      user1,
      user2,
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { indexToken } = await loadFixture(deployFixture);

      expect(await indexToken.name()).to.equal("DeFi Index");
      expect(await indexToken.symbol()).to.equal("DFI");
    });

    it("Should have 18 decimals", async function () {
      const { indexToken } = await loadFixture(deployFixture);

      expect(await indexToken.decimals()).to.equal(18);
    });

    it("Should set owner correctly", async function () {
      const { indexToken, owner } = await loadFixture(deployFixture);

      expect(await indexToken.owner()).to.equal(owner.address);
    });

    it("Should have zero initial supply", async function () {
      const { indexToken } = await loadFixture(deployFixture);

      expect(await indexToken.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);

      await expect(indexToken.connect(owner).mint(user1.address, amount))
        .to.emit(indexToken, "TokensMinted")
        .withArgs(user1.address, amount);

      expect(await indexToken.balanceOf(user1.address)).to.equal(amount);
      expect(await indexToken.totalSupply()).to.equal(amount);
    });

    it("Should not allow non-owner to mint", async function () {
      const { indexToken, user1, user2 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);

      await expect(indexToken.connect(user1).mint(user2.address, amount)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should revert when minting to zero address", async function () {
      const { indexToken, owner } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);

      await expect(indexToken.connect(owner).mint(ethers.constants.AddressZero, amount)).to.be.revertedWith(
        "IndexToken: mint to zero address"
      );
    });

    it("Should revert when minting zero amount", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      await expect(indexToken.connect(owner).mint(user1.address, 0)).to.be.revertedWith(
        "IndexToken: mint amount must be greater than zero"
      );
    });

    it("Should update total supply correctly on multiple mints", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      const amount1 = expandDecimals(1000, 18);
      const amount2 = expandDecimals(500, 18);

      await indexToken.connect(owner).mint(user1.address, amount1);
      await indexToken.connect(owner).mint(user1.address, amount2);

      expect(await indexToken.balanceOf(user1.address)).to.equal(amount1.add(amount2));
      expect(await indexToken.totalSupply()).to.equal(amount1.add(amount2));
    });
  });

  describe("Burning", function () {
    it("Should allow owner to burn tokens", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      const mintAmount = expandDecimals(1000, 18);
      const burnAmount = expandDecimals(300, 18);

      // First mint tokens
      await indexToken.connect(owner).mint(user1.address, mintAmount);

      // Then burn some
      await expect(indexToken.connect(owner).burn(user1.address, burnAmount))
        .to.emit(indexToken, "TokensBurned")
        .withArgs(user1.address, burnAmount);

      expect(await indexToken.balanceOf(user1.address)).to.equal(mintAmount.sub(burnAmount));
      expect(await indexToken.totalSupply()).to.equal(mintAmount.sub(burnAmount));
    });

    it("Should not allow non-owner to burn", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);
      await indexToken.connect(owner).mint(user1.address, amount);

      await expect(indexToken.connect(user1).burn(user1.address, amount)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should revert when burning from zero address", async function () {
      const { indexToken, owner } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);

      await expect(indexToken.connect(owner).burn(ethers.constants.AddressZero, amount)).to.be.revertedWith(
        "IndexToken: burn from zero address"
      );
    });

    it("Should revert when burning zero amount", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);
      await indexToken.connect(owner).mint(user1.address, amount);

      await expect(indexToken.connect(owner).burn(user1.address, 0)).to.be.revertedWith(
        "IndexToken: burn amount must be greater than zero"
      );
    });

    it("Should revert when burning more than balance", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      const mintAmount = expandDecimals(1000, 18);
      const burnAmount = expandDecimals(1500, 18);

      await indexToken.connect(owner).mint(user1.address, mintAmount);

      await expect(indexToken.connect(owner).burn(user1.address, burnAmount)).to.be.revertedWith(
        "IndexToken: burn amount exceeds balance"
      );
    });
  });

  describe("ERC20 Transfers", function () {
    it("Should allow standard ERC20 transfers", async function () {
      const { indexToken, owner, user1, user2 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);
      await indexToken.connect(owner).mint(user1.address, amount);

      await expect(indexToken.connect(user1).transfer(user2.address, amount))
        .to.emit(indexToken, "Transfer")
        .withArgs(user1.address, user2.address, amount);

      expect(await indexToken.balanceOf(user1.address)).to.equal(0);
      expect(await indexToken.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should allow transferFrom with approval", async function () {
      const { indexToken, owner, user1, user2 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);
      await indexToken.connect(owner).mint(user1.address, amount);

      await indexToken.connect(user1).approve(user2.address, amount);

      await expect(indexToken.connect(user2).transferFrom(user1.address, user2.address, amount))
        .to.emit(indexToken, "Transfer")
        .withArgs(user1.address, user2.address, amount);

      expect(await indexToken.balanceOf(user1.address)).to.equal(0);
      expect(await indexToken.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should have no transfer restrictions", async function () {
      const { indexToken, owner, user1, user2 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);
      await indexToken.connect(owner).mint(user1.address, amount);

      // Transfer should work without any restrictions
      await indexToken.connect(user1).transfer(user2.address, amount);
      expect(await indexToken.balanceOf(user2.address)).to.equal(amount);
    });
  });

  describe("Metadata", function () {
    it("Should return correct name", async function () {
      const { indexToken } = await loadFixture(deployFixture);
      expect(await indexToken.name()).to.equal("DeFi Index");
    });

    it("Should return correct symbol", async function () {
      const { indexToken } = await loadFixture(deployFixture);
      expect(await indexToken.symbol()).to.equal("DFI");
    });

    it("Should return correct decimals", async function () {
      const { indexToken } = await loadFixture(deployFixture);
      expect(await indexToken.decimals()).to.equal(18);
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      await indexToken.connect(owner).transferOwnership(user1.address);
      expect(await indexToken.owner()).to.equal(user1.address);
    });

    it("Should allow new owner to mint after ownership transfer", async function () {
      const { indexToken, owner, user1, user2 } = await loadFixture(deployFixture);

      await indexToken.connect(owner).transferOwnership(user1.address);

      const amount = expandDecimals(1000, 18);
      await expect(indexToken.connect(user1).mint(user2.address, amount))
        .to.emit(indexToken, "TokensMinted")
        .withArgs(user2.address, amount);
    });

    it("Should not allow old owner to mint after ownership transfer", async function () {
      const { indexToken, owner, user1, user2 } = await loadFixture(deployFixture);

      await indexToken.connect(owner).transferOwnership(user1.address);

      const amount = expandDecimals(1000, 18);
      await expect(indexToken.connect(owner).mint(user2.address, amount)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Integration Readiness", function () {
    it("Should be compatible with ERC20 standard", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      // Check all standard ERC20 functions exist
      expect(await indexToken.totalSupply()).to.be.a("bigint");
      expect(await indexToken.balanceOf(user1.address)).to.be.a("bigint");
      expect(await indexToken.name()).to.be.a("string");
      expect(await indexToken.symbol()).to.be.a("string");
      expect(await indexToken.decimals()).to.be.a("number");

      // Test transfer
      const amount = expandDecimals(1000, 18);
      await indexToken.connect(owner).mint(user1.address, amount);
      await indexToken.connect(user1).transfer(owner.address, amount);

      // Test approval
      await indexToken.connect(owner).approve(user1.address, amount);
      expect(await indexToken.allowance(owner.address, user1.address)).to.equal(amount);
    });

    it("Should work with standard ERC20 interfaces", async function () {
      const { indexToken, owner, user1 } = await loadFixture(deployFixture);

      const amount = expandDecimals(1000, 18);
      await indexToken.connect(owner).mint(user1.address, amount);

      // Test IERC20 interface compatibility
      const erc20Interface = new ethers.utils.Interface([
        "function totalSupply() external view returns (uint256)",
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
      ]);

      // Should not revert when calling standard functions
      expect(await indexToken.totalSupply()).to.equal(amount);
      expect(await indexToken.balanceOf(user1.address)).to.equal(amount);
    });
  });
});

