import { BigNumber } from '@ethersproject/bignumber'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Trade } from '@uniswap/router-sdk'
import { Currency, CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core'
import { SwapRouter, UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from '@uniswap/universal-router-sdk'
import type { Permit2Permit } from '@uniswap/universal-router-sdk/dist/utils/inputTokens'
import { FeeAmount, Pool, Route as V3Route } from '@uniswap/v3-sdk'
import { TradingApi } from '@universe/api'
import { config } from 'uniswap/src/config'
import { nativeOnChain } from 'uniswap/src/constants/tokens'
import { NATIVE_ADDRESS_FOR_TRADING_API } from 'uniswap/src/features/transactions/swap/utils/tradingApi'

/**
 * SPXSwap on-chain fetchSwap implementation.
 *
 * Upstream Uniswap builds Universal Router calldata server-side via the CORS-locked
 * Trading API /swap endpoint. For SPXSwap we build the same calldata locally using
 * @uniswap/universal-router-sdk (same approach as apps/web's legacy useUniversalRouter
 * hook) and return a TradingApi.CreateSwapResponse shape that the rest of the swap
 * pipeline (processSwapResponse, useUniversalRouterSwapCallback) consumes unchanged.
 *
 * V1 scope: V3 pools only, single-hop or WETH-intermediate two-hop (e.g.
 * SPX -> WETH -> USDC). V2/V4 pools are not supported — those paths throw a
 * clear error so the UI surfaces it rather than silently failing gas estimation.
 */

const MAINNET_CHAIN_ID = 1

let cachedProvider: JsonRpcProvider | null = null
function getMainnetProvider(): JsonRpcProvider {
  if (cachedProvider) {
    return cachedProvider
  }
  const name = config.quicknodeEndpointName
  const token = config.quicknodeEndpointToken
  if (!name || !token) {
    throw new Error('SPXSwap: QuickNode endpoint env vars missing — cannot build swap')
  }
  cachedProvider = new JsonRpcProvider(`https://${name}.quiknode.pro/${token}`, 1)
  return cachedProvider
}

function req<T>(value: T | undefined | null, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`SPXSwap: onchainFetchSwap missing required field "${field}"`)
  }
  return value
}

function parseV3Pool(pool: TradingApi.V3PoolInRoute): Pool {
  const poolTokenIn = req(pool.tokenIn, 'pool.tokenIn')
  const poolTokenOut = req(pool.tokenOut, 'pool.tokenOut')
  const tokenIn = new Token(
    MAINNET_CHAIN_ID,
    req(poolTokenIn.address, 'pool.tokenIn.address'),
    parseInt(req(poolTokenIn.decimals, 'pool.tokenIn.decimals'), 10),
    poolTokenIn.symbol ?? undefined,
  )
  const tokenOut = new Token(
    MAINNET_CHAIN_ID,
    req(poolTokenOut.address, 'pool.tokenOut.address'),
    parseInt(req(poolTokenOut.decimals, 'pool.tokenOut.decimals'), 10),
    poolTokenOut.symbol ?? undefined,
  )
  return new Pool(
    tokenIn,
    tokenOut,
    parseInt(req(pool.fee, 'pool.fee'), 10) as FeeAmount,
    req(pool.sqrtRatioX96, 'pool.sqrtRatioX96'),
    req(pool.liquidity, 'pool.liquidity'),
    parseInt(req(pool.tickCurrent, 'pool.tickCurrent'), 10),
  )
}

function resolveCurrency(tokenAddress: string, fallbackTokenInRoute: TradingApi.TokenInRoute): Currency {
  // The quote's input/output.token is the external user-facing address, so
  // NATIVE_ADDRESS_FOR_TRADING_API means native ETH. The v3-sdk will wrap
  // automatically when the route's pool holds WETH.
  if (tokenAddress === NATIVE_ADDRESS_FOR_TRADING_API) {
    return nativeOnChain(MAINNET_CHAIN_ID)
  }
  return new Token(
    MAINNET_CHAIN_ID,
    tokenAddress,
    parseInt(req(fallbackTokenInRoute.decimals, 'fallbackTokenInRoute.decimals'), 10),
    fallbackTokenInRoute.symbol ?? undefined,
  )
}

export async function onchainFetchSwap(params: TradingApi.CreateSwapRequest): Promise<TradingApi.CreateSwapResponse> {
  const quote = params.quote as TradingApi.ClassicQuote
  const route = req(quote.route, 'quote.route')
  if (route.length === 0) {
    throw new Error('SPXSwap: onchainFetchSwap called with empty route')
  }

  if (quote.chainId !== MAINNET_CHAIN_ID) {
    throw new Error('SPXSwap: only Ethereum mainnet swaps are supported in V1')
  }

  const routePools = req(route[0], 'route[0]')
  if (routePools.length === 0) {
    throw new Error('SPXSwap: quote has no pools in route')
  }

  for (const p of routePools) {
    if (p.type !== 'v3-pool') {
      throw new Error(`SPXSwap: only V3 pools are supported in V1 (got ${p.type})`)
    }
  }

  const v3PoolsInRoute = routePools as TradingApi.V3PoolInRoute[]
  const v3Pools = v3PoolsInRoute.map(parseV3Pool)

  const firstV3Pool = req(v3PoolsInRoute[0], 'v3PoolsInRoute[0]')
  const lastV3Pool = req(v3PoolsInRoute[v3PoolsInRoute.length - 1], 'v3PoolsInRoute[last]')
  const firstTokenIn = req(firstV3Pool.tokenIn, 'first pool.tokenIn')
  const lastTokenOut = req(lastV3Pool.tokenOut, 'last pool.tokenOut')

  const quoteInput = req(quote.input, 'quote.input')
  const quoteOutput = req(quote.output, 'quote.output')

  const currencyIn = resolveCurrency(req(quoteInput.token, 'quote.input.token'), firstTokenIn)
  const currencyOut = resolveCurrency(req(quoteOutput.token, 'quote.output.token'), lastTokenOut)

  const routev3 = new V3Route(v3Pools, currencyIn, currencyOut)
  const inputAmount = CurrencyAmount.fromRawAmount(currencyIn, req(quoteInput.amount, 'quote.input.amount'))
  const outputAmount = CurrencyAmount.fromRawAmount(currencyOut, req(quoteOutput.amount, 'quote.output.amount'))

  const tradeType =
    quote.tradeType === TradingApi.TradeType.EXACT_INPUT ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT

  const trade = new Trade({
    v2Routes: [],
    v3Routes: [{ routev3, inputAmount, outputAmount }],
    mixedRoutes: [],
    tradeType,
  })

  // quote.slippage is a percentage (e.g. 0.5 for 0.5%). Convert to bps.
  const slippagePercent = typeof quote.slippage === 'number' ? quote.slippage : 0.5
  const slippageBps = Math.max(1, Math.round(slippagePercent * 100))
  const slippageTolerance = new Percent(slippageBps, 10_000)

  // Deadline from CreateSwapRequest if provided, else 20 minutes from now.
  const deadlineSeconds = params.deadline ?? Math.floor(Date.now() / 1000) + 20 * 60

  // Permit2 flow for ERC20 input: the quote attached a PermitSingle payload
  // (domain/types/values), the review screen signed it via EIP-712, and the
  // saga routed the signature back to us in params.signature. We thread both
  // into SwapRouter.swapCallParameters which encodes a PERMIT2_PERMIT command
  // at the front of the UR calldata. Native input never has a permit —
  // universal-router-sdk asserts NATIVE_INPUT_PERMIT if we tried to pass one.
  let inputTokenPermit: Permit2Permit | undefined
  const incomingPermit = params.permitData
  const incomingSignature = params.signature
  if (!currencyIn.isNative && incomingPermit && incomingPermit.values && incomingSignature) {
    const values = incomingPermit.values as unknown as {
      details: {
        token: string
        amount: string | number
        expiration: string | number
        nonce: string | number
      }
      spender: string
      sigDeadline: string | number
    }
    inputTokenPermit = {
      details: {
        token: values.details.token,
        amount: values.details.amount,
        expiration: values.details.expiration,
        nonce: values.details.nonce,
      },
      spender: values.spender,
      sigDeadline: values.sigDeadline,
      signature: incomingSignature,
    }
  }

  const { calldata, value } = SwapRouter.swapCallParameters(trade, {
    slippageTolerance,
    deadlineOrPreviousBlockhash: deadlineSeconds.toString(),
    inputTokenPermit,
  })

  const universalRouterAddress = UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V1_2, MAINNET_CHAIN_ID)
  const swapper = req(quote.swapper, 'quote.swapper')

  const hexValue = value && value !== '0x00' && value !== '0x0' ? BigNumber.from(value).toHexString() : '0x00'

  const provider = getMainnetProvider()

  const routeSummary = v3PoolsInRoute
    .map((p, i) => {
      const inSym = p.tokenIn?.symbol ?? '?'
      const outSym = p.tokenOut?.symbol ?? '?'
      return i === 0 ? `${inSym}->${outSym}@${p.fee}` : `->${outSym}@${p.fee}`
    })
    .join('')

  // eslint-disable-next-line no-console
  console.log('[SPXSwap] fetchSwap building tx', {
    to: universalRouterAddress,
    from: swapper,
    dataLength: calldata.length,
    value: hexValue,
    tradeType: quote.tradeType === TradingApi.TradeType.EXACT_INPUT ? 'EXACT_INPUT' : 'EXACT_OUTPUT',
    route: routeSummary,
    hops: v3PoolsInRoute.length,
    permit: inputTokenPermit ? 'signed' : currencyIn.isNative ? 'native' : 'none',
  })
  // Full calldata dumped separately so it can be copied for manual
  // verification against a reference UR decoder.
  // eslint-disable-next-line no-console
  console.log('[SPXSwap] fetchSwap calldata', calldata)

  let gasLimit: BigNumber
  try {
    const estimated = await provider.estimateGas({
      to: universalRouterAddress,
      from: swapper,
      data: calldata,
      value: hexValue,
    })
    // 25% buffer matches calculateGasMargin in the legacy hook.
    gasLimit = estimated.mul(125).div(100)
    // eslint-disable-next-line no-console
    console.log('[SPXSwap] gas estimated', {
      raw: estimated.toString(),
      buffered: gasLimit.toString(),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[SPXSwap] gas estimation failed, using fallback 500k', (err as Error).message)
    gasLimit = BigNumber.from('500000')
  }

  // Proper EIP-1559 fee fields. Ethers v5's `getFeeData()` hardcodes the
  // priority tip at 1.5 gwei, which is 1500x too high on a quiet mainnet
  // (real tips are ~0.001 gwei). We pay `min(maxFeePerGas, baseFee + tip)`
  // so setting a too-high tip poisons the actual cost regardless of mempool.
  // Fix: query `eth_maxPriorityFeePerGas` directly — that's the geth/erigon
  // RPC that mirrors real mempool demand. Fall back to 0.01 gwei if the
  // node doesn't expose it (generous floor; still ~150x cheaper than v5).
  const fees = await fetchEip1559Fees(provider)

  const gasFee = gasLimit.mul(fees.maxFeePerGas).toString()

  // eslint-disable-next-line no-console
  console.log('[SPXSwap] gas fee fields', {
    maxFeePerGas: fees.maxFeePerGas.toString(),
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    baseFee: fees.baseFee.toString(),
    gasLimit: gasLimit.toString(),
  })

  return {
    requestId: `spxswap-swap-${Date.now()}`,
    swap: {
      to: universalRouterAddress,
      from: swapper,
      data: calldata,
      value: hexValue,
      chainId: MAINNET_CHAIN_ID as TradingApi.ChainId,
      gasLimit: gasLimit.toString(),
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    } as TradingApi.TransactionRequest,
    gasFee,
  }
}

/**
 * Fetch realistic EIP-1559 fee fields: latest block's baseFeePerGas and the
 * node's `eth_maxPriorityFeePerGas` suggestion. Computes `maxFeePerGas` as
 * `baseFee * 2 + tip` to absorb ~one doubling of base fee before the tx
 * fails, which is the standard envelope used by wallets.
 */
export async function fetchEip1559Fees(provider: JsonRpcProvider): Promise<{
  baseFee: BigNumber
  maxFeePerGas: BigNumber
  maxPriorityFeePerGas: BigNumber
}> {
  const [latestBlock, tipRaw] = await Promise.all([
    provider.getBlock('latest').catch(() => null),
    provider.send('eth_maxPriorityFeePerGas', []).catch(() => null),
  ])

  const baseFee = latestBlock?.baseFeePerGas ?? BigNumber.from('100000000') // 0.1 gwei fallback
  // eth_maxPriorityFeePerGas returns a hex string; parseable by BigNumber.from.
  // Floor at 3M wei (0.003 gwei) — 3x the current mempool minimum for
  // next-block inclusion. Defends against nodes that report dust-level or
  // zero tips without meaningfully overpaying when the RPC value is sane.
  let maxPriorityFeePerGas: BigNumber
  const floor = BigNumber.from('3000000') // 0.003 gwei
  if (typeof tipRaw === 'string' && tipRaw.startsWith('0x')) {
    const parsed = BigNumber.from(tipRaw)
    maxPriorityFeePerGas = parsed.lt(floor) ? floor : parsed
  } else {
    maxPriorityFeePerGas = floor
  }
  const maxFeePerGas = baseFee.mul(2).add(maxPriorityFeePerGas)
  return { baseFee, maxFeePerGas, maxPriorityFeePerGas }
}
