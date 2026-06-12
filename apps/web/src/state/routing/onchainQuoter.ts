import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import type { JsonRpcProvider } from '@ethersproject/providers'
import { Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import { FeeAmount, Pool, Route as V3Route } from '@uniswap/v3-sdk'
import { nativeOnChain, WRAPPED_NATIVE_CURRENCY } from 'uniswap/src/constants/tokens'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { RPC_PROVIDERS } from '~/constants/providers'
import type { ClassicQuoteData, GetQuoteArgs, V3PoolInRoute } from '~/state/routing/types'

/**
 * Client-side quote path for SPXSwap.
 *
 * Why: upstream Uniswap fronted every quote through their CORS-locked Trading
 * API (beta.trading-api-labs.interface.gateway.uniswap.org/v1/quote). We can't
 * use it from a non-Uniswap origin, so we read state directly from the V3
 * Quoter contract + pool contracts on-chain via the provider in RPC_PROVIDERS
 * (QuickNode today).
 */

// Uniswap V3 canonical QuoterV2 on Ethereum mainnet.
const QUOTER_V2_ADDRESSES: Partial<Record<UniverseChainId, string>> = {
  [UniverseChainId.Mainnet]: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
}

const QUOTER_V2_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

const POOL_ABI = [
  {
    inputs: [],
    name: 'slot0',
    outputs: [
      { internalType: 'uint160', name: 'sqrtPriceX96', type: 'uint160' },
      { internalType: 'int24', name: 'tick', type: 'int24' },
      { internalType: 'uint16', name: 'observationIndex', type: 'uint16' },
      { internalType: 'uint16', name: 'observationCardinality', type: 'uint16' },
      { internalType: 'uint16', name: 'observationCardinalityNext', type: 'uint16' },
      { internalType: 'uint8', name: 'feeProtocol', type: 'uint8' },
      { internalType: 'bool', name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'liquidity',
    outputs: [{ internalType: 'uint128', name: '', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
]

const FEE_TIERS: FeeAmount[] = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]

type FeeTierCandidate = {
  fee: FeeAmount
  pool: Pool
  amountOut: BigNumber
  gasEstimate: BigNumber
  sqrtPriceX96After: BigNumber
}

/**
 * Normalise an input currency: route quoting always uses ERC20 tokens, so if
 * the user selected native ETH we swap it for WETH for the pool lookup. The
 * higher-level slice still exposes the native wrapper to the user.
 */
function toRoutingToken(currency: Currency): Token {
  if (currency.isNative) {
    const wrapped = WRAPPED_NATIVE_CURRENCY[currency.chainId]
    if (!wrapped) {
      throw new Error(`No wrapped native currency configured for chain ${currency.chainId}`)
    }
    return wrapped
  }
  return currency as Token
}

async function fetchPoolState({
  provider,
  tokenIn,
  tokenOut,
  fee,
}: {
  provider: JsonRpcProvider
  tokenIn: Token
  tokenOut: Token
  fee: FeeAmount
}): Promise<Pool | null> {
  try {
    const address = Pool.getAddress(tokenIn, tokenOut, fee)
    const contract = new Contract(address, POOL_ABI, provider)
    const [slot0, liquidity] = await Promise.all([contract.slot0(), contract.liquidity()])
    const sqrtPriceX96: BigNumber = slot0.sqrtPriceX96
    const tick: number = slot0.tick
    if (sqrtPriceX96.isZero()) {
      return null
    }
    return new Pool(tokenIn, tokenOut, fee, sqrtPriceX96.toString(), liquidity.toString(), tick)
  } catch {
    return null
  }
}

async function quoteFeeTier({
  provider,
  quoter,
  tokenIn,
  tokenOut,
  fee,
  amountIn,
}: {
  provider: JsonRpcProvider
  quoter: Contract
  tokenIn: Token
  tokenOut: Token
  fee: FeeAmount
  amountIn: string
}): Promise<FeeTierCandidate | null> {
  const pool = await fetchPoolState({ provider, tokenIn, tokenOut, fee })
  if (!pool) {
    return null
  }
  try {
    const params = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn,
      fee,
      sqrtPriceLimitX96: 0,
    }
    const result = await quoter.callStatic.quoteExactInputSingle(params)
    const amountOut = BigNumber.from(result.amountOut ?? result[0])
    if (amountOut.isZero()) {
      return null
    }
    return {
      fee,
      pool,
      amountOut,
      gasEstimate: BigNumber.from(result.gasEstimate ?? result[3] ?? 0),
      sqrtPriceX96After: BigNumber.from(result.sqrtPriceX96After ?? result[1] ?? 0),
    }
  } catch {
    return null
  }
}

export type OnchainQuoteResult = {
  quoteData: ClassicQuoteData
  route: V3Route<Currency, Currency>
  pool: Pool
  amountOut: BigNumber
}

/**
 * Quote an exact-input swap by polling the V3 QuoterV2 contract across all fee
 * tiers in parallel. Returns a ClassicQuoteData-shaped object that plugs into
 * the existing transformQuoteToTrade pipeline without further surgery.
 */
export async function getOnchainExactInputQuote(args: GetQuoteArgs): Promise<OnchainQuoteResult | null> {
  if (args.tradeType !== TradeType.EXACT_INPUT) {
    return null
  }
  if (args.tokenInChainId !== args.tokenOutChainId) {
    return null
  }
  const chainId = args.tokenInChainId
  const quoterAddress = QUOTER_V2_ADDRESSES[chainId]
  if (!quoterAddress) {
    return null
  }
  const provider = RPC_PROVIDERS[chainId as keyof typeof RPC_PROVIDERS]
  if (!provider) {
    return null
  }

  const currencyIn: Currency =
    args.tokenInAddress === 'ETH'
      ? nativeOnChain(chainId)
      : new Token(chainId, args.tokenInAddress, args.tokenInDecimals, args.tokenInSymbol ?? '')
  const currencyOut: Currency =
    args.tokenOutAddress === 'ETH'
      ? nativeOnChain(chainId)
      : new Token(chainId, args.tokenOutAddress, args.tokenOutDecimals, args.tokenOutSymbol ?? '')

  const tokenIn = toRoutingToken(currencyIn)
  const tokenOut = toRoutingToken(currencyOut)

  if (tokenIn.equals(tokenOut)) {
    return null
  }

  const quoter = new Contract(quoterAddress, QUOTER_V2_ABI, provider)
  const candidates = await Promise.all(
    FEE_TIERS.map((fee) =>
      quoteFeeTier({
        provider,
        quoter,
        tokenIn,
        tokenOut,
        fee,
        amountIn: args.amount,
      }),
    ),
  )

  const best = candidates
    .filter((c): c is FeeTierCandidate => c !== null)
    .sort((a, b) => (b.amountOut.gt(a.amountOut) ? 1 : -1))[0]

  if (!best) {
    return null
  }

  const inputAmountCA = CurrencyAmount.fromRawAmount(tokenIn, args.amount)
  const outputAmountCA = CurrencyAmount.fromRawAmount(tokenOut, best.amountOut.toString())
  const route = new V3Route([best.pool], currencyIn, currencyOut)

  const v3PoolInRoute: V3PoolInRoute = {
    type: 'v3-pool',
    tokenIn: {
      address: tokenIn.address,
      chainId,
      symbol: tokenIn.symbol ?? args.tokenInSymbol ?? '',
      decimals: tokenIn.decimals,
    },
    tokenOut: {
      address: tokenOut.address,
      chainId,
      symbol: tokenOut.symbol ?? args.tokenOutSymbol ?? '',
      decimals: tokenOut.decimals,
    },
    sqrtRatioX96: best.pool.sqrtRatioX96.toString(),
    liquidity: best.pool.liquidity.toString(),
    tickCurrent: best.pool.tickCurrent.toString(),
    fee: best.fee.toString(),
    amountIn: inputAmountCA.quotient.toString(),
    amountOut: outputAmountCA.quotient.toString(),
    address: Pool.getAddress(tokenIn, tokenOut, best.fee),
  }

  const latestBlock = await provider.getBlockNumber().catch(() => 0)

  const quoteData: ClassicQuoteData = {
    requestId: `spxswap-${Date.now()}`,
    quoteId: `spxswap-${Date.now()}`,
    blockNumber: latestBlock.toString(),
    amount: args.amount,
    amountDecimals: args.tokenInDecimals.toString(),
    gasUseEstimate: best.gasEstimate.toString(),
    quote: outputAmountCA.quotient.toString(),
    quoteDecimals: tokenOut.decimals.toString(),
    quoteGasAdjusted: outputAmountCA.quotient.toString(),
    quoteGasAdjustedDecimals: tokenOut.decimals.toString(),
    route: [[v3PoolInRoute]],
    routeString: `${currencyIn.symbol ?? 'IN'} -> ${currencyOut.symbol ?? 'OUT'} (V3 ${best.fee})`,
  }

  return {
    quoteData,
    route,
    pool: best.pool,
    amountOut: best.amountOut,
  }
}
