/**
 * SPXSwap: reliable, keyless, CORS-enabled public mainnet RPC endpoints.
 *
 * These are used as the browser-facing read RPCs whenever QuickNode is not
 * configured (and as failover when it is), so the swap UI can read wallet
 * balances, quotes, and tx status without a private RPC key or central point
 * of failure.
 *
 * Every entry was verified to:
 *   - answer eth_call / eth_getBalance / eth_blockNumber over HTTPS, and
 *   - return permissive CORS on BOTH the preflight (OPTIONS) and the POST
 *     (Access-Control-Allow-Origin: * or a reflected Origin, and
 *     Access-Control-Allow-Headers: content-type) — required because viem's
 *     http transport sends `Content-Type: application/json`, which triggers a
 *     CORS preflight in the browser.
 *
 * Ordered by observed reliability/latency. The previous default
 * (https://rpc.ankr.com/eth) was dropped because its keyless endpoint now
 * returns empty/200 responses and is effectively dead.
 *
 * This file intentionally has NO imports so it can be shared by both the
 * chains feature (info/mainnet.ts) and the trading data layer
 * (data/apiClients/tradingApi/utils/mainnetProvider.ts) without creating a
 * circular dependency between them.
 */
export const PUBLIC_MAINNET_RPC_URLS: readonly string[] = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://eth-mainnet.public.blastapi.io',
  'https://eth.merkle.io',
]
