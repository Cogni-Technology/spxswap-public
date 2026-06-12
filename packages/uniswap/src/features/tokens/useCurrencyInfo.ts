import { GqlResult } from '@universe/api'
import { useMemo } from 'react'
import { getCommonBase } from 'uniswap/src/constants/routing'
import { SPX_MAINNET_CURRENCY_INFOS } from 'uniswap/src/constants/spxTokens'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { CurrencyInfo } from 'uniswap/src/features/dataApi/types'
import {
  buildNativeCurrencyId,
  buildWrappedNativeCurrencyId,
  currencyIdToAddress,
  currencyIdToChain,
} from 'uniswap/src/utils/currencyId'

/**
 * SPXSwap: every call into this module used to hit the GraphQL token / tokens
 * queries. We resolve against the static curated list + the existing
 * `getCommonBase` helper and return nothing for unknown ids — there is no
 * network fallback in V1.
 */

function findStaticCurrencyInfo(_currencyId?: string): Maybe<CurrencyInfo> {
  if (!_currencyId) {
    return undefined
  }
  const target = _currencyId.toLowerCase()
  const fromStatic = SPX_MAINNET_CURRENCY_INFOS.find((info) => info.currencyId.toLowerCase() === target)
  if (fromStatic) {
    return fromStatic
  }

  const chainId = currencyIdToChain(_currencyId)
  let address: Address | undefined
  try {
    address = currencyIdToAddress(_currencyId)
  } catch (_error) {
    return undefined
  }
  if (!chainId || !address) {
    return undefined
  }
  const commonBase = getCommonBase(chainId, address)
  if (commonBase) {
    return { ...commonBase, currencyId: _currencyId }
  }
  return undefined
}

export function useCurrencyInfo(
  _currencyId?: string,
  _options?: { refetch?: boolean; skip?: boolean },
): Maybe<CurrencyInfo> {
  return useMemo(() => findStaticCurrencyInfo(_currencyId), [_currencyId])
}

export function useCurrencyInfoWithLoading(
  _currencyId?: string,
  _options?: { refetch?: boolean; skip?: boolean },
): {
  currencyInfo: Maybe<CurrencyInfo>
  loading: boolean
  error?: Error
} {
  const currencyInfo = useMemo(() => findStaticCurrencyInfo(_currencyId), [_currencyId])
  return { currencyInfo, loading: false, error: undefined }
}

export function useCurrencyInfos(
  _currencyIds: string[],
  _options?: { refetch?: boolean; skip?: boolean },
): Maybe<CurrencyInfo>[] {
  return useMemo(() => _currencyIds.map((id) => findStaticCurrencyInfo(id)), [_currencyIds])
}

export function useCurrencyInfosWithLoading(
  _currencyIds: string[],
  _options?: { refetch?: boolean; skip?: boolean },
): GqlResult<CurrencyInfo[]> {
  const data = useMemo(
    () => _currencyIds.map((id) => findStaticCurrencyInfo(id)).filter((c): c is CurrencyInfo => !!c),
    [_currencyIds],
  )
  return useMemo(() => ({ data, loading: false, error: undefined, refetch: (): void => {} }), [data])
}

export function useNativeCurrencyInfo(chainId: UniverseChainId): Maybe<CurrencyInfo> {
  const nativeCurrencyId = buildNativeCurrencyId(chainId)
  return useCurrencyInfo(nativeCurrencyId)
}

export function useWrappedNativeCurrencyInfo(chainId: UniverseChainId): Maybe<CurrencyInfo> {
  const wrappedCurrencyId = buildWrappedNativeCurrencyId(chainId)
  return useCurrencyInfo(wrappedCurrencyId)
}
