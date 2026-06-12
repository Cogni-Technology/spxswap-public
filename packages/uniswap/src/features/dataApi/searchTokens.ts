import { GqlResult } from '@universe/api'
import { useCallback, useMemo } from 'react'
import { SPX_MAINNET_CURRENCY_INFOS, filterSPXCurrencyInfos } from 'uniswap/src/constants/spxTokens'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { CurrencyInfo, MultichainSearchResult } from 'uniswap/src/features/dataApi/types'
import { isWSOL } from 'uniswap/src/utils/isWSOL'

/**
 * SPXSwap: upstream hit `uniswapPostTransport` (SearchTokensAndPools REST service)
 * for every keystroke. We ship a static curated mainnet list instead and do local
 * substring filtering — no network calls, works offline from the gateway.
 */
export function useSearchTokens({
  searchQuery,
  chainFilter,
  skip,
  hideWSOL = false,
}: {
  searchQuery: string | null
  chainFilter: UniverseChainId | null
  skip: boolean
  size?: number
  hideWSOL?: boolean
}): GqlResult<CurrencyInfo[]> {
  const data = useMemo(() => {
    if (skip) {
      return []
    }
    const base = filterSPXCurrencyInfos(searchQuery)
    const chainFiltered = chainFilter && chainFilter !== UniverseChainId.Mainnet ? [] : base
    return hideWSOL ? chainFiltered.filter((c) => !isWSOL(c.currency)) : chainFiltered
  }, [searchQuery, chainFilter, skip, hideWSOL])

  const refetch = useCallback(() => {}, [])

  return useMemo(() => ({ data, loading: false, error: undefined, refetch }), [data, refetch])
}

export function useMultichainSearchTokens({
  searchQuery,
  chainFilter,
  skip,
}: {
  searchQuery: string | null
  chainFilter: UniverseChainId | null
  skip: boolean
  size?: number
}): GqlResult<MultichainSearchResult[]> {
  const data = useMemo<MultichainSearchResult[]>(() => {
    if (skip) {
      return []
    }
    if (chainFilter && chainFilter !== UniverseChainId.Mainnet) {
      return []
    }
    const filtered = filterSPXCurrencyInfos(searchQuery)
    return filtered.map((info) => ({
      id: info.currencyId,
      name: info.currency.name ?? info.currency.symbol ?? '',
      symbol: info.currency.symbol ?? '',
      logoUrl: info.logoUrl ?? null,
      safetyInfo: info.safetyInfo,
      tokens: [info],
    }))
  }, [searchQuery, chainFilter, skip])

  const refetch = useCallback(() => {}, [])

  return useMemo(() => ({ data, loading: false, error: undefined, refetch }), [data, refetch])
}

// Preserve the re-export for any call site that imports the raw list.
export { SPX_MAINNET_CURRENCY_INFOS as STATIC_SEARCHABLE_TOKENS }
