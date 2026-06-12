/* eslint-disable no-console -- diagnostic logs for the on-chain quote path */
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Token } from '@uniswap/sdk-core'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { TradingApi } from '@universe/api'

/**
 * V3 pool discovery + quoter helpers used by onchainFetchQuote.
 *
 * Separate from onchainFetchQuote.ts so the main quote orchestrator stays
 * under the lint line-length cap. Everything here is pure on-chain read
 * operations against the V3 Factory, pool contracts, and QuoterV2.
 */

// Uniswap V3 canonical QuoterV2 on Ethereum mainnet.
export const MAINNET_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
// Uniswap V3 canonical Factory on Ethereum mainnet.
export const MAINNET_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const QUOTER_V2_ABI = [
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
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IQuoterV2.QuoteExactOutputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactOutputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

export const V3_FACTORY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
    ],
    name: 'getPool',
    outputs: [{ internalType: 'address', name: 'pool', type: 'address' }],
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

export const FEE_TIERS: FeeAmount[] = [FeeAmount.LOWEST, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]

export type PoolSnapshot = {
  fee: FeeAmount
  address: string
  pool: Pool
  // For EXACT_INPUT: amount of tokenOut the pool would deliver.
  // For EXACT_OUTPUT: amount of tokenIn the pool would require.
  resultAmount: BigNumber
  gasEstimate: BigNumber
}

export async function quoteOnFeeTier(args: {
  provider: JsonRpcProvider
  factory: Contract
  quoter: Contract
  tokenIn: Token
  tokenOut: Token
  fee: FeeAmount
  amount: string
  isExactInput: boolean
}): Promise<PoolSnapshot | null> {
  const { provider, factory, quoter, tokenIn, tokenOut, fee, amount, isExactInput } = args
  // Ground-truth pool discovery via the V3 Factory — no reliance on the
  // v3-sdk's hardcoded init code hash. Factory.getPool returns address(0)
  // when no pool has been deployed for (tokenA, tokenB, fee).
  try {
    const getPoolFn = factory['getPool']
    if (!getPoolFn) {
      return null
    }
    const pair = `${tokenIn.symbol ?? '?'}/${tokenOut.symbol ?? '?'}`
    const address: string = await getPoolFn(tokenIn.address, tokenOut.address, fee)
    if (!address || address === ADDRESS_ZERO) {
      console.log(`[SPXSwap] V3 ${pair} fee=${fee}: no pool`)
      return null
    }
    const poolContract = new Contract(address, POOL_ABI, provider)
    const [slot0, liquidity] = await Promise.all([poolContract['slot0']?.(), poolContract['liquidity']?.()])
    if (!slot0 || liquidity === undefined) {
      return null
    }
    const sqrtPriceX96: BigNumber = slot0.sqrtPriceX96
    if (sqrtPriceX96.isZero()) {
      return null
    }
    const pool = new Pool(tokenIn, tokenOut, fee, sqrtPriceX96.toString(), liquidity.toString(), slot0.tick)
    const quoteFnName = isExactInput ? 'quoteExactInputSingle' : 'quoteExactOutputSingle'
    const quoteFn = quoter.callStatic[quoteFnName]
    if (!quoteFn) {
      return null
    }
    const quoteResult = await quoteFn({
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      [isExactInput ? 'amountIn' : 'amount']: amount,
      fee,
      sqrtPriceLimitX96: 0,
    })
    const resultAmount = BigNumber.from(quoteResult[0])
    if (resultAmount.isZero()) {
      return null
    }
    console.log(`[SPXSwap] V3 ${pair} fee=${fee} pool=${address} result=${resultAmount.toString()}`)
    return {
      fee,
      address,
      pool,
      resultAmount,
      gasEstimate: BigNumber.from(quoteResult.gasEstimate ?? quoteResult[3] ?? 0),
    }
  } catch (err) {
    const pair = `${tokenIn.symbol ?? '?'}/${tokenOut.symbol ?? '?'}`
    console.log(`[SPXSwap] V3 ${pair} fee=${fee}: throw`, (err as Error).message)
    return null
  }
}

export async function quoteBestPair(args: {
  provider: JsonRpcProvider
  factory: Contract
  quoter: Contract
  tokenIn: Token
  tokenOut: Token
  amount: string
  isExactInput: boolean
}): Promise<PoolSnapshot | null> {
  const candidates = await Promise.all(FEE_TIERS.map((fee) => quoteOnFeeTier({ ...args, fee })))
  const filtered = candidates.filter((c): c is PoolSnapshot => c !== null)
  if (filtered.length === 0) {
    return null
  }
  // EXACT_INPUT: pick the tier giving the most output. EXACT_OUTPUT: pick the tier requiring the least input.
  const sorted = args.isExactInput
    ? filtered.sort((a, b) => (b.resultAmount.gt(a.resultAmount) ? 1 : -1))
    : filtered.sort((a, b) => (a.resultAmount.lt(b.resultAmount) ? -1 : 1))
  return sorted[0] ?? null
}

export function buildV3PoolInRoute(args: {
  snapshot: PoolSnapshot
  tokenIn: Token
  tokenOut: Token
  amountIn: string
  amountOut: string
}): TradingApi.V3PoolInRoute {
  const { snapshot, tokenIn, tokenOut, amountIn, amountOut } = args
  return {
    type: 'v3-pool',
    address: snapshot.address,
    tokenIn: {
      address: tokenIn.address,
      chainId: 1 as TradingApi.ChainId,
      symbol: tokenIn.symbol ?? '',
      decimals: tokenIn.decimals.toString(),
    },
    tokenOut: {
      address: tokenOut.address,
      chainId: 1 as TradingApi.ChainId,
      symbol: tokenOut.symbol ?? '',
      decimals: tokenOut.decimals.toString(),
    },
    sqrtRatioX96: snapshot.pool.sqrtRatioX96.toString(),
    liquidity: snapshot.pool.liquidity.toString(),
    tickCurrent: snapshot.pool.tickCurrent.toString(),
    fee: snapshot.fee.toString(),
    amountIn,
    amountOut,
  }
}
