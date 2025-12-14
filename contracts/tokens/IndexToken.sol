// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IndexToken
 * @notice ERC20 token representing an index (e.g., DeFi Index) for use in GMX V2 index perpetual markets
 * @dev This token represents the index asset itself, separate from governance (MPD) and liquidity (GM) tokens.
 *      Used as the indexToken in GMX markets, with price determined by IndexPriceFeed oracle.
 * 
 * Features:
 * - Standard ERC20 functionality
 * - Owner-controlled minting and burning
 * - No transfer restrictions
 * - Production-safe implementation
 */
contract IndexToken is ERC20, Ownable {
    uint8 private constant _DECIMALS = 18;

    /**
     * @notice Emitted when new tokens are minted
     * @param to The address receiving the minted tokens
     * @param amount The amount of tokens minted
     */
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @notice Emitted when tokens are burned
     * @param from The address tokens are burned from
     * @param amount The amount of tokens burned
     */
    event TokensBurned(address indexed from, uint256 amount);

    /**
     * @notice Initializes the IndexToken contract
     * @param name_ Token name (e.g., "DeFi Index")
     * @param symbol_ Token symbol (e.g., "DFI")
     * @param initialOwner The address that will own this contract and control minting/burning
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable() {
        // Transfer ownership to initialOwner
        _transferOwnership(initialOwner);
        // No initial minting - tokens are minted separately after deployment
    }

    /**
     * @notice Returns the number of decimals for the token
     * @return The number of decimals (always 18)
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @notice Mints new tokens to a specified address
     * @dev Only callable by the contract owner
     * @param to The address to receive the minted tokens
     * @param amount The amount of tokens to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "IndexToken: mint to zero address");
        require(amount > 0, "IndexToken: mint amount must be greater than zero");

        _mint(to, amount);

        emit TokensMinted(to, amount);
    }

    /**
     * @notice Burns tokens from a specified address
     * @dev Only callable by the contract owner
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn (in wei, 18 decimals)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "IndexToken: burn from zero address");
        require(amount > 0, "IndexToken: burn amount must be greater than zero");
        require(balanceOf(from) >= amount, "IndexToken: burn amount exceeds balance");

        _burn(from, amount);

        emit TokensBurned(from, amount);
    }
}

