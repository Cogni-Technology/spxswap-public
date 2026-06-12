import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import { PERMIT2_ADDRESS } from '@uniswap/permit2-sdk'
import { createTradingApiClient, TradingApi, type TradingApiClient as TradingApiClientType } from '@universe/api'
import { TRADING_API_PATHS } from '@universe/api/src/clients/trading/createTradingApiClient'
import {
  EthAsErc20UniswapXProperties,
  Experiments,
  FeatureFlags,
  getExperimentValueFromLayer,
  getFeatureFlag,
  Layers,
  waitForStatsigReady,
} from '@universe/gating'
import { config } from 'uniswap/src/config'
import { tradingApiVersionPrefix, uniswapUrls } from 'uniswap/src/constants/urls'
import { createUniswapFetchClient } from 'uniswap/src/data/apiClients/createUniswapFetchClient'
import { onchainFetchQuote } from 'uniswap/src/data/apiClients/tradingApi/onchainFetchQuote'
import { onchainFetchSwap } from 'uniswap/src/data/apiClients/tradingApi/onchainFetchSwap'
import { onchainFetchSwaps } from 'uniswap/src/data/apiClients/tradingApi/onchainFetchSwaps'
import { filterChainIdsByPlatform } from 'uniswap/src/features/chains/utils'
import { Platform } from 'uniswap/src/features/platforms/types/Platform'
import { NATIVE_ADDRESS_FOR_TRADING_API } from 'uniswap/src/features/transactions/swap/utils/tradingApi'

// Minimal ERC20 ABI for allowance check + approve calldata encoding. Living
// inline here to avoid pulling a full ERC20 artifact into this file.
const ERC20_APPROVAL_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'address', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

let cachedApprovalProvider: JsonRpcProvider | null = null
function getApprovalMainnetProvider(): JsonRpcProvider {
  if (cachedApprovalProvider) {
    return cachedApprovalProvider
  }
  const name = config.quicknodeEndpointName
  const token = config.quicknodeEndpointToken
  if (!name || !token) {
    throw new Error('SPXSwap: QuickNode endpoint env vars missing — cannot check approval')
  }
  cachedApprovalProvider = new JsonRpcProvider(`https://${name}.quiknode.pro/${token}`, 1)
  return cachedApprovalProvider
}

// The `approval` / `cancel` fields on ApprovalResponse are typed as required
// `TransactionRequest` but the runtime flow in useTokenApprovalInfo treats
// `null` as the "no approval needed" signal. We cast through `unknown` so TS
// is happy and useTokenApprovalInfo sees its expected `null`.
const NO_APPROVAL_TX = null as unknown as TradingApi.TransactionRequest

const TradingFetchClient = createUniswapFetchClient({
  baseUrl: uniswapUrls.tradingApiUrl,
  additionalHeaders: {
    'x-api-key': config.tradingApiKey,
  },
})

/**
 * Helper to add a header only if enabled.
 */
function addHeaderIfEnabled(params: { headers: Record<string, string>; key: string; enabled: boolean }): void {
  const { headers, key, enabled } = params
  if (enabled) {
    headers[key] = 'true'
  }
}

export enum TradingApiHeaders {
  UniversalRouterVersion = 'x-universal-router-version',
  UniquoteEnabled = 'x-uniquote-enabled',
  ViemProviderEnabled = 'x-viem-provider-enabled',
  Erc20EthEnabled = 'x-erc20eth-enabled',
  ChainedActionsEnabled = 'x-chained-actions-enabled',
  UnirouteEnabled = 'x-uniroute-enabled',
  UniroutePulumiEnabled = 'x-uniroute-pulumi-enabled',
  DisableUniswapInterfaceFees = 'x-disable-uniswap-interface-fees',
}

/**
 * Returns the headers for the trading API client that are based on feature flags
 *
 * NOTE: Be sure to confirm that adding this header does not cause a CORS issue
 * with the web environments.
 */
export const getFeatureFlaggedHeaders = async (
  tradingApiPath: (typeof TRADING_API_PATHS)[keyof typeof TRADING_API_PATHS],
): Promise<HeadersInit> => {
  await waitForStatsigReady()
  const headers: Record<string, string> = {
    [TradingApiHeaders.UniversalRouterVersion]: TradingApi.UniversalRouterVersion._2_0,
  }
  const uniquoteEnabled = getFeatureFlag(FeatureFlags.UniquoteEnabled)
  const viemProviderEnabled = getFeatureFlag(FeatureFlags.ViemProviderEnabled)
  addHeaderIfEnabled({ headers, key: TradingApiHeaders.UniquoteEnabled, enabled: uniquoteEnabled })
  addHeaderIfEnabled({ headers, key: TradingApiHeaders.ViemProviderEnabled, enabled: viemProviderEnabled })

  const chainedActionsEnabled = getFeatureFlag(FeatureFlags.ChainedActions)
  const unirouteEnabled = getFeatureFlag(FeatureFlags.UnirouteEnabled)
  const ethAsErc20UniswapXEnabled = getExperimentValueFromLayer<
    typeof Layers.SwapPage,
    Experiments.EthAsErc20UniswapX,
    boolean
  >({
    layerName: Layers.SwapPage,
    param: EthAsErc20UniswapXProperties.EthAsErc20UniswapXEnabled,
    defaultValue: false,
  })
  const disableUniswapInterfaceFees = getFeatureFlag(FeatureFlags.NoUniswapInterfaceFees)
  switch (tradingApiPath) {
    case TRADING_API_PATHS.quote:
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.UnirouteEnabled, enabled: unirouteEnabled })
      // TODO(INFRA-1595): remove once backend is fully migrated to new route
      headers[TradingApiHeaders.UniroutePulumiEnabled] = 'true'
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.Erc20EthEnabled, enabled: ethAsErc20UniswapXEnabled })
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.ChainedActionsEnabled, enabled: chainedActionsEnabled })
      addHeaderIfEnabled({
        headers,
        key: TradingApiHeaders.DisableUniswapInterfaceFees,
        enabled: disableUniswapInterfaceFees,
      })
      break
    case TRADING_API_PATHS.plan:
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.ChainedActionsEnabled, enabled: chainedActionsEnabled })
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.Erc20EthEnabled, enabled: ethAsErc20UniswapXEnabled })
      break
    case TRADING_API_PATHS.order:
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.Erc20EthEnabled, enabled: ethAsErc20UniswapXEnabled })
      break
    case TRADING_API_PATHS.swap7702:
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.UnirouteEnabled, enabled: unirouteEnabled })
      // TODO(INFRA-1595): remove once backend is fully migrated to new route
      headers[TradingApiHeaders.UniroutePulumiEnabled] = 'true'
      addHeaderIfEnabled({ headers, key: TradingApiHeaders.Erc20EthEnabled, enabled: ethAsErc20UniswapXEnabled })
      break
  }
  return headers
}

// Narrowed to `TradingApiClientType` type safety to ensure we are only using the plan endpoints with sessions, until full migration
const _baseTradingApiClient = createTradingApiClient({
  fetchClient: TradingFetchClient,
  getFeatureFlagHeaders: getFeatureFlaggedHeaders,
  getApiPathPrefix: () => tradingApiVersionPrefix,
})

// SPXSwap: the upstream `fetchQuote` POSTs to the CORS-locked Trading API.
// We swap it for an on-chain implementation that reads V3 pool state + QuoterV2
// directly from mainnet via QuickNode. We also stub a handful of other endpoints
// the Trading API owns (wallet delegation, approval info) since they all hit
// the same gateway and we're handling those flows on-chain via wagmi. Everything
// else on the client is left alone.
export const TradingApiClient: TradingApiClientType = {
  ..._baseTradingApiClient,
  fetchQuote: onchainFetchQuote,
  // Upstream's /indicative_quote was a faster cached variant meant to show an
  // estimated output while the full /quote resolved. On-chain there's no such
  // distinction — our onchainFetchQuote is already fast, and routing indicative
  // calls through it would double the RPC load because useTradeQuery and
  // useIndicativeTradeQuery use separate React Query cache keys and each fire
  // onchainFetchQuote independently per poll cycle. Return an empty classic
  // quote so validateIndicativeQuoteResponse rejects it and
  // useIndicativeTradeQuery becomes a no-op. The UI's normal loading state
  // covers the ~1s gap until the real quote resolves.
  fetchIndicativeQuote: async () =>
    ({
      requestId: 'spxswap-indicative-stub',
      routing: TradingApi.Routing.CLASSIC,
      quote: {} as TradingApi.ClassicQuote,
      permitData: null,
    }) as unknown as ReturnType<typeof onchainFetchQuote> extends Promise<infer R> ? R : never,
  // Upstream /swap builds Universal Router calldata server-side; we build it
  // locally via @uniswap/universal-router-sdk. This populates the review
  // screen's gas estimate and produces the actual tx that useSwapHandlers
  // sends via wagmi when the user clicks Swap.
  fetchSwap: onchainFetchSwap,
  // Upstream /swaps polls the Trading API for tx status after submission;
  // we replace it with a direct receipt lookup via QuickNode so the Pending
  // spinner in the header resolves once the tx mines.
  fetchSwaps: onchainFetchSwaps,
  // Upstream /check_approval checks whether the ERC20 allowance from the user
  // to the canonical Permit2 contract is enough to cover this swap. If not, it
  // returns an ERC20 `approve(PERMIT2, MaxUint256)` tx for the UI to prompt.
  // We mirror that behavior on-chain via QuickNode so the SPX→ETH (and other
  // ERC20-input) flow gets a correct approval step in the review screen.
  // Native-ETH input short-circuits to "no approval needed" because the UR
  // wraps ETH into its own WETH balance and never pulls from the user.
  fetchCheckApproval: async (params: TradingApi.ApprovalRequest): Promise<TradingApi.ApprovalResponse> => {
    const noApproval: TradingApi.ApprovalResponse = {
      requestId: 'spxswap-approve',
      approval: NO_APPROVAL_TX,
      cancel: NO_APPROVAL_TX,
    }
    if (params.token === NATIVE_ADDRESS_FOR_TRADING_API) {
      return noApproval
    }
    try {
      const provider = getApprovalMainnetProvider()
      const erc20 = new Contract(params.token, ERC20_APPROVAL_ABI, provider)
      const allowanceFn = erc20['allowance']
      if (!allowanceFn) {
        return noApproval
      }
      const current = BigNumber.from(await allowanceFn(params.walletAddress, PERMIT2_ADDRESS))
      if (current.gte(BigNumber.from(params.amount))) {
        // eslint-disable-next-line no-console
        console.log(`[SPXSwap] ERC20→Permit2 allowance OK: token=${params.token} allowance=${current.toString()}`)
        return noApproval
      }
      // Build an ERC20 approve tx targeting Permit2 for max uint256. One-time
      // per (wallet, token) pair — after this lands the UR can pull tokens via
      // Permit2 for all future swaps of this token until nonce invalidation.
      const maxUint256 = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      const approveData = erc20.interface.encodeFunctionData('approve', [PERMIT2_ADDRESS, maxUint256])
      // Fetch gasPrice so we can populate ApprovalResponse.gasFee (wei). Without
      // it, useTokenApprovalInfo returns approvalGasFeeResult.value === undefined,
      // which poisons mergeGasFeeResults and makes the review screen render "-"
      // for Network cost. Fallback to 20 gwei on RPC error — the tx still works,
      // just the display number is slightly off.
      const gasLimitStr = '80000'
      const gasPrice = await provider.getGasPrice().catch(() => BigNumber.from('20000000000'))
      const gasFeeWei = BigNumber.from(gasLimitStr).mul(gasPrice).toString()
      // eslint-disable-next-line no-console
      console.log(
        `[SPXSwap] ERC20→Permit2 allowance insufficient: token=${params.token} current=${current.toString()} needed=${params.amount} — building approve tx (gasFee=${gasFeeWei})`,
      )
      return {
        requestId: 'spxswap-approve',
        approval: {
          to: params.token,
          from: params.walletAddress,
          data: approveData,
          value: '0x00',
          chainId: 1 as TradingApi.ChainId,
          gasLimit: gasLimitStr,
          gasPrice: gasPrice.toString(),
        } as TradingApi.TransactionRequest,
        cancel: NO_APPROVAL_TX,
        gasFee: gasFeeWei,
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[SPXSwap] fetchCheckApproval error', (err as Error).message)
      // Fail-open. The swap will fail at execution if approval was actually
      // required, but blocking on a transient RPC error would strand users on
      // the review screen.
      return noApproval
    }
  },
  checkWalletDelegationWithoutBatching: async (
    params: TradingApi.WalletCheckDelegationRequestBody,
  ): Promise<TradingApi.WalletCheckDelegationResponseBody> => {
    const walletAddresses = params.walletAddresses ?? []
    const chainIds = params.chainIds ?? []
    return {
      requestId: 'spxswap-stub',
      delegationDetails: Object.fromEntries(
        walletAddresses.map((addr) => [
          addr,
          Object.fromEntries(
            chainIds.map((chain) => [
              chain,
              {
                isWalletDelegatedToUniswap: false,
                currentDelegationAddress: null,
                latestDelegationAddress: '',
              } satisfies TradingApi.DelegationDetails,
            ]),
          ) as unknown as TradingApi.ChainDelegationMap,
        ]),
      ),
    }
  },
}

// Default maximum amount of combinations wallet<>chainId per check delegation request
const DEFAULT_CHECK_VALIDATIONS_BATCH_THRESHOLD = 140

// Utility function to chunk wallet addresses for batching
function chunkWalletAddresses(params: {
  walletAddresses: Address[]
  chainIds: TradingApi.ChainId[]
  batchThreshold: number
}): Address[][] {
  const { walletAddresses, chainIds, batchThreshold } = params
  const totalCombinations = walletAddresses.length * chainIds.length

  if (totalCombinations <= batchThreshold) {
    return [walletAddresses]
  }

  const maxWalletsPerBatch = Math.floor(batchThreshold / chainIds.length)
  const chunks: Address[][] = []

  for (let i = 0; i < walletAddresses.length; i += maxWalletsPerBatch) {
    chunks.push(walletAddresses.slice(i, i + maxWalletsPerBatch))
  }

  return chunks
}

function mergeDelegationResponses(
  responses: TradingApi.WalletCheckDelegationResponseBody[],
): TradingApi.WalletCheckDelegationResponseBody {
  if (responses.length === 0) {
    throw new Error('No responses to merge')
  }

  const firstResponse = responses[0]
  if (!firstResponse) {
    throw new Error('First response is undefined')
  }

  if (responses.length === 1) {
    return firstResponse
  }

  const mergedDelegationDetails: Record<string, TradingApi.ChainDelegationMap> = {}

  for (const response of responses) {
    for (const [walletAddress, chainDelegationMap] of Object.entries(response.delegationDetails)) {
      mergedDelegationDetails[walletAddress] = chainDelegationMap
    }
  }

  return {
    requestId: firstResponse.requestId,
    delegationDetails: mergedDelegationDetails,
  }
}

export type CheckWalletDelegation = (
  params: TradingApi.WalletCheckDelegationRequestBody,
) => Promise<TradingApi.WalletCheckDelegationResponseBody>

export async function checkWalletDelegation(
  params: TradingApi.WalletCheckDelegationRequestBody,
  batchThreshold: number = DEFAULT_CHECK_VALIDATIONS_BATCH_THRESHOLD,
): Promise<TradingApi.WalletCheckDelegationResponseBody> {
  const { walletAddresses, chainIds } = params

  // Filter out SVM chains - check_delegation only supports EVM chains
  const evmChainIds = filterChainIdsByPlatform(chainIds, Platform.EVM)

  // If no wallet addresses provided or if no EVM chains after filtering, return empty response
  if (!walletAddresses || walletAddresses.length === 0 || evmChainIds.length === 0) {
    return {
      requestId: '',
      delegationDetails: {},
    }
  }

  // Ensure batchThreshold is at least the number of chain IDs
  const effectiveBatchThreshold = Math.max(batchThreshold, evmChainIds.length)

  const totalCombinations = walletAddresses.length * evmChainIds.length

  // If under threshold, make a single request
  if (totalCombinations <= effectiveBatchThreshold) {
    return await TradingApiClient.checkWalletDelegationWithoutBatching({
      walletAddresses,
      chainIds: evmChainIds,
    })
  }

  // Split into batches
  const walletChunks = chunkWalletAddresses({
    walletAddresses,
    chainIds: evmChainIds,
    batchThreshold: effectiveBatchThreshold,
  })

  // Make batched requests
  const batchPromises = walletChunks.map((chunk) =>
    TradingApiClient.checkWalletDelegationWithoutBatching({
      walletAddresses: chunk,
      chainIds: evmChainIds,
    }),
  )

  const responses = await Promise.all(batchPromises)

  // Merge all responses
  return mergeDelegationResponses(responses)
}
