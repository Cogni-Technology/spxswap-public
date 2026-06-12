import { GqlResult, TradingApi } from '@universe/api'
import { TokenOption } from 'uniswap/src/components/lists/items/types'
import { type PortfolioBalancesResult } from 'uniswap/src/components/TokenSelector/hooks/usePortfolioBalancesForAddressById'
import { TradeableAsset } from 'uniswap/src/entities/assets'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { CurrencyInfo, PortfolioBalance } from 'uniswap/src/features/dataApi/types'

export function useBridgingTokenWithHighestBalance(_args: {
  evmAddress?: Address
  svmAddress?: Address
  currencyAddress: Address
  currencyChainId: UniverseChainId
}): {
  data:
    | {
        token: TradingApi.GetSwappableTokensResponse['tokens'][number]
        balance: PortfolioBalance
        currencyInfo: CurrencyInfo
      }
    | undefined
  isLoading: boolean
} {
  // SPXSwap: bridging is out of scope for V1 (single-chain swap only). Short-circuit
  // to avoid the GraphQL tokenProjects round-trip that the upstream implementation
  // depended on — it's CORS-locked and we've stubbed it anyway.
  return { data: undefined, isLoading: false }
}

export function useBridgingTokensOptions(_args: {
  oppositeSelectedToken: TradeableAsset | undefined
  chainFilter: UniverseChainId | null
  portfolioData: PortfolioBalancesResult
}): GqlResult<TokenOption[] | undefined> & { shouldNest?: boolean } {
  // SPXSwap V1: no cross-chain bridging tokens surfaced in the selector.
  return {
    data: undefined,
    loading: false,
    error: undefined,
    refetch: (): void => {},
    shouldNest: false,
  }
}
