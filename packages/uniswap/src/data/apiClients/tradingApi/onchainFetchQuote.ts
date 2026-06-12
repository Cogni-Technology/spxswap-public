/* eslint-disable no-console -- diagnostic logs for the on-chain quote path */
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Token } from '@uniswap/sdk-core'
import { TradingApi, type ClassicQuoteResponse, type DiscriminatedQuoteResponse } from '@universe/api'
import { fetchEip1559Fees } from 'uniswap/src/data/apiClients/tradingApi/onchainFetchSwap'
import { buildPermitDataIfNeeded } from 'uniswap/src/data/apiClients/tradingApi/onchainPermit2'
import {
  buildV3PoolInRoute,
  MAINNET_QUOTER_V2,
  MAINNET_V3_FACTORY,
  type PoolSnapshot,
  QUOTER_V2_ABI,
  quoteBestPair,
  V3_FACTORY_ABI,
} from 'uniswap/src/data/apiClients/tradingApi/onchainPoolDiscovery'
import { getMainnetProvider } from 'uniswap/src/data/apiClients/tradingApi/utils/mainnetProvider'
import { NATIVE_ADDRESS_FOR_TRADING_API } from 'uniswap/src/features/transactions/swap/utils/tradingApi'

/**
 * SPXSwap on-chain fetchQuote implementation.
 *
 * Upstream Uniswap routed every quote through their CORS-locked Trading API
 * (beta.trading-api-labs.interface.gateway.uniswap.org/v1/quote). For SPXSwap
 * we read pool state + QuoterV2 output directly from mainnet via QuickNode
 * and synthesize a TradingApi.ClassicQuoteResponse that the rest of the swap
 * pipeline (tradeService, evmTradeService, useUniversalRouterSwapCallback)
 * consumes unchanged.
 */

// Canonical mainnet metadata for the small V1 curated list.
const MAINNET_TOKEN_META: Record<string, { symbol: string; decimals: number; name: string }> = {
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
  '0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c': { symbol: 'SPX', decimals: 8, name: 'SPX6900' },
}

const WETH_MAINNET_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

function resolveMainnetToken(addressOrNative: string): Token {
  const addr = addressOrNative === NATIVE_ADDRESS_FOR_TRADING_API ? WETH_MAINNET_ADDRESS : addressOrNative
  const lower = addr.toLowerCase()
  const meta = MAINNET_TOKEN_META[lower]
  if (!meta) {
    // Fall back to a generic token — decimals unknown, so we default to 18.
    return new Token(1, addr, 18, undefined, undefined, true)
  }
  return new Token(1, addr, meta.decimals, meta.symbol, meta.name)
}

type RouteCandidate = {
  amountIn: string
  amountOut: string
  gasEstimate: BigNumber
  routePools: TradingApi.V3PoolInRoute[]
  routeString: string
}

async function buildDirectRoute(args: {
  provider: JsonRpcProvider
  factory: Contract
  quoter: Contract
  tokenIn: Token
  tokenOut: Token
  amount: string
  isExactInput: boolean
}): Promise<RouteCandidate | null> {
  const { tokenIn, tokenOut, amount, isExactInput } = args
  const direct = await quoteBestPair(args)
  if (!direct) {
    return null
  }
  const amountIn = isExactInput ? amount : direct.resultAmount.toString()
  const amountOut = isExactInput ? direct.resultAmount.toString() : amount
  return {
    amountIn,
    amountOut,
    gasEstimate: direct.gasEstimate,
    routePools: [buildV3PoolInRoute({ snapshot: direct, tokenIn, tokenOut, amountIn, amountOut })],
    routeString: `${tokenIn.symbol ?? 'IN'} -> ${tokenOut.symbol ?? 'OUT'} (V3 ${direct.fee})`,
  }
}

async function buildWethRoute(args: {
  provider: JsonRpcProvider
  factory: Contract
  quoter: Contract
  tokenIn: Token
  tokenOut: Token
  weth: Token
  amount: string
  isExactInput: boolean
}): Promise<RouteCandidate | null> {
  const { provider, factory, quoter, tokenIn, tokenOut, weth, amount, isExactInput } = args
  if (tokenIn.equals(weth) || tokenOut.equals(weth)) {
    return null
  }
  let hop1: PoolSnapshot | null
  let hop2: PoolSnapshot | null
  let amountIn: string
  let amountOut: string
  if (isExactInput) {
    hop1 = await quoteBestPair({ provider, factory, quoter, tokenIn, tokenOut: weth, amount, isExactInput: true })
    if (!hop1) {
      return null
    }
    const wethOut = hop1.resultAmount.toString()
    hop2 = await quoteBestPair({
      provider,
      factory,
      quoter,
      tokenIn: weth,
      tokenOut,
      amount: wethOut,
      isExactInput: true,
    })
    if (!hop2) {
      return null
    }
    amountIn = amount
    amountOut = hop2.resultAmount.toString()
  } else {
    hop2 = await quoteBestPair({
      provider,
      factory,
      quoter,
      tokenIn: weth,
      tokenOut,
      amount,
      isExactInput: false,
    })
    if (!hop2) {
      return null
    }
    const wethRequired = hop2.resultAmount.toString()
    hop1 = await quoteBestPair({
      provider,
      factory,
      quoter,
      tokenIn,
      tokenOut: weth,
      amount: wethRequired,
      isExactInput: false,
    })
    if (!hop1) {
      return null
    }
    amountIn = hop1.resultAmount.toString()
    amountOut = amount
  }
  const hop1Amounts = isExactInput
    ? { amountIn: amount, amountOut: hop1.resultAmount.toString() }
    : { amountIn: hop1.resultAmount.toString(), amountOut: hop2.resultAmount.toString() }
  const hop2Amounts = isExactInput
    ? { amountIn: hop1.resultAmount.toString(), amountOut: hop2.resultAmount.toString() }
    : { amountIn: hop2.resultAmount.toString(), amountOut: amount }
  return {
    amountIn,
    amountOut,
    gasEstimate: hop1.gasEstimate.add(hop2.gasEstimate),
    routePools: [
      buildV3PoolInRoute({ snapshot: hop1, tokenIn, tokenOut: weth, ...hop1Amounts }),
      buildV3PoolInRoute({ snapshot: hop2, tokenIn: weth, tokenOut, ...hop2Amounts }),
    ],
    routeString: `${tokenIn.symbol ?? 'IN'} -> WETH (V3 ${hop1.fee}) -> ${tokenOut.symbol ?? 'OUT'} (V3 ${hop2.fee})`,
  }
}

/** For EXACT_INPUT pick the candidate with the higher output; for EXACT_OUTPUT the candidate with the lower input. */
function pickBetterRoute(args: {
  a: RouteCandidate | null
  b: RouteCandidate | null
  isExactInput: boolean
}): RouteCandidate | null {
  const { a, b, isExactInput } = args
  if (!a) {
    return b
  }
  if (!b) {
    return a
  }
  if (isExactInput) {
    return BigNumber.from(b.amountOut).gt(BigNumber.from(a.amountOut)) ? b : a
  }
  return BigNumber.from(b.amountIn).lt(BigNumber.from(a.amountIn)) ? b : a
}

export async function onchainFetchQuote(
  params: TradingApi.QuoteRequest & { isUSDQuote?: boolean },
): Promise<DiscriminatedQuoteResponse> {
  if (params.tokenInChainId !== 1 || params.tokenOutChainId !== 1) {
    throw new Error('SPXSwap: only Ethereum mainnet quotes are supported in V1')
  }

  const isExactInput = params.type === TradingApi.TradeType.EXACT_INPUT

  const provider = getMainnetProvider()
  const quoter = new Contract(MAINNET_QUOTER_V2, QUOTER_V2_ABI, provider)
  const factory = new Contract(MAINNET_V3_FACTORY, V3_FACTORY_ABI, provider)

  const tokenIn = resolveMainnetToken(params.tokenIn)
  const tokenOut = resolveMainnetToken(params.tokenOut)

  if (tokenIn.equals(tokenOut)) {
    throw new Error('SPXSwap: tokenIn and tokenOut are the same')
  }

  console.log(
    `[SPXSwap] quote attempt ${tokenIn.symbol ?? '?'}/${tokenOut.symbol ?? '?'} ${isExactInput ? 'IN' : 'OUT'}=${params.amount}`,
  )

  // Always compute both the direct path AND the WETH-intermediate two-hop in
  // parallel, then pick whichever delivers the better rate. A dust-liquidity
  // direct pool would otherwise poison quotes (cf. the SPX/USDC fee=10000
  // pool that appeared after Session 5 validation and returned ~$0.08/SPX
  // vs ~$0.32/SPX via SPX->WETH->USDC).
  const weth = resolveMainnetToken(WETH_MAINNET_ADDRESS)
  const [directRoute, wethRoute] = await Promise.all([
    buildDirectRoute({
      provider,
      factory,
      quoter,
      tokenIn,
      tokenOut,
      amount: params.amount,
      isExactInput,
    }),
    buildWethRoute({
      provider,
      factory,
      quoter,
      tokenIn,
      tokenOut,
      weth,
      amount: params.amount,
      isExactInput,
    }),
  ])

  const chosen = pickBetterRoute({ a: directRoute, b: wethRoute, isExactInput })
  if (!chosen) {
    throw new Error(
      `SPXSwap: no V3 liquidity for ${tokenIn.symbol ?? 'tokenIn'} -> ${tokenOut.symbol ?? 'tokenOut'} (direct or via WETH)`,
    )
  }

  if (directRoute && wethRoute) {
    const directOut = directRoute.amountOut
    const wethOut = wethRoute.amountOut
    console.log(
      `[SPXSwap] route selection: direct=${directRoute.routeString} out=${directOut} weth=${wethRoute.routeString} out=${wethOut} chose=${chosen.routeString}`,
    )
  }

  const { amountIn, amountOut, gasEstimate, routePools, routeString } = chosen

  // ERC20 input needs a Permit2 allowance to the Universal Router so UR can
  // pull tokens via Permit2.transferFrom during the swap. We check the existing
  // allowance on-chain and only generate a PermitSingle when one is actually
  // needed — the UI signs this EIP-712 payload right before submitting the swap.
  // Native input (ETH) skips this entirely because WRAP_ETH leaves the WETH in
  // the router's own balance.
  let permitData: TradingApi.NullablePermit | undefined
  if (params.tokenIn !== NATIVE_ADDRESS_FOR_TRADING_API && params.swapper) {
    try {
      permitData = await buildPermitDataIfNeeded({
        provider,
        tokenAddress: tokenIn.address,
        owner: params.swapper,
        amount: amountIn,
      })
    } catch (err) {
      console.log('[SPXSwap] buildPermitDataIfNeeded failed', (err as Error).message)
    }
  }

  // Fetch block number + realistic EIP-1559 fees in parallel. We use the
  // SAME helper as the swap path so the quote display matches what the user
  // actually pays: `(baseFee + priorityTip) × gasUsed`, not the
  // `maxFeePerGas` ceiling. Otherwise the review screen shows a number ~5x
  // higher than the real cost, which is what ethers v5's hardcoded 1.5 gwei
  // tip did before (quoted $0.82 for a tx that should have cost $0.03).
  const [latestBlock, fees] = await Promise.all([provider.getBlockNumber().catch(() => 0), fetchEip1559Fees(provider)])
  // Expected paid price per gas, not the max cap.
  const expectedPricePerGas = fees.baseFee.add(fees.maxPriorityFeePerGas)

  // QuoterV2.gasEstimate is the pool-level cost only; add ~80k for Universal
  // Router overhead (command dispatch + WRAP_ETH/unwrap + SWEEP). Close enough
  // for display; the real gas is re-estimated in onchainFetchSwap before
  // signing.
  const totalGasEstimate = gasEstimate.add(BigNumber.from('80000'))
  const gasFeeWei = totalGasEstimate.mul(expectedPricePerGas).toString()

  const classicQuote: TradingApi.ClassicQuote = {
    input: {
      token: params.tokenIn,
      amount: amountIn,
      chainId: 1,
    },
    output: {
      token: params.tokenOut,
      amount: amountOut,
      recipient: params.swapper,
      chainId: 1,
    },
    swapper: params.swapper,
    chainId: 1,
    slippage: params.slippageTolerance ?? 0.5,
    tradeType: params.type,
    route: [routePools],
    routeString,
    gasUseEstimate: totalGasEstimate.toString(),
    gasFee: gasFeeWei,
    gasPrice: expectedPricePerGas.toString(),
    blockNumber: latestBlock.toString(),
    quoteId: `spxswap-${Date.now()}`,
    priceImpact: 0,
  } as TradingApi.ClassicQuote

  const response: ClassicQuoteResponse = {
    requestId: `spxswap-${Date.now()}`,
    routing: TradingApi.Routing.CLASSIC,
    quote: classicQuote,
    permitData: permitData ?? null,
  } as ClassicQuoteResponse

  return response
}
