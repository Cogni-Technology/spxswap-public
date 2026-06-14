import { ALL_EVM_CHAIN_IDS, getChainInfo } from 'uniswap/src/features/chains/chainInfo'
import { PUBLIC_MAINNET_RPC_URLS } from 'uniswap/src/features/chains/evm/publicRpcUrls'
import { isQuicknodeConfigured } from 'uniswap/src/features/chains/evm/rpc'
import { RPCType, UniverseChainId } from 'uniswap/src/features/chains/types'

// Reproduce the production / IPFS deployment scenario: the QuickNode endpoint
// env vars are NOT set, so the app must run entirely on public RPCs. The mock
// is hoisted above the imports above, so the chain-info modules (and mainnet's
// module-load RPC URL list) are evaluated with QuickNode unconfigured.
vi.mock('uniswap/src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('uniswap/src/config')>()
  return {
    ...actual,
    config: { ...actual.config, quicknodeEndpointName: '', quicknodeEndpointToken: '' },
  }
})

const HTTP_URL_RE = /^https?:\/\/.+/

describe('chain RPC URL invariants (QuickNode unconfigured)', () => {
  it('reports QuickNode as not configured', () => {
    expect(isQuicknodeConfigured()).toBe(false)
  })

  // Regression guard for the app-load crash: an empty or schemeless URL here
  // throws "Endpoint URL must start with `http:` or `https:`" inside the eager
  // RPC_PROVIDERS construction (apps/web/src/constants/providers.ts), which
  // crashes the whole bundle on load (blank page).
  it('every chain exposes only non-empty http(s) RPC URLs across all tiers', () => {
    for (const chainId of ALL_EVM_CHAIN_IDS) {
      const { rpcUrls } = getChainInfo(chainId)
      for (const [tier, urlConfig] of Object.entries(rpcUrls)) {
        for (const url of urlConfig?.http ?? []) {
          expect(url, `chain ${chainId} tier ${tier} must be a valid http(s) URL`).toMatch(HTTP_URL_RE)
        }
      }
    }
  })

  // When QuickNode is absent, mainnet (the chain that actually matters for the
  // SPX6900 swap) must read balances/quotes from the verified public RPCs and
  // must NOT contain the dead `https://.quiknode.pro/` placeholder.
  it('mainnet uses the public RPCs (no dead QuickNode URL) when QuickNode is absent', () => {
    const { rpcUrls } = getChainInfo(UniverseChainId.Mainnet)
    for (const tier of [RPCType.Public, RPCType.Default, RPCType.Interface, RPCType.Fallback]) {
      const urls = rpcUrls[tier]?.http ?? []
      expect(urls.some((url) => url.includes('.quiknode.pro'))).toBe(false)
      expect(urls).toEqual(expect.arrayContaining([...PUBLIC_MAINNET_RPC_URLS]))
    }
  })
})
