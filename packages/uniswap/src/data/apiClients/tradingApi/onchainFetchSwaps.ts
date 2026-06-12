import { JsonRpcProvider } from '@ethersproject/providers'
import { TradingApi } from '@universe/api'
import { config } from 'uniswap/src/config'

/**
 * SPXSwap on-chain fetchSwaps implementation.
 *
 * Upstream /swaps hits the Trading API to check the status of submitted swap
 * txs — that's how the "Pending" spinner resolves to "Success" after the tx
 * mines. We replace it with a direct receipt lookup via QuickNode so the UI
 * stays in sync with mainnet without needing the stubbed backend.
 */

let cachedProvider: JsonRpcProvider | null = null
function getMainnetProvider(): JsonRpcProvider {
  if (cachedProvider) {
    return cachedProvider
  }
  const name = config.quicknodeEndpointName
  const token = config.quicknodeEndpointToken
  if (!name || !token) {
    throw new Error('SPXSwap: QuickNode endpoint env vars missing — cannot poll tx status')
  }
  cachedProvider = new JsonRpcProvider(`https://${name}.quiknode.pro/${token}`, 1)
  return cachedProvider
}

export async function onchainFetchSwaps(params: {
  txHashes: string[]
  chainId: TradingApi.ChainId
}): Promise<TradingApi.GetSwapsResponse> {
  if (params.chainId !== 1) {
    // Non-mainnet not supported in V1; return NOT_FOUND so the poller keeps retrying.
    return {
      requestId: `spxswap-swaps-${Date.now()}`,
      swaps: params.txHashes.map((hash) => ({
        status: TradingApi.SwapStatus.NOT_FOUND,
        txHash: hash,
      })),
    }
  }

  const provider = getMainnetProvider()

  const swaps = await Promise.all(
    params.txHashes.map(async (hash) => {
      try {
        const receipt = await provider.getTransactionReceipt(hash)
        if (!receipt) {
          // Not yet mined — poller will retry.
          // eslint-disable-next-line no-console
          console.log(`[SPXSwap] fetchSwaps ${hash}: pending (no receipt yet)`)
          return { status: TradingApi.SwapStatus.PENDING, txHash: hash }
        }
        const status = receipt.status === 1 ? TradingApi.SwapStatus.SUCCESS : TradingApi.SwapStatus.FAILED
        // eslint-disable-next-line no-console
        console.log(`[SPXSwap] fetchSwaps ${hash}: ${status} (block ${receipt.blockNumber})`)
        return { status, txHash: hash }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`[SPXSwap] fetchSwaps ${hash}: error`, (err as Error).message)
        return { status: TradingApi.SwapStatus.PENDING, txHash: hash }
      }
    }),
  )

  return {
    requestId: `spxswap-swaps-${Date.now()}`,
    swaps,
  }
}
