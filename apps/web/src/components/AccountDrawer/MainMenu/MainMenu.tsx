import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useTranslation } from 'react-i18next'
import { Button, Flex, Text } from 'ui/src'
import { useActiveAddresses } from 'uniswap/src/features/accounts/store/hooks'
import AuthenticatedHeader from '~/components/AccountDrawer/AuthenticatedHeader'
import { useConnectionStatus } from '~/features/accounts/store/hooks'

export function MainMenu() {
  const addresses = useActiveAddresses()
  const { openConnectModal } = useConnectModal()
  const { t } = useTranslation()

  const { isConnected } = useConnectionStatus()

  if (!isConnected) {
    return (
      <Flex centered gap="$spacing16" p="$spacing24">
        <Text variant="subheading1">{t('common.connectWallet.button')}</Text>
        <Button variant="branded" emphasis="primary" onPress={() => openConnectModal?.()}>
          {t('common.connect.button')}
        </Button>
      </Flex>
    )
  }

  return <AuthenticatedHeader {...addresses} />
}
