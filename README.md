# SPXSwap

Censorship-resistant swap interface for [SPX6900](https://spx6900.com) on Ethereum mainnet. Forked from [Uniswap Interface](https://github.com/Uniswap/interface) (`web/5.141.3`) and deployed to IPFS.

Developed by the [dcaeon.com](https://dcaeon.com) team. Also available at [swap.dcaeon.com](https://swap.dcaeon.com).

## What is this?

A standalone, SPX-branded frontend for swapping tokens via Uniswap V3 liquidity pools. It strips the Uniswap interface down to a single-purpose swap screen with cypherpunk aesthetics — gold-on-dark theming, JetBrains Mono numerals, scanline overlays, and corner bracket framing.

**Scope:** Ethereum mainnet only. Swap only — no limit orders, no send, no buy/sell fiat on-ramp. Connect any EVM wallet via wagmi/RainbowKit.

## Stack

- **Framework:** React 18 + TypeScript + Vite
- **Monorepo:** Bun workspaces + Nx
- **Chain interaction:** wagmi 2 + viem 2 + Uniswap SDK (V3/V4)
- **Styling:** Tamagui (`ui` package) + vanilla CSS for the swap chrome
- **Deployment:** Static build → IPFS (Pinata pin + DNSLink)

## Getting Started

```bash
git clone git@github.com:dcaeon-dev/spxswap.git
cd spxswap
bun install
bun lfg        # codegen + prepare steps
bun web start  # dev server at localhost:3000
```

Requires Node 22.13.1+ and Bun 1.3.11+.

## Directory Structure

| Folder      | Contents                                                                      |
| ----------- | ----------------------------------------------------------------------------- |
| `apps/web/` | The SPXSwap web application (the only app target for this fork).              |
| `config/`   | Shared infrastructure packages and configurations (tsconfig, eslint, vitest). |
| `packages/` | Shared code — UI components, swap logic, utilities, API clients.              |

## License

GPL-3.0-or-later (inherited from upstream Uniswap Interface).
