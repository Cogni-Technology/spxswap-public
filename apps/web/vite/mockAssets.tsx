import React from 'react'

const createAssetModuleMock = (filename: string) => {
  const staticPath = `/static/${filename}`
  const extension = filename.split('.').pop()
  if (extension === 'svg') {
    const MockedSvgComponent = React.forwardRef(({ children, ..._props }: any, ref: any) => {
      return React.createElement('svg', { ref, 'data-testid': 'mocked-svg' }, children)
    })
    MockedSvgComponent.displayName = 'MockedSvgComponent'

    return {
      ReactComponent: MockedSvgComponent,
      default: staticPath,
    }
  }

  if (extension && ['json'].includes(extension)) {
    return { default: {} }
  }

  return { default: staticPath }
}

vi.mock('ui/src/assets/backgrounds/for-connecting-v2.svg', () => createAssetModuleMock('svg'))
vi.mock('ui/src/assets/logos/png/polygon-logo.png', () => createAssetModuleMock('png'))
vi.mock('ui/src/assets/logos/png/arbitrum-logo.png', () => createAssetModuleMock('png'))
vi.mock('ui/src/assets/logos/png/eth-logo.png', () => createAssetModuleMock('png'))
vi.mock('ui/src/assets/logos/png/ethereum-logo.png', () => createAssetModuleMock('png'))
vi.mock('ui/src/assets/graphics/unitag-light-small.png', () => createAssetModuleMock('png'))
vi.mock('~/assets/images/dropdown.svg', () => createAssetModuleMock('svg'))
vi.mock('~/assets/svg/search.svg', () => createAssetModuleMock('svg'))
vi.mock('~/assets/svg/expando-icon-closed.svg', () => createAssetModuleMock('svg'))
vi.mock('~/assets/svg/expando-icon-opened.svg', () => createAssetModuleMock('svg'))

vi.mock('ui/src/components/Unicon', () => ({
  Unicon: ({ ..._props }: any) => {
    return React.createElement('span', { 'data-testid': 'unicon' }, '🔵')
  },
}))

vi.mock('ui/src/assets', () => ({
  ALL_NETWORKS_LOGO: 'all-networks-logo.png',
  ETHEREUM_LOGO: 'ethereum-logo.png',
  OPTIMISM_LOGO: 'optimism-logo.png',
  ARBITRUM_LOGO: 'arbitrum-logo.png',
  BASE_LOGO: 'base-logo.png',
  BNB_LOGO: 'bnb-logo.png',
  MONAD_LOGO_FILLED: 'monad-logo-filled.png',
  POLYGON_LOGO: 'polygon-logo.png',
  BLAST_LOGO: 'blast-logo.png',
  AVALANCHE_LOGO: 'avalanche-logo.png',
  CELO_LOGO: 'celo-logo.png',
  WORLD_CHAIN_LOGO: 'world-chain-logo.png',
  ZORA_LOGO: 'zora-logo.png',
  ZKSYNC_LOGO: 'zksync-logo.png',
  SOLANA_LOGO: 'solana-logo.png',
  LINEA_LOGO: 'linea-logo.png',
  SONEIUM_LOGO: 'soneium-logo.png',
  TEMPO_LOGO: 'tempo-logo.png',
  XLAYER_LOGO: 'xlayer-logo.png',
  OKB_LOGO: 'okb-logo.png',
  UNICHAIN_LOGO: 'unichain-logo.png',
  UNICHAIN_SEPOLIA_LOGO: 'unichain-sepolia-logo.png',
  ETH_LOGO: 'eth-logo.png',
  UNITAG_DARK: 'unitag-dark.png',
  UNITAG_LIGHT: 'unitag-light.png',
  UNITAG_DARK_SMALL: 'unitag-dark-small.png',
  UNITAG_LIGHT_SMALL: 'unitag-light-small.png',
}))

// Add more asset mocks as needed
// This ensures all asset imports resolve to consistent static paths.
