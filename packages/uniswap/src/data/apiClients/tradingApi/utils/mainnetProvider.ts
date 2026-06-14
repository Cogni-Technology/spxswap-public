import { JsonRpcProvider } from '@ethersproject/providers'
import { config } from 'uniswap/src/config'
import { PUBLIC_MAINNET_RPC_URLS } from 'uniswap/src/features/chains/evm/publicRpcUrls'
import { logger } from 'utilities/src/logger/logger'

const MAINNET_CHAIN_ID = 1

/**
 * Public mainnet RPCs used when the primary (QuickNode) endpoint is missing
 * or failing. Shared with the Fallback tier in
 * features/chains/evm/info/mainnet.ts via the import below — publicRpcUrls.ts
 * is a zero-import leaf module, so sharing it does not create a circular
 * dependency between the chains feature and the data layer.
 */
const PUBLIC_FALLBACK_RPC_URLS = PUBLIC_MAINNET_RPC_URLS

// ethers transport-level failure codes (fetch failures, 5xx, timeouts).
// JSON-RPC application errors (e.g. eth_call reverts) are real answers from a
// healthy node and must propagate immediately rather than trigger failover.
const TRANSPORT_ERROR_CODES = new Set(['SERVER_ERROR', 'TIMEOUT', 'NETWORK_ERROR'])
// -32005: JSON-RPC "limit exceeded" — rate limiting, worth failing over for.
const RATE_LIMIT_JSON_RPC_CODE = -32005

function isTransportError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code
  if (typeof code === 'string') {
    return TRANSPORT_ERROR_CODES.has(code)
  }
  return code === RATE_LIMIT_JSON_RPC_CODE
}

/**
 * A JsonRpcProvider that retries transport-level failures against an ordered
 * list of fallback endpoints. Every ethers operation (calls, gas estimation,
 * fee history, receipts) funnels through send(), so overriding it gives
 * complete failover while staying type-compatible with JsonRpcProvider.
 */
class FailoverJsonRpcProvider extends JsonRpcProvider {
  private readonly fallbackProviders: JsonRpcProvider[]

  constructor(urls: string[]) {
    super(urls[0], MAINNET_CHAIN_ID)
    this.fallbackProviders = urls.slice(1).map((url) => new JsonRpcProvider(url, MAINNET_CHAIN_ID))
  }

  // oxlint-disable-next-line typescript/no-explicit-any -- matches the ethers send() signature
  override async send(method: string, params: Array<any>): Promise<any> {
    try {
      return await super.send(method, params)
    } catch (primaryError) {
      if (!isTransportError(primaryError)) {
        throw primaryError
      }
      for (const fallback of this.fallbackProviders) {
        logger.warn('mainnetProvider', 'send', `Primary RPC failed for ${method} — failing over`, {
          fallbackUrl: fallback.connection.url,
        })
        try {
          return await fallback.send(method, params)
        } catch (fallbackError) {
          if (!isTransportError(fallbackError)) {
            throw fallbackError
          }
        }
      }
      throw primaryError
    }
  }
}

let cachedProvider: JsonRpcProvider | null = null

/**
 * Shared mainnet read provider for the on-chain swap flow (quotes, swap
 * building, approval checks, tx status polling). QuickNode is primary when
 * configured; public RPCs take over on transport failures so a QuickNode
 * outage degrades to slower quotes instead of disabling swaps.
 */
export function getMainnetProvider(): JsonRpcProvider {
  if (cachedProvider) {
    return cachedProvider
  }
  const name = config.quicknodeEndpointName
  const token = config.quicknodeEndpointToken
  const urls =
    name && token
      ? [`https://${name}.quiknode.pro/${token}`, ...PUBLIC_FALLBACK_RPC_URLS]
      : [...PUBLIC_FALLBACK_RPC_URLS]
  if (!name || !token) {
    logger.warn(
      'mainnetProvider',
      'getMainnetProvider',
      'QuickNode endpoint not configured — using public mainnet RPCs only',
    )
  }
  cachedProvider = new FailoverJsonRpcProvider(urls)
  return cachedProvider
}
