import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { CurrencyInfo } from 'uniswap/src/features/dataApi/types'

/**
 * SPXSwap: upstream called the TokenRankings REST service for trending tokens.
 * For V1 we expose no trending section — return empty. The "Trending" section
 * in TokenSelectorSwapList simply won't render.
 */
export function useTrendingTokensCurrencyInfos(
  _chainFilter: Maybe<UniverseChainId>,
  _skip?: boolean,
): {
  data: CurrencyInfo[] | undefined
  error: Error | undefined
  refetch: () => void
  loading: boolean
} {
  return { data: [], loading: false, error: undefined, refetch: (): void => {} }
}
