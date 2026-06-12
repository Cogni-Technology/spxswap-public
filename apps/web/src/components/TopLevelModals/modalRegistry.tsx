import { memo, Suspense } from 'react'
import { ModalName, ModalNameType } from 'uniswap/src/features/telemetry/constants'
import { logger } from 'utilities/src/logger/logger'
import ErrorBoundary from '~/components/ErrorBoundary'
import { ModalRegistry, ModalWrapperProps } from '~/components/TopLevelModals/types'
import { useModalState } from '~/hooks/useModalState'
import { useAppSelector } from '~/state/hooks'
import { createLazy } from '~/utils/lazyWithRetry'

const AddressClaimModal = createLazy(() => import('~/components/claim/AddressClaimModal'))
const ConnectedAccountBlocked = createLazy(() => import('~/components/ConnectedAccountBlocked'))
const OffchainActivityModal = createLazy(() =>
  import('~/components/AccountDrawer/MiniPortfolio/Activity/OffchainActivityModal').then((module) => ({
    default: module.OffchainActivityModal,
  })),
)
const TransactionDetailsModalDispatcher = createLazy(() =>
  import('~/components/TopLevelModals/TransactionDetailsModalDispatcher').then((module) => ({
    default: module.TransactionDetailsModalDispatcher,
  })),
)
const UkDisclaimerModal = createLazy(() =>
  import('~/components/TopLevelModals/UkDisclaimerModal').then((module) => ({ default: module.UkDisclaimerModal })),
)
const TestnetModeModal = createLazy(() =>
  import('uniswap/src/features/testnets/TestnetModeModal').then((module) => ({ default: module.TestnetModeModal })),
)
const PrivacyPolicyModal = createLazy(() =>
  import('~/components/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicyModal })),
)
const PrivacyChoicesModal = createLazy(() =>
  import('~/components/PrivacyChoices').then((module) => ({ default: module.PrivacyChoicesModal })),
)
const FeatureFlagModal = createLazy(() => import('~/components/FeatureFlagModal/FeatureFlagModal'))
const DevFlagsBox = createLazy(() => import('~/dev/DevFlagsBox'))
const TokenNotFoundModal = createLazy(() => import('~/components/NotFoundModal/TokenNotFoundModal'))
const PoolNotFoundModal = createLazy(() => import('~/components/NotFoundModal/PoolNotFoundModal'))

const DelegationMismatchModal = createLazy(() =>
  import('~/components/delegation/DelegationMismatchModal').then((module) => ({
    default: module.default,
  })),
)
const HelpModal = createLazy(() =>
  import('~/components/HelpModal/HelpModal').then((module) => ({ default: module.HelpModal })),
)

const ReceiveCryptoModal = createLazy(() =>
  import('~/components/ReceiveCryptoModal').then((module) => ({ default: module.ReceiveCryptoModal })),
)

const BridgedAssetModal = createLazy(() =>
  import('uniswap/src/components/BridgedAsset/BridgedAssetModal').then((module) => ({
    default: module.BridgedAssetModal,
  })),
)

const WormholeModal = createLazy(() =>
  import('uniswap/src/components/BridgedAsset/WormholeModal').then((module) => ({
    default: module.WormholeModal,
  })),
)

const ReportTokenModal = createLazy(() =>
  import('uniswap/src/components/reporting/ReportTokenIssueModal').then((module) => ({
    default: module.ReportTokenIssueModal,
  })),
)
function ModalLoadingFallback(): null {
  return null
}

function ModalErrorFallback({ error }: { error: Error }): null {
  logger.error(error, {
    tags: {
      file: 'modalRegistry',
      function: 'ModalErrorFallback',
    },
    extra: {
      message: 'Modal failed to load - error caught by ErrorBoundary. Modal will not be displayed.',
    },
  })
  return null
}

const ModalWrapper = memo(({ Component, componentProps }: ModalWrapperProps) => (
  <ErrorBoundary fallback={ModalErrorFallback}>
    <Suspense fallback={<ModalLoadingFallback />}>
      <Component {...componentProps} />
    </Suspense>
  </ErrorBoundary>
))
ModalWrapper.displayName = 'ModalWrapper'

export const modalRegistry: ModalRegistry = {
  [ModalName.AddressClaim]: {
    component: AddressClaimModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.AddressClaim,
  },
  [ModalName.BlockedAccount]: {
    component: ConnectedAccountBlocked,
    shouldMount: (state) => state.application.openModal?.name === ModalName.BlockedAccount,
  },
  [ModalName.OffchainActivity]: {
    component: OffchainActivityModal,
    shouldMount: () => true,
  },
  [ModalName.TransactionDetails]: {
    component: TransactionDetailsModalDispatcher,
    shouldMount: () => true,
  },
  [ModalName.UkDisclaimer]: {
    component: UkDisclaimerModal,
    shouldMount: () => true,
  },
  [ModalName.TestnetMode]: {
    component: TestnetModeModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.TestnetMode,
  },
  [ModalName.PrivacyPolicy]: {
    component: PrivacyPolicyModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.PrivacyPolicy,
  },
  [ModalName.PrivacyChoices]: {
    component: PrivacyChoicesModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.PrivacyChoices,
  },
  [ModalName.FeatureFlags]: {
    component: FeatureFlagModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.FeatureFlags,
  },
  [ModalName.TokenNotFound]: {
    component: TokenNotFoundModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.TokenNotFound,
  },
  [ModalName.PoolNotFound]: {
    component: PoolNotFoundModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.PoolNotFound,
  },
  [ModalName.DevFlags]: {
    component: DevFlagsBox,
    shouldMount: () => true,
  },
  [ModalName.DelegationMismatch]: {
    component: DelegationMismatchModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.DelegationMismatch,
  },
  [ModalName.Help]: {
    component: HelpModal,
    shouldMount: () => false, // Hidden for V1 — re-enable when SPXSwap has its own help content
  },
  [ModalName.ReceiveCryptoModal]: {
    component: ReceiveCryptoModal,
    shouldMount: () => true,
  },
  [ModalName.BridgedAsset]: {
    component: BridgedAssetModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.BridgedAsset,
  },
  [ModalName.Wormhole]: {
    component: WormholeModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.Wormhole,
  },
  [ModalName.ReportTokenIssue]: {
    component: ReportTokenModal,
    shouldMount: (state) => state.application.openModal?.name === ModalName.ReportTokenIssue,
  },
} as const

export const ModalRenderer = ({
  modalName,
  componentProps,
}: {
  modalName: ModalNameType
  componentProps?: Record<string, any>
}) => {
  const state = useAppSelector((state) => state)
  const modalState = useModalState(modalName)

  const config = modalRegistry[modalName]
  if (!config) {
    return null
  }

  const { component: Component, shouldMount } = config

  if (!shouldMount(state)) {
    return null
  }

  return <ModalWrapper Component={Component} componentProps={{ ...componentProps, ...modalState }} />
}
