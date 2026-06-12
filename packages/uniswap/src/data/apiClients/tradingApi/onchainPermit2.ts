/* eslint-disable no-console -- diagnostic logs for the on-chain permit path */
import { BigNumber } from '@ethersproject/bignumber'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
  AllowanceProvider,
  AllowanceTransfer,
  MaxAllowanceTransferAmount,
  PERMIT2_ADDRESS,
  type PermitSingle,
} from '@uniswap/permit2-sdk'
import { UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from '@uniswap/universal-router-sdk'
import { TradingApi } from '@universe/api'

// 30 days in seconds. Upstream Trading API uses a 30-day rolling window: if
// the existing Permit2 allowance expires within this window, we sign a fresh
// PermitSingle rather than reusing the old one. Keeps swap UX stable without
// forcing users to re-permit on every trade.
const PERMIT_EXPIRATION_WINDOW_SECONDS = 30 * 24 * 60 * 60
// 30 minutes — the sigDeadline for the EIP-712 signature itself (distinct from
// the permit's on-chain expiration). After this, the signature cannot be used.
const PERMIT_SIG_DEADLINE_SECONDS = 30 * 60

/**
 * Checks the user's existing Permit2 allowance to the Universal Router for `tokenAddress`
 * and, if insufficient (amount too low or expiration too close), generates a fresh
 * PermitSingle + EIP-712 typed data payload the UI will sign before submitting the swap.
 * Returns `undefined` when the existing allowance already covers this swap — in that
 * case no signature is needed and the UR will just call Permit2.transferFrom at swap time.
 */
export async function buildPermitDataIfNeeded(args: {
  provider: JsonRpcProvider
  tokenAddress: string
  owner: string
  amount: string
}): Promise<TradingApi.NullablePermit | undefined> {
  const { provider, tokenAddress, owner, amount } = args
  const universalRouter = UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V1_2, 1)
  const allowanceProvider = new AllowanceProvider(provider, PERMIT2_ADDRESS)
  const {
    amount: currentAmount,
    nonce,
    expiration,
  } = await allowanceProvider.getAllowanceData(tokenAddress, owner, universalRouter)

  const nowSec = Math.floor(Date.now() / 1000)
  const needsAmount = currentAmount.lt(BigNumber.from(amount))
  const needsExpiration = expiration < nowSec + PERMIT_EXPIRATION_WINDOW_SECONDS

  if (!needsAmount && !needsExpiration) {
    console.log(
      `[SPXSwap] Permit2 allowance OK: token=${tokenAddress} allowance=${currentAmount.toString()} exp=${expiration}`,
    )
    return undefined
  }

  const permit: PermitSingle = {
    details: {
      token: tokenAddress,
      amount: MaxAllowanceTransferAmount.toString(),
      expiration: (nowSec + PERMIT_EXPIRATION_WINDOW_SECONDS).toString(),
      nonce: nonce.toString(),
    },
    spender: universalRouter,
    sigDeadline: (nowSec + PERMIT_SIG_DEADLINE_SECONDS).toString(),
  }

  const typed = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1)
  console.log(
    `[SPXSwap] Permit2 signing needed: token=${tokenAddress} nonce=${nonce} needsAmount=${needsAmount} needsExpiration=${needsExpiration}`,
  )

  // TradingApi.Permit has a loose shape ({domain, types, values} as Records),
  // so we cast the SDK's typed data into it.
  return {
    domain: typed.domain,
    types: typed.types,
    values: typed.values,
  } as unknown as TradingApi.NullablePermit
}
