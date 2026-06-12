import { Flex, Separator } from 'ui/src'
import { ElementName } from 'uniswap/src/features/telemetry/constants'
import { EmptyWalletCards } from '~/components/emptyWallet/EmptyWalletCards'

export const EmptyWallet = () => {
  return (
    <Flex gap="$spacing20">
      <Separator />
      <EmptyWalletCards receiveElementName={ElementName.EmptyStateReceive} />
    </Flex>
  )
}
