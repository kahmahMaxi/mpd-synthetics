# MPD Synthetics (V2)

> **⚠️ This is a fork of [GMX Synthetics](https://github.com/gmx-io/gmx-synthetics)**

## About This Fork

This repository is a fork of GMX V2 (Synthetics) contracts, modified to power **MPD DEX** a decentralized perpetual exchange with its own native token, isolated liquidity pools, and advanced trading features.

### What is MPD DEX?

MPD DEX is a decentralized exchange built on the proven GMX V2 architecture, featuring:
- **Perpetual Trading**: Trade crypto assets with up to 100x leverage
- **Spot Trading**: Swap tokens with minimal price impact
- **Isolated Liquidity Pools**: Risk-isolated GM pools for each trading pair
- **GLV Vaults**: Yield-optimizing vaults across multiple markets

### Modifications Overview

The following modifications will be made to adapt GMX Synthetics for MPD DEX:

| Component | Original (GMX) | Modified (MPD) |
|-----------|----------------|----------------|
| Governance Token | GMX | MPD (TBD) |
| Market Tokens | GM | MPD-GM (TBD) |
| Vault Tokens | GLV | MPD-GLV (TBD) |
| Fee Distribution | ETH/AVAX | Custom configuration |
| Oracle Configuration | GMX price feeds | MPD configured feeds |
| Keeper Network | GMX keepers | MPD keeper infrastructure |
| Branding | GMX | MPD DEX |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MPD DEX V2 (Synthetics)                 │
├─────────────────────────────────────────────────────────────┤
│  TOKENS                                                     │
│  ├── MPD Token (Governance & Fee Sharing)                   │
│  ├── Market Tokens (Per-pool LP tokens)                     │
│  ├── GLV Tokens (Multi-market vault shares)                 │
│  └── esMPD (Escrowed rewards)                               │
├─────────────────────────────────────────────────────────────┤
│  EXCHANGE CONTRACTS                                         │
│  ├── Router (Token spending approval)                       │
│  ├── ExchangeRouter (Deposits, withdrawals, orders)         │
│  ├── GlvRouter (GLV vault operations)                       │
│  ├── DepositHandler (Execute deposits)                      │
│  ├── WithdrawalHandler (Execute withdrawals)                │
│  └── OrderHandler (Execute trades)                          │
├─────────────────────────────────────────────────────────────┤
│  CORE INFRASTRUCTURE                                        │
│  ├── DataStore (On-chain state database)                    │
│  ├── RoleStore (Access control)                             │
│  ├── Oracle (Price feeds from Chainlink)                    │
│  ├── MarketFactory (Create new markets)                     │
│  └── Bank Contracts (Fund custody)                          │
├─────────────────────────────────────────────────────────────┤
│  OFF-CHAIN COMPONENTS                                       │
│  ├── Oracle Keepers (Sign & publish prices)                 │
│  ├── Order Keepers (Execute pending orders)                 │
│  └── Archive Nodes (Store oracle signatures)                │
└─────────────────────────────────────────────────────────────┘
```

### Development Goals

1. **Token Deployment**: Create and deploy MPD governance token
2. **Market Configuration**: Define supported trading pairs and markets
3. **Oracle Setup**: Configure Chainlink data feeds for all assets
4. **Keeper Infrastructure**: Build and deploy keeper network
5. **Fee Configuration**: Set up trading fees, funding rates, borrowing rates
6. **GLV Configuration**: Create yield-optimizing vault strategies
7. **Security**: Comprehensive testing and audit preparation

---

## GMX V2 Technical Overview

This section provides a technical description of the inherited GMX Synthetics architecture.

### Markets

Markets support both spot and perp trading. They are created by specifying:
- **Long collateral token** (backs long positions)
- **Short collateral token** (backs short positions)
- **Index token** (the asset being traded)

Examples:
- ETH/USD market: long=ETH, short=USDC, index=ETH
- BTC/USD market: long=WBTC, short=USDC, index=BTC
- SOL/USD market: long=ETH, short=USDC, index=SOL

### Asynchronous Execution Model

To prevent front-running, most actions use a two-step process:

1. **User Request**: User submits transaction (deposit/withdraw/order)
2. **Keeper Execution**: Off-chain keepers bundle oracle prices and execute

### Features

- Deposit and withdrawal of liquidity
- Spot Trading (Swaps)
- Leverage Trading (Perps, Long/Short)
- Market orders, limit orders, stop-loss, take-profit orders

### Fee Mechanics

- **Funding Fees**: Balance longs/shorts (larger side pays smaller side)
- **Borrowing Fees**: Prevent capacity abuse
- **Price Impact**: Simulate real market conditions, incentivize balance

### GLV (GMX Liquidity Vault)

A wrapper of multiple markets with the same long/short tokens. Liquidity is automatically rebalanced between underlying markets based on utilization.

---

## Commands

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

> Note: `export NODE_OPTIONS=--max_old_space_size=4096` may be needed to run tests.

### Print Code Metrics

```bash
npx ts-node metrics.ts
```

### Print Test Coverage

```bash
npx hardhat coverage
```

### Check Contract Sizes

```bash
npx hardhat measure-contract-sizes
```

### Check Contract Dependencies

```bash
npx hardhat dependencies <contract file path>
```

---

## Key Configuration Areas

When deploying MPD DEX, the following parameters need configuration:

| Parameter | Description |
|-----------|-------------|
| `positionFeeFactor` | Fee percentage for position changes |
| `swapFeeFactor` | Fee percentage for swaps |
| `fundingFactor` | Funding fee rate per second |
| `borrowingFactor` | Borrowing fee rate |
| `reserveFactor` | Max ratio of reserved tokens to pool |
| `maxPnlFactor` | Max ratio of PnL to pool value |
| `priceImpactFactor` | Price impact calculation factor |

---

## Security Considerations

> ⚠️ **Important**: This fork requires thorough security auditing before mainnet deployment.

Key areas requiring attention:
- Custom token integration points
- Oracle configuration and price feed setup
- Keeper network security
- Access control and role management
- Fee calculation modifications

---

## License

This project is forked from GMX under the original license terms. See [LICENSE](./LICENSE) for details.

## Attribution

This codebase is based on [GMX Synthetics](https://github.com/gmx-io/gmx-synthetics). All credit for the original implementation goes to the GMX team.

---

*For the complete original GMX V2 documentation including detailed technical specifications for price calculations, funding mechanics, and integration guidelines, please refer to the original GMX documentation.*
