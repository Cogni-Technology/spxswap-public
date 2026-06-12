# Workflows

Four GitHub Actions workflows power CI/CD for this monorepo.

## Topology

| Workflow | Trigger | Environment | Touches |
|---|---|---|---|
| [`ci.yml`](./ci.yml) | `pull_request` → `dev` or `main` | — | Read-only: typecheck, lint, Vitest, `forge test`, `forge fmt`, Slither, gas snapshot, ABI drift, `forge build --sizes` (24 KB ceiling) |
| [`deploy-testnet.yml`](./deploy-testnet.yml) | `push` to `dev` + `workflow_dispatch` | `testnet` | Path-filtered: Sepolia contract deploys (`MockSPX`, `NoopHook`), commits updated `deployments/sepolia.json` back to `dev`, pins frontend to Pinata |
| [`deploy-main.yml`](./deploy-main.yml) | `push` to `main` + `workflow_dispatch` | `production-frontend` | Production web bundle; pins to Pinata (primary) + web3.storage (secondary, fail-soft, skipped if unconfigured); cuts GitHub Release |
| [`deploy-contracts-mainnet.yml`](./deploy-contracts-mainnet.yml) | `workflow_dispatch` only | `mainnet-contracts` | Post-deploy bookkeeping: waits for N confirmations on a tx hash, runs `forge verify-contract` against Etherscan. **Does not sign** — a human signs offline via Ledger first. |

## CI (`ci.yml`) jobs

All jobs run in parallel; green is required to merge:

| Job | What it enforces |
|---|---|
| `ts-check` | `bun g:check:fast` (typecheck + lint + format) + `bun g:test` (Vitest) |
| `web-build` | `bunx nx build:production web` — production bundle builds cleanly |
| `contracts-fmt` | `forge fmt --check` |
| `contracts-build` | `forge build --sizes` + awk guard: no contract > 24 576 B runtime (EIP-170) |
| `contracts-test` | `forge test -vvv --no-match-path test/fork/**` with `FOUNDRY_FUZZ_RUNS=10000`. Fork tests deliberately excluded from PRs — they run on `deploy-testnet.yml` |
| `contracts-coverage` | `forge coverage --report lcov --ir-minimum` then `.github/scripts/check-coverage-threshold.sh` (≥80 % line coverage on `src/` excluding `src/mocks/**`) |
| `contracts-slither` | `crytic/slither-action@v0.3.0` with `--fail-on high`, `FOUNDRY_PROFILE=ci-analysis` (no `via_ir`), libs/tests/scripts filtered out |
| `contracts-gas-snapshot` | `forge snapshot --diff .gas-snapshot` posts (or updates) a single PR comment tagged `<!-- spxswap:gas-snapshot -->` |
| `abi-drift` | `bunx nx run @universe/contracts:abi:export --skip-nx-cache` then `git diff --exit-code packages/contracts/generated/` — fails if committed ABIs are stale |

## Secrets matrix

Each cell shows where the secret must live. `repo` = repository secret (any workflow); `env:<name>` = only readable when that job sets `environment:`.

| Secret | Used by | Placement | Status |
|---|---|---|---|
| `PINATA_JWT` | `deploy-main`, `deploy-testnet` | repo | ❌ pending |
| `MAINNET_RPC_URL` | `deploy-testnet` (fork tests), `deploy-contracts-mainnet` | repo | ❌ pending |
| `ETHERSCAN_API_KEY` | `deploy-testnet` (verify), `deploy-contracts-mainnet` | repo | ❌ pending |
| `SEPOLIA_RPC_URL` | `deploy-testnet` | `env:testnet` | ❌ pending |
| `SEPOLIA_DEPLOYER_PRIVATE_KEY` | `deploy-testnet` | `env:testnet` | ❌ pending |
| `DEPLOYMENTS_BOT_TOKEN` | `deploy-testnet` (bot commit of `sepolia.json`) | repo | ❌ pending |
| `WEB3_STORAGE_PRINCIPAL` | `deploy-main` (w3s secondary pin) | repo | ⏭️ optional — step skipped when absent |
| `WEB3_STORAGE_PROOF` | `deploy-main` (w3s secondary pin) | repo | ⏭️ optional — step skipped when absent |
| `GITHUB_TOKEN` | `deploy-main` (GH Release, issue fallback), `ci.yml` (gas comment) | auto | ✅ built-in |

Until each `❌ pending` row is populated, the workflow that consumes it will fail on first run. `ci.yml` depends on none of them — it runs cleanly from day one.

Cloudflare DNSLink updates were removed from the pipeline along with the rest of the Cloudflare integration — deploys are addressed by CID via IPFS gateways only.

## Bot identity for `sepolia.json` writes

`deploy-testnet.yml` writes to `dev` using a fine-grained PAT stored as `DEPLOYMENTS_BOT_TOKEN`. The PAT needs:
- Repository access: `Cogni-Technology/spxswap-public` only
- Permissions: `Contents: Read and write`
- Expiration: 90 days (rotate on calendar)

Commit messages include `[skip ci]` so the bot's push doesn't re-trigger `deploy-testnet.yml`. Branch protection (when eventually enabled on `dev`) must exempt the bot identity via the ruleset's bypass list.

## Repo policies to configure (now available — repo is public)

These were deferred while the repo was private on GitHub Free; now that it's public they can be enabled in repo settings:

- Branch protection rules (required checks, required approvals, linear history) on `main` and `dev`
- Environment protection rules (required reviewers, wait timers) on `mainnet-contracts`, `production-frontend`, and `testnet`
- Environment-branch restrictions (so the testnet deployer secret only unlocks from `dev`-based workflows)

The workflow files already reference `environment:` values, so the existing jobs honor these policies as soon as they're configured — no YAML changes needed.

## Manual operations

### Trigger the mainnet verification workflow
```bash
gh workflow run deploy-contracts-mainnet.yml \
  -f tx_hash=0x... \
  -f confirm_deploy=DEPLOY-MAINNET \
  -f min_confirmations=12
```

### Re-run a testnet deploy without a code push
```bash
gh workflow run deploy-testnet.yml --ref dev
```

### Regenerate + check-in a new `.gas-snapshot` baseline
```bash
cd packages/contracts && forge snapshot
git add .gas-snapshot && git commit -m "chore(contracts): refresh gas snapshot baseline"
```
