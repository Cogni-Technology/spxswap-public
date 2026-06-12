import { Token } from '@uniswap/sdk-core'
import { GraphQLApi } from '@universe/api'
import { DAI_LOGO, ETH_LOGO, SPX6900_LOGO, USDC_LOGO, USDT_LOGO, WBTC_LOGO, WETH_LOGO } from 'ui/src/assets'
import { DAI, USDC, USDT, WBTC, WRAPPED_NATIVE_CURRENCY, nativeOnChain } from 'uniswap/src/constants/tokens'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { CurrencyInfo, SafetyInfo, TokenList } from 'uniswap/src/features/dataApi/types'
import { buildCurrencyInfo } from 'uniswap/src/features/dataApi/utils/buildCurrency'
import { currencyId } from 'uniswap/src/utils/currencyId'

// Verified via CoinGecko + Etherscan 2026-04-10: SPX6900, 8 decimals.
export const SPX6900_MAINNET_ADDRESS = '0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C'

export const SPX6900 = new Token(UniverseChainId.Mainnet, SPX6900_MAINNET_ADDRESS, 8, 'SPX', 'SPX6900')

const WETH_MAINNET_FALLBACK = new Token(
  UniverseChainId.Mainnet,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  18,
  'WETH',
  'Wrapped Ether',
)

export const WETH_MAINNET: Token = WRAPPED_NATIVE_CURRENCY[UniverseChainId.Mainnet] ?? WETH_MAINNET_FALLBACK

const SAFE_DEFAULT: SafetyInfo = {
  tokenList: TokenList.Default,
  protectionResult: GraphQLApi.ProtectionResult.Benign,
}

function toCurrencyInfo(currency: Token | ReturnType<typeof nativeOnChain>, logoUrl?: string): CurrencyInfo {
  return buildCurrencyInfo({
    currency,
    currencyId: currencyId(currency),
    logoUrl: logoUrl ?? null,
    safetyInfo: SAFE_DEFAULT,
  })
}

/**
 * Static curated token list for SPXSwap V1. Used wherever upstream hits the
 * Uniswap gateway for token metadata — we hard-code the set and bypass the
 * network call entirely. Mainnet-only for V1; other chains return empty.
 *
 * Logos are bundled assets (ui/src/assets) rather than remote URLs so the
 * IPFS build is fully self-contained — no third-party image hosts.
 */
export const SPX_MAINNET_CURRENCY_INFOS: CurrencyInfo[] = [
  toCurrencyInfo(nativeOnChain(UniverseChainId.Mainnet), ETH_LOGO),
  toCurrencyInfo(WETH_MAINNET, WETH_LOGO),
  toCurrencyInfo(USDC, USDC_LOGO),
  toCurrencyInfo(USDT, USDT_LOGO),
  toCurrencyInfo(DAI, DAI_LOGO),
  toCurrencyInfo(WBTC, WBTC_LOGO),
  toCurrencyInfo(SPX6900, SPX6900_LOGO),
]

export function filterSPXCurrencyInfos(query: string | null | undefined): CurrencyInfo[] {
  if (!query) {
    return SPX_MAINNET_CURRENCY_INFOS
  }
  const q = query.trim().toLowerCase()
  if (!q) {
    return SPX_MAINNET_CURRENCY_INFOS
  }
  return SPX_MAINNET_CURRENCY_INFOS.filter((info) => {
    const { currency } = info
    const symbol = currency.symbol?.toLowerCase() ?? ''
    const name = currency.name?.toLowerCase() ?? ''
    const address = currency.isToken ? currency.address.toLowerCase() : ''
    return symbol.includes(q) || name.includes(q) || address.includes(q)
  })
}
