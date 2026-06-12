import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import type { getChainInfo } from 'uniswap/src/features/chains/chainInfo'
import { ORDERED_EVM_CHAINS } from 'uniswap/src/features/chains/chainInfo'
import { isTestnetChain } from 'uniswap/src/features/chains/utils'
import { createObservableTransport } from 'uniswap/src/features/providers/observability/createObservableTransport'
import { getRpcObserver } from 'uniswap/src/features/providers/observability/rpcObserver'
import { isPlaywrightEnv } from 'utilities/src/environment/env'
import { logger } from 'utilities/src/logger/logger'
import { getNonEmptyArrayOrThrow } from 'utilities/src/primitives/array'
import type { Chain } from 'viem'
import { createClient } from 'viem'
import type { Config } from 'wagmi'
import { createConfig, fallback, http } from 'wagmi'
import { PLAYWRIGHT_CONNECT_ADDRESS } from '~/components/Web3Provider/constants'
import { createRejectableMockConnector } from '~/components/Web3Provider/rejectableConnector'

// Only accept Safe Apps SDK messages from the canonical Safe web app.
// Tested against bypass patterns in wagmiConfig.test.ts.
export const SAFE_ALLOWED_ORIGIN = /^https:\/\/app\.safe\.global$/

if (process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID === undefined) {
  throw new Error('REACT_APP_WALLET_CONNECT_PROJECT_ID must be a defined environment variable')
}
const WALLET_CONNECT_PROJECT_ID: string = process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID

export const orderedTransportUrls = (chain: ReturnType<typeof getChainInfo>): string[] => {
  const orderedRpcUrls = [
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    ...(chain.rpcUrls.interface?.http ?? []),
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    ...(chain.rpcUrls.default?.http ?? []),
    ...(chain.rpcUrls.public?.http ?? []),
    ...(chain.rpcUrls.fallback?.http ?? []),
  ]

  return Array.from(new Set(orderedRpcUrls.filter(Boolean)))
}

function createWagmiConnectors(params: {
  /** If `true`, appends the wagmi `mock` connector. Used in Playwright. */
  includeMockConnector: boolean
}) {
  const { includeMockConnector } = params

  const rainbowKitConnectors = connectorsForWallets(
    [
      {
        groupName: 'Popular',
        wallets: [metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet],
      },
      {
        groupName: 'Other',
        wallets: [injectedWallet, safeWallet],
      },
    ],
    {
      appName: 'SPXSwap',
      projectId: WALLET_CONNECT_PROJECT_ID,
      appDescription: 'SPX6900 swap interface',
      appUrl: 'https://spxswap.eth.limo',
      walletConnectParameters: {
        metadata: {
          name: 'SPXSwap',
          description: 'SPX6900 swap interface',
          url: 'https://spxswap.eth.limo',
          icons: [],
        },
      },
    },
  )

  return includeMockConnector
    ? [
        ...rainbowKitConnectors,
        createRejectableMockConnector({
          features: {},
          accounts: [PLAYWRIGHT_CONNECT_ADDRESS],
        }),
      ]
    : rainbowKitConnectors
}

function createWagmiConfig(params: {
  /** The connector list to use. */
  connectors: ReturnType<typeof createWagmiConnectors>
  /** Optional custom `onFetchResponse` handler – defaults to `defaultOnFetchResponse`. */
  // oxlint-disable-next-line max-params -- biome-parity: oxlint is stricter here
  onFetchResponse?: (response: Response, chain: Chain, url: string) => void
}): Config<typeof ORDERED_EVM_CHAINS> {
  const { connectors, onFetchResponse = defaultOnFetchResponse } = params

  return createConfig({
    chains: getNonEmptyArrayOrThrow(ORDERED_EVM_CHAINS),
    connectors,
    client({ chain }) {
      return createClient({
        chain,
        batch: { multicall: true },
        pollingInterval: 12_000,
        transport: fallback(
          orderedTransportUrls(chain).map((url) =>
            createObservableTransport({
              baseTransportFactory: http(url, {
                onFetchResponse: (response) => onFetchResponse(response, chain, url),
              }),
              observer: getRpcObserver(),
              meta: { chainId: chain.id, url },
            }),
          ),
        ),
      })
    },
  })
}

// oxlint-disable-next-line max-params
const defaultOnFetchResponse = (response: Response, chain: Chain, url: string) => {
  if (response.status !== 200) {
    const message = `RPC provider returned non-200 status: ${response.status}`

    // only warn for testnet chains
    if (isTestnetChain(chain.id)) {
      logger.warn('wagmiConfig.ts', 'client', message, {
        extra: {
          chainId: chain.id,
          url,
        },
      })
    } else {
      // log errors for mainnet chains so we can fix them
      logger.error(new Error(message), {
        extra: {
          chainId: chain.id,
          url,
        },
        tags: {
          file: 'wagmiConfig.ts',
          function: 'client',
        },
      })
    }
  }
}

const defaultConnectors = createWagmiConnectors({
  includeMockConnector: isPlaywrightEnv(),
})

export const wagmiConfig = createWagmiConfig({ connectors: defaultConnectors })

declare module 'wagmi' {
  interface Register {
    // oxlint-disable-next-line typescript/consistent-type-imports
    config: typeof wagmiConfig
  }
}
