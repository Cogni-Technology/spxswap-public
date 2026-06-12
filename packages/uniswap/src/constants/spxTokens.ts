import { Token } from '@uniswap/sdk-core'
import { GraphQLApi } from '@universe/api'
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
 */
export const SPX_MAINNET_CURRENCY_INFOS: CurrencyInfo[] = [
  toCurrencyInfo(
    nativeOnChain(UniverseChainId.Mainnet),
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  ),
  toCurrencyInfo(
    WETH_MAINNET,
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  ),
  toCurrencyInfo(
    USDC,
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  ),
  toCurrencyInfo(
    USDT,
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
  ),
  toCurrencyInfo(
    DAI,
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
  ),
  toCurrencyInfo(
    WBTC,
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  ),
  toCurrencyInfo(SPX6900, 'https://assets.coingecko.com/coins/images/31401/standard/sticker_%281%29.jpg'),
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
