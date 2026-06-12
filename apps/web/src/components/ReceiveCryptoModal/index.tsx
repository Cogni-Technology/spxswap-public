import { useEffect } from 'react'
import { Flex, Text } from 'ui/src'
import { Modal } from 'uniswap/src/components/modals/Modal'
import { ReceiveQRCode } from 'uniswap/src/components/ReceiveQRCode/ReceiveQRCode'
import { ModalName } from 'uniswap/src/features/telemetry/constants'
import { logger } from 'utilities/src/logger/logger'
import { useEvent } from 'utilities/src/react/hooks'
import { useActiveAddresses, useConnectionStatus } from '~/features/accounts/store/hooks'
import { useModalState } from '~/hooks/useModalState'

export function ReceiveCryptoModal() {
  const { isOpen, closeModal } = useModalState(ModalName.ReceiveCryptoModal)
  const { evmAddress } = useActiveAddresses()

  const onClose = useEvent(() => {
    closeModal()
  })

  const isDisconnected = useConnectionStatus('aggregate').isDisconnected
  useEffect(() => {
    if (isDisconnected && isOpen) {
      logger.debug('ReceiveCryptoModal', 'ReceiveCryptoModal', 'Modal opened with invalid state. Closing modal.')
      onClose()
    }
  }, [isDisconnected, isOpen, onClose])

  if (isDisconnected || !evmAddress) {
    return null
  }

  return (
    <Modal name={ModalName.ReceiveCryptoModal} isModalOpen={isOpen} onClose={onClose} maxWidth={420}>
      <Flex p="$spacing24" gap="$spacing16">
        <Text variant="subheading1" color="$accent1" textAlign="center">
          Receive
        </Text>
        <ReceiveQRCode address={evmAddress} />
      </Flex>
    </Modal>
  )
}
