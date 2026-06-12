import { GqlResult } from '@universe/api'
import { useMemo } from 'react'
import { SPX_MAINNET_CURRENCY_INFOS } from 'uniswap/src/constants/spxTokens'
import { CurrencyInfo } from 'uniswap/src/features/dataApi/types'
import { CurrencyId } from 'uniswap/src/types/currency'

/**
 * SPXSwap: upstream hit the GraphQL `tokenProjects` query for CurrencyInfo
 * metadata by currencyId. For V1 we don't have a GraphQL backend at all, so
 * we resolve lookups against the static curated list and return nothing for
 * unknown ids. Callers (useCurrencies, bridging hooks, etc.) handle the
 * empty-result case already.
 */
export function useTokenProjects(currencyIds: CurrencyId[]): GqlResult<CurrencyInfo[]> {
  const data = useMemo(() => {
    if (!currencyIds.length) {
      return []
    }
    const wanted = new Set(currencyIds.map((id) => id.toLowerCase()))
    return SPX_MAINNET_CURRENCY_INFOS.filter((info) => wanted.has(info.currencyId.toLowerCase()))
  }, [currencyIds])

  return {
    data,
    loading: false,
    error: undefined,
    refetch: (): void => {},
  }
}
