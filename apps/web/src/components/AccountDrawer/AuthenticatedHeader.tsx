import { FeatureFlags, useFeatureFlag } from '@universe/gating'
import { useState } from 'react'
import { Flex, Separator, Text } from 'ui/src'
import { TestnetModeBanner } from 'uniswap/src/components/banners/TestnetModeBanner'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { useHasAccountMismatchOnAnyChain } from 'uniswap/src/features/smartWallet/mismatch/hooks'
import { ExplorerDataType, getExplorerLink } from 'uniswap/src/utils/linking'
import { MultiBlockchainAddressDisplay } from '~/components/AccountDetails/MultiBlockchainAddressDisplay'
import { DisconnectButton } from '~/components/AccountDrawer/DisconnectButton'
import { LimitedSupportBanner } from '~/components/Banner/LimitedSupportBanner'
import DelegationMismatchModal from '~/components/delegation/DelegationMismatchModal'
import { ExternalLink } from '~/theme/components/Links'
import { ThemeToggleWithLabel } from '~/theme/components/ThemeToggle'

export default function AuthenticatedHeader({ evmAddress }: { evmAddress?: string; svmAddress?: string }) {
  const isDelegationMismatch = useHasAccountMismatchOnAnyChain()
  const isPermitMismatchUxEnabled = useFeatureFlag(FeatureFlags.EnablePermitMismatchUX)
  const shouldShowDelegationMismatch = isPermitMismatchUxEnabled && isDelegationMismatch
  const [displayDelegationMismatchModal, setDisplayDelegationMismatchModal] = useState(false)

  const explorerUrl = evmAddress
    ? getExplorerLink({ chainId: UniverseChainId.Mainnet, data: evmAddress, type: ExplorerDataType.ADDRESS })
    : undefined

  return (
    <>
      <Flex flex={1} px="$padding16" py="$spacing20" gap="$spacing16">
        <TestnetModeBanner mt={-20} mx={-24} mb="$spacing16" />
        <Flex row justifyContent="space-between" alignItems="flex-start">
          <img
            src="/images/spx6900.png"
            alt="SPX6900"
            width={48}
            height={48}
            style={{
              display: 'block',
              borderRadius: '50%',
              filter: 'drop-shadow(0 0 16px rgba(212, 160, 23, 0.35))',
            }}
          />
          <DisconnectButton />
        </Flex>
        <Flex gap="$spacing8">
          <MultiBlockchainAddressDisplay />
          {explorerUrl && (
            <ExternalLink href={explorerUrl} style={{ textDecoration: 'none' }}>
              <Text variant="body4" color="$neutral3">
                View on Etherscan ↗
              </Text>
            </ExternalLink>
          )}
        </Flex>
        {shouldShowDelegationMismatch && (
          <LimitedSupportBanner onPress={() => setDisplayDelegationMismatchModal(true)} />
        )}
        <Separator />
        <ThemeToggleWithLabel />
      </Flex>
      {displayDelegationMismatchModal && (
        <DelegationMismatchModal onClose={() => setDisplayDelegationMismatchModal(false)} />
      )}
    </>
  )
}
