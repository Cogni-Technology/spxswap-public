import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import ms from 'ms'
import { InterfaceEventName } from 'uniswap/src/features/telemetry/constants'
import { sendAnalyticsEvent } from 'uniswap/src/features/telemetry/send'
import { logSwapQuoteFetch } from 'uniswap/src/features/transactions/swap/analytics'
import { logger } from 'utilities/src/logger/logger'
import { getOnchainExactInputQuote } from '~/state/routing/onchainQuoter'
import {
  GetQuoteArgs,
  INTERNAL_ROUTER_PREFERENCE_PRICE,
  QuoteMethod,
  QuoteState,
  TradeResult,
  URAQuoteResponse,
  URAQuoteType,
} from '~/state/routing/types'
import { transformQuoteToTrade } from '~/state/routing/utils'

/**
 * SPXSwap client-side quote slice.
 *
 * Upstream hit the Uniswap Trading API over HTTP (CORS-locked to app.uniswap.org),
 * built a URAQuoteResponse, and piped it through transformQuoteToTrade. We read
 * pool state directly from chain via RPC_PROVIDERS and synthesize a URAQuoteResponse
 * with a single V3 classic route — the downstream ClassicTrade / swap-execution
 * path is unchanged.
 */
export const routingApi = createApi({
  reducerPath: 'routingApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (build) => ({
    getQuote: build.query<TradeResult, GetQuoteArgs>({
      // oxlint-disable-next-line max-params
      async queryFn(args) {
        logSwapQuoteFetch({
          chainId: args.tokenInChainId,
          isUSDQuote: args.routerPreference === INTERNAL_ROUTER_PREFERENCE_PRICE,
          quoteSource: 'routing_api',
        })

        try {
          const onchainResult = await getOnchainExactInputQuote(args)
          if (!onchainResult) {
            sendAnalyticsEvent(InterfaceEventName.NoQuoteReceivedFromRoutingAPI, {
              requestBody: { args },
              response: { onchain: 'no_route' },
              routerPreference: args.routerPreference,
            })
            return { data: { state: QuoteState.NOT_FOUND } }
          }

          const uraResponse: URAQuoteResponse = {
            routing: URAQuoteType.CLASSIC,
            quote: onchainResult.quoteData,
            allQuotes: [],
          }
          const tradeResult = await transformQuoteToTrade({
            args,
            data: uraResponse,
            quoteMethod: QuoteMethod.CLIENT_SIDE_FALLBACK,
          })
          return { data: { ...tradeResult } }
        } catch (error: unknown) {
          const err = error as { message?: string; detail?: string }
          logger.warn(
            'routing/slice',
            'queryFn',
            `GetQuote failed on client-side on-chain quoter: ${err.message ?? err.detail ?? String(error)}`,
          )
          return { data: { state: QuoteState.NOT_FOUND } }
        }
      },
      keepUnusedDataFor: ms(`10s`),
      extraOptions: {
        maxRetries: 0,
      },
    }),
  }),
})

export const {
  useGetQuoteQuery,
  util: { resetApiState: resetRoutingApi },
} = routingApi
export const useGetQuoteQueryState = routingApi.endpoints.getQuote.useQueryState
