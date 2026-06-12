interface UseShowPendingAfterDelayParams {
  hasPendingActivity: boolean
  hasL1PendingActivity: boolean
}

/**
 * Previously gated the pending indicator behind a 10s (L1) / 5s (L2) timer to
 * hide brief pending states on fast chains — but with ~12s mainnet blocks most
 * swaps confirmed before the timer fired, so users never saw the spinner at
 * all. Now we show the pending state immediately on submission; the anti-flicker
 * cost is a non-issue because the spinner is a calm loading state, not a
 * visual jolt.
 */
export function useShowPendingAfterDelay({ hasPendingActivity }: UseShowPendingAfterDelayParams): boolean {
  return hasPendingActivity
}
