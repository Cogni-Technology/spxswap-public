import { GqlResult } from '@universe/api'
import { useMemo } from 'react'
import { SPX_MAINNET_CURRENCY_INFOS } from 'uniswap/src/constants/spxTokens'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import { CurrencyInfo } from 'uniswap/src/features/dataApi/types'

/**
 * SPXSwap: upstream called TokenProjects GraphQL to populate the "common base"
 * token pills. We ship a hard-coded list for mainnet instead, so the selector
 * works completely offline from the Uniswap gateway.
 */
export function useAllCommonBaseCurrencies(): GqlResult<CurrencyInfo[]> {
  const { isTestnetModeEnabled } = useEnabledChains()
  const data = useMemo(() => (isTestnetModeEnabled ? [] : SPX_MAINNET_CURRENCY_INFOS), [isTestnetModeEnabled])
  return { data, loading: false, error: undefined, refetch: (): void => {} }
}
