import { useState } from 'react'
import { Flex, Text, TouchableArea } from 'ui/src'
import { X } from 'ui/src/components/icons/X'

const DISMISSED_KEY = 'spx-beta-banner-dismissed'

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) {
    return null
  }

  return (
    <Flex
      row
      centered
      gap="$spacing8"
      px="$spacing16"
      py="$spacing8"
      backgroundColor="rgba(190, 60, 60, 0.15)"
      borderBottomWidth={1}
      borderBottomColor="rgba(190, 60, 60, 0.3)"
    >
      <Text variant="body4" color="$neutral1" textAlign="center" flex={1}>
        This is the beta-release version of SPXSwap. Right now it only contains minimal swap functionality. When testing
        you should use fresh wallets and test with smaller swap amounts while the app progresses into a more mature
        state.
      </Text>
      <TouchableArea
        onPress={() => {
          setDismissed(true)
          try {
            localStorage.setItem(DISMISSED_KEY, '1')
          } catch {}
        }}
      >
        <X size={14} color="$neutral2" />
      </TouchableArea>
    </Flex>
  )
}
