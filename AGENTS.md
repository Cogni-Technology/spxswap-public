# AGENTS.md

This file provides guidance to AI agents when working with code in this repository. Always run all tests, lint, and typecheck after making changes, and before considering a task to be 'complete'.

## Project Overview

SPXSwap is a monorepo containing a decentralized exchange web interface, forked from Uniswap.

- **Web** (`apps/web/`) - The web application

## Common Development Commands

### Setup

```bash
bun install
bun local:check
bun lfg  # Build all packages
```

### Development

```bash
bun web dev              # Web dev server (Vite)
```

### Building

```bash
bun g:build                    # Build all packages
bun web build:production       # Web production build
```

### Testing

```bash
bun g:test                     # Run all tests
bun g:test:changed             # Run tests for changed packages
bun web playwright:test        # Web E2E tests
```

### Code Quality

```bash
bun g:lint:fix                 # Fix linting issues
bun g:typecheck                # Type check all packages
bun g:format                   # Fix formatting
bun i18n:extract               # Extract localized strings (run after changing translations)
```

## Architecture Overview

### Monorepo Structure

- **NX** for build orchestration
- **Bun workspaces** for package management
- Shared code in `packages/` directory
- App-specific code in `apps/` directory

### Key Technologies

- **TypeScript** everywhere
- **React** for the web app
- **Redux Toolkit** for state management
- **Tamagui** for UI components
- **Ethers.js/Viem** for blockchain interactions

### Code Organization Principles

#### Styling

- **ALWAYS** use `styled` from `ui/src` (never styled-components or direct Tamagui); UI components may use inline styling where appropriate
- Use theme tokens instead of hardcoded values

#### State Management

- **Redux** for complex global state
- **Zustand** for simple global/shared state — do not use Jotai
- Keep state as local as possible
- No custom hooks for simple data fetching - use `useQuery`/`useMutation` directly

#### Component Structure

1. State declarations at top
2. Event handlers after state
3. Memoize properly
4. JSX at the end
5. Keep components under 250 lines

#### TypeScript Conventions

- Do not use `any`, prefer `unknown`
- Always consider strict mode
- Use explicit return types
- PascalCase for types/interfaces
- camelCase for variables/functions
- String enums with initializers

## Testing + Formatting Guidelines

- Test behaviors, not implementations
- Always update existing unit tests related to changes made
- Run tests before considering a task to be 'complete'
- Also run linting and typecheck before considering a task to be 'complete'
- Run `bun i18n:extract` after making changes to localized strings (e.g., using translation hooks like `useTranslation`)

## Critical Development Notes

1. **Pre-commit Hooks**: Use `--no-verify` to skip or set `export LEFTHOOK=0` to disable
2. **Bundle Size**: Monitor bundle size impacts when adding dependencies

## Package Dependencies

Core shared packages:

- `packages/ui/` - UI components and theme
- `packages/uniswap/` - Core business logic and utilities
- `packages/utilities/` - Common utilities

## Blockchain Integration

- Support for multiple chains (Ethereum, Arbitrum, Optimism, etc.)
- Uniswap Protocol v2, v3, v4, and UniswapX support
- Multiple wallet providers (WalletConnect, Metamask, etc.)
- Transaction building and gas estimation

## Other Considerations

Be cognizant of the package within which a given change is being made. Be sure to reference that package's `AGENTS.md` file and other local configuration files, including (but not limited to): `package.json`, `tsconfig.json`, etc.


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors


<!-- nx configuration end-->