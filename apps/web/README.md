# SPXSwap Web Interface

## Accessing SPXSwap

Visit [swap.dcaeon.com](https://swap.dcaeon.com), or use an IPFS gateway link from the
[latest release](https://github.com/dcaeon-dev/spxswap/releases/latest).

## Tech Stack

- **Build**: Vite with experimental Rolldown support
- **Deployment**: Cloudflare Workers via `@cloudflare/vite-plugin`
- **Edge Functions**: Hono.js for SSR meta tags and OG image generation

## Prerequisites

- **Node.js version** - Use the version specified in `.nvmrc`. Run `nvm use` to switch.
- **Bun** - Package manager

## Running Locally

```bash
bun install
bun web dev
```

The dev server runs on port 3000 by default.

## Development Commands

| Command | Description |
|---------|-------------|
| `bun web dev` | Start development server |
| `bun web build:production` | Production build |
| `bun web preview` | Preview production build locally |
| `bun web typecheck` | Run type checking |
| `bun web test` | Run unit tests |
| `bun web e2e` | Run E2E Playwright tests with prod build |
| `bun web e2e:dev` | Run E2E Playwright tests with dev build |

## Translations

```bash
bun web i18n:download
```

Downloads translations to `./apps/web/src/i18n/locales/translations`.

## Further Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance, architecture patterns, and workflows.
