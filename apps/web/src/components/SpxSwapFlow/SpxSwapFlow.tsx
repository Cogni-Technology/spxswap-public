import '~/components/SpxSwapFlow/SpxSwapFlow.css'
import { Flex, Text } from 'ui/src'
import { SwapFlow, type SwapFlowProps } from 'uniswap/src/features/transactions/swap/SwapFlow/SwapFlow'

/**
 * Cypherpunk chrome wrapping the shared Uniswap SwapFlow.
 *
 * Keeps all underlying logic — input/output token pickers, quote resolution via
 * onchainFetchQuote, Permit2 + Universal Router swap submission, the review
 * modal — unchanged. Only the outer visual layer is rewritten: terminal labels,
 * dashed gold border, corner brackets, monospace numerals, subtle scanlines.
 */
export function SpxSwapFlow(props: SwapFlowProps): JSX.Element {
  return (
    <Flex className="spx-swap-card-container" gap="$spacing8" width="100%" maxWidth={480}>
      <Flex row alignItems="center" px="$spacing4">
        <Text className="spx-term-label">[ SWAP :: EXEC ]</Text>
      </Flex>

      <Flex className="spx-swap-card">
        {/* oxlint-disable react/forbid-elements -- plain divs so CSS className modifiers apply cleanly */}
        <div className="spx-corner spx-corner-tl" />
        <div className="spx-corner spx-corner-tr" />
        <div className="spx-corner spx-corner-bl" />
        <div className="spx-corner spx-corner-br" />
        {/* oxlint-enable react/forbid-elements */}
        <Flex className="spx-swap-scanlines" />
        <Flex className="spx-swap-form-slot">
          <SwapFlow {...props} />
        </Flex>
      </Flex>

      <Flex row justifyContent="space-between" alignItems="center" px="$spacing4" gap="$spacing8">
        <Text className="spx-term-label spx-term-label-muted">&gt; mainnet :: v3 :: permit2</Text>
        <Text className="spx-term-label spx-term-label-muted">spx6900</Text>
      </Flex>
    </Flex>
  )
}
