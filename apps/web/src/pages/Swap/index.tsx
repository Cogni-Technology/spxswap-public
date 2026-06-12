import type { Currency } from '@uniswap/sdk-core'
import { FeatureFlags, useFeatureFlag } from '@universe/gating'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router'
import { Flex, styled, Text, Tooltip } from 'ui/src'
import { zIndexes } from 'ui/src/theme'
import { useUniswapContext } from 'uniswap/src/contexts/UniswapContext'
import { useIsModeMismatch } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { useGetPasskeyAuthStatus } from 'uniswap/src/features/passkey/hooks/useGetPasskeyAuthStatus'
import { WebFORNudgeProvider } from 'uniswap/src/features/providers/webForNudgeProvider'
import { InterfacePageName } from 'uniswap/src/features/telemetry/constants'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { SwapTransactionSettingsStoreContextProvider } from 'uniswap/src/features/transactions/components/settings/stores/transactionSettingsStore/SwapTransactionSettingsStoreContextProvider'
import type {
  PasskeyAuthStatus,
  SwapRedirectFn,
} from 'uniswap/src/features/transactions/components/TransactionModal/TransactionModalContext'
import { useSwapPrefilledState } from 'uniswap/src/features/transactions/swap/form/hooks/useSwapPrefilledState'
import { selectFilteredChainIds } from 'uniswap/src/features/transactions/swap/state/selectors'
import { SwapDependenciesStoreContextProvider } from 'uniswap/src/features/transactions/swap/stores/swapDependenciesStore/SwapDependenciesStoreContextProvider'
import { SwapFormStoreContextProvider } from 'uniswap/src/features/transactions/swap/stores/swapFormStore/SwapFormStoreContextProvider'
import type { SwapFormState } from 'uniswap/src/features/transactions/swap/stores/swapFormStore/types'
import { currencyToAsset } from 'uniswap/src/features/transactions/swap/utils/asset'
import { TransactionState } from 'uniswap/src/features/transactions/types/transactionState'
import { CurrencyField } from 'uniswap/src/types/currency'
import { isMobileWeb } from 'utilities/src/platform'
import { noop } from 'utilities/src/react/noop'
import { PrefetchBalancesWrapper } from '~/appGraphql/data/apollo/AdaptiveTokenBalancesProvider'
import { useAccountDrawer } from '~/components/AccountDrawer/MiniPortfolio/hooks'
import { SpxSwapFlow } from '~/components/SpxSwapFlow/SpxSwapFlow'
import { PageWrapper } from '~/components/swap/styled'
import { SwapBottomCard } from '~/components/SwapBottomCard'
import { useAccount } from '~/hooks/useAccount'
import { useResetOverrideOneClickSwapFlag } from '~/pages/Swap/settings/OneClickSwap'
import { useWebSwapSettings } from '~/pages/Swap/settings/useWebSwapSettings'
import { MultichainContextProvider } from '~/state/multichain/MultichainContext'
import { useSwapHandlers } from '~/state/sagas/transactions/useSwapHandlers'
import { useInitialCurrencyState } from '~/state/swap/hooks'
import { SwapAndLimitContextProvider } from '~/state/swap/SwapContext'
import type { CurrencyState } from '~/state/swap/types'

export default function SwapPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // (WEB-4737): Remove this line after completing A/A Test on Web
  useFeatureFlag(FeatureFlags.AATestWeb)

  const accountDrawer = useAccountDrawer()

  const {
    initialInputCurrency,
    initialOutputCurrency,
    initialInputChainId,
    initialOutputChainId,
    initialTypedValue,
    initialField,
    triggerConnect,
  } = useInitialCurrencyState()

  useEffect(() => {
    if (triggerConnect) {
      accountDrawer.open()
      navigate(location.pathname, { replace: true })
    }
  }, [accountDrawer, triggerConnect, navigate, location.pathname])

  return (
    <Trace logImpression page={InterfacePageName.SwapPage}>
      <PageWrapper>
        <WebFORNudgeProvider>
          <Swap
            initialInputChainId={initialInputChainId}
            initialInputCurrency={initialInputCurrency}
            initialOutputCurrency={initialOutputCurrency}
            initialOutputChainId={initialOutputChainId}
            initialTypedValue={initialTypedValue}
            initialIndependentField={initialField}
            usePersistedFilteredChainIds
          />
        </WebFORNudgeProvider>
      </PageWrapper>
    </Trace>
  )
}

function getFilteredChainIdsOverride({
  initialInputChainId,
  initialOutputChainId,
  usePersistedFilteredChainIds,
  persistedFilteredChainIds,
}: {
  initialInputChainId?: UniverseChainId
  initialOutputChainId?: UniverseChainId
  usePersistedFilteredChainIds?: boolean
  persistedFilteredChainIds?: { [key in CurrencyField]?: UniverseChainId }
}): TransactionState['filteredChainIdsOverride'] {
  return usePersistedFilteredChainIds && !!persistedFilteredChainIds
    ? persistedFilteredChainIds
    : { [CurrencyField.OUTPUT]: initialOutputChainId, [CurrencyField.INPUT]: initialInputChainId }
}

export function Swap({
  initialInputCurrency,
  initialOutputCurrency,
  initialOutputChainId,
  initialTypedValue,
  initialIndependentField,
  initialInputChainId,
  hideHeader = false,
  hideFooter = false,
  onCurrencyChange,
  swapRedirectCallback,
  tokenColor,
  usePersistedFilteredChainIds = false,
}: {
  initialInputChainId?: UniverseChainId
  onCurrencyChange?: (selected: CurrencyState) => void
  initialInputCurrency?: Currency
  initialOutputCurrency?: Currency
  initialOutputChainId?: UniverseChainId
  initialTypedValue?: string
  initialIndependentField?: CurrencyField
  hideHeader?: boolean
  hideFooter?: boolean
  swapRedirectCallback?: SwapRedirectFn
  tokenColor?: string
  usePersistedFilteredChainIds?: boolean
  passkeyAuthStatus?: PasskeyAuthStatus
}) {
  const { isSwapTokenSelectorOpen, swapOutputChainId } = useUniswapContext()

  const isModeMismatch = useIsModeMismatch(initialInputChainId)
  const isSharedSwapDisabled = isModeMismatch

  const input = currencyToAsset(initialInputCurrency)
  const output = currencyToAsset(initialOutputCurrency)

  const persistedFilteredChainIds = useSelector(selectFilteredChainIds)

  const prefilledState = useSwapPrefilledState({
    input,
    output,
    exactAmountToken: initialTypedValue ?? '',
    exactCurrencyField: initialIndependentField ?? CurrencyField.INPUT,
    selectingCurrencyField: isSwapTokenSelectorOpen ? CurrencyField.OUTPUT : undefined,
    selectingCurrencyChainId: swapOutputChainId,
    skipFocusOnCurrencyField: isMobileWeb,
    filteredChainIdsOverride: getFilteredChainIdsOverride({
      initialInputChainId,
      initialOutputChainId,
      usePersistedFilteredChainIds,
      persistedFilteredChainIds,
    }),
  })

  return (
    <MultichainContextProvider initialChainId={initialInputChainId ?? UniverseChainId.Mainnet}>
      <SwapTransactionSettingsStoreContextProvider>
        <SwapAndLimitContextProvider
          initialInputCurrency={initialInputCurrency}
          initialOutputCurrency={initialOutputCurrency}
        >
          <PrefetchBalancesWrapper>
            <SwapFormStoreContextProvider
              prefilledState={prefilledState}
              hideSettings={hideHeader}
              hideFooter={hideFooter}
            >
              <Flex position="relative" gap="$spacing16" opacity={isSharedSwapDisabled ? 0.6 : 1}>
                {isSharedSwapDisabled && <DisabledSwapOverlay />}
                <UniversalSwapFlow
                  hideHeader={hideHeader}
                  hideFooter={hideFooter}
                  swapRedirectCallback={swapRedirectCallback}
                  onCurrencyChange={onCurrencyChange}
                  prefilledState={prefilledState}
                  tokenColor={tokenColor}
                />
              </Flex>
            </SwapFormStoreContextProvider>
          </PrefetchBalancesWrapper>
        </SwapAndLimitContextProvider>
      </SwapTransactionSettingsStoreContextProvider>
    </MultichainContextProvider>
  )
}

function UniversalSwapFlow({
  hideHeader = false,
  hideFooter = false,
  prefilledState,
  onCurrencyChange,
  swapRedirectCallback,
  tokenColor,
}: {
  hideHeader?: boolean
  hideFooter?: boolean
  prefilledState?: SwapFormState
  onCurrencyChange?: (selected: CurrencyState, isBridgePair?: boolean) => void
  swapRedirectCallback?: SwapRedirectFn
  tokenColor?: string
}) {
  const swapHandlers = useSwapHandlers()
  const swapSettings = useWebSwapSettings()
  const resetDisableOneClickSwap = useResetOverrideOneClickSwapFlag()

  // oxlint-disable-next-line typescript/no-unnecessary-condition -- biome-parity: oxlint is stricter here
  const connectorId = useAccount().connector?.id
  const passkeyAuthStatus = useGetPasskeyAuthStatus(connectorId)

  return (
    <Flex gap="$spacing16">
      <SwapDependenciesStoreContextProvider swapHandlers={swapHandlers}>
        <SpxSwapFlow
          settings={swapSettings}
          hideHeader={hideHeader}
          hideFooter={hideFooter}
          onClose={noop}
          swapRedirectCallback={swapRedirectCallback}
          onCurrencyChange={onCurrencyChange}
          prefilledState={prefilledState}
          tokenColor={tokenColor}
          onSubmitSwap={resetDisableOneClickSwap}
          passkeyAuthStatus={passkeyAuthStatus}
        />
      </SwapDependenciesStoreContextProvider>
      <SwapBottomCard />
    </Flex>
  )
}

const DisabledOverlay = styled(Flex, {
  position: 'absolute',
  width: '100%',
  height: '100%',
  zIndex: zIndexes.overlay,
})

const DisabledSwapOverlay = () => {
  const { t } = useTranslation()

  return (
    <DisabledOverlay cursor="not-allowed">
      <Tooltip placement="left-start">
        <Tooltip.Content animationDirection="left" zIndex={zIndexes.overlay}>
          <Tooltip.Arrow />
          <Text variant="body4">{t('testnet.unsupported')}</Text>
        </Tooltip.Content>
        <Tooltip.Trigger position="relative" width="100%" height="100%">
          <DisabledOverlay />
        </Tooltip.Trigger>
      </Tooltip>
    </DisabledOverlay>
  )
}
