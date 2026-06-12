import { useAtomValue } from 'jotai/utils'
import { useTranslation } from 'react-i18next'
import { BridgedAssetModalAtom } from 'uniswap/src/components/BridgedAsset/BridgedAssetModal'
import { WormholeModalAtom } from 'uniswap/src/components/BridgedAsset/WormholeModal'
import { ReportTokenIssueModalPropsAtom } from 'uniswap/src/components/reporting/ReportTokenIssueModal'
import { useActiveAddresses } from 'uniswap/src/features/accounts/store/hooks'
import { ModalName } from 'uniswap/src/features/telemetry/constants'
import { isBetaEnv, isDevEnv } from 'utilities/src/environment/env'
import { useEvent } from 'utilities/src/react/hooks'
import { POPUP_MEDIUM_DISMISS_MS } from '~/components/Popups/constants'
import { popupRegistry } from '~/components/Popups/registry'
import { PopupType } from '~/components/Popups/types'
import { ModalRenderer } from '~/components/TopLevelModals/modalRegistry'
import useAccountRiskCheck from '~/hooks/useAccountRiskCheck'
import { PageType, useIsPage } from '~/hooks/useIsPage'

export default function TopLevelModals() {
  const { t } = useTranslation()
  const isLandingPage = useIsPage(PageType.LANDING)
  const { evmAddress, svmAddress } = useActiveAddresses()
  const blockedAddress = useAccountRiskCheck({ evmAddress, svmAddress })
  const bridgedAssetModalProps = useAtomValue(BridgedAssetModalAtom)
  const wormholeModalProps = useAtomValue(WormholeModalAtom)

  const reportTokenIssueProps = useAtomValue(ReportTokenIssueModalPropsAtom)
  const onReportSuccess = useEvent(() => {
    popupRegistry.addPopup(
      { type: PopupType.Success, message: t('common.reported') },
      'report-token-success',
      POPUP_MEDIUM_DISMISS_MS,
    )
  })

  const shouldShowDevFlags = isDevEnv() || isBetaEnv()

  // On landing page we need to be very careful about what modals we show
  // because too many modals attached to the dom can cause performance issues
  // and potentially lead to crashes. Only add modals here if they are strictly
  // necessary and add minimal overhead to the dom.
  if (isLandingPage) {
    return (
      <>
        <ModalRenderer modalName={ModalName.PrivacyPolicy} />
        <ModalRenderer modalName={ModalName.PrivacyChoices} />
        <ModalRenderer modalName={ModalName.FeatureFlags} />
        <ModalRenderer modalName={ModalName.BlockedAccount} />
        {shouldShowDevFlags && <ModalRenderer modalName={ModalName.DevFlags} />}
        <ModalRenderer modalName={ModalName.Help} />
        <ModalRenderer modalName={ModalName.OffchainActivity} />
        <ModalRenderer modalName={ModalName.ReceiveCryptoModal} />
      </>
    )
  }

  return (
    <>
      <ModalRenderer modalName={ModalName.AddressClaim} />
      <ModalRenderer modalName={ModalName.BlockedAccount} componentProps={{ blockedAddress }} />
      <ModalRenderer modalName={ModalName.Banners} />
      <ModalRenderer modalName={ModalName.OffchainActivity} />
      <ModalRenderer modalName={ModalName.TransactionDetails} />
      <ModalRenderer modalName={ModalName.TransactionConfirmation} />
      <ModalRenderer modalName={ModalName.UkDisclaimer} />
      <ModalRenderer modalName={ModalName.TestnetMode} componentProps={{ showCloseButton: true }} />
      <ModalRenderer modalName={ModalName.PrivacyPolicy} />
      <ModalRenderer modalName={ModalName.PrivacyChoices} />
      <ModalRenderer modalName={ModalName.FeatureFlags} />
      {shouldShowDevFlags && <ModalRenderer modalName={ModalName.DevFlags} />}
      <ModalRenderer modalName={ModalName.Help} />
      <ModalRenderer modalName={ModalName.DelegationMismatch} />
      <ModalRenderer modalName={ModalName.ReceiveCryptoModal} />
      <ModalRenderer modalName={ModalName.Send} />
      <ModalRenderer modalName={ModalName.BridgedAsset} componentProps={bridgedAssetModalProps} />
      <ModalRenderer modalName={ModalName.Wormhole} componentProps={wormholeModalProps} />
      <ModalRenderer
        modalName={ModalName.ReportTokenIssue}
        componentProps={{ ...reportTokenIssueProps, onReportSuccess }}
      />
    </>
  )
}
