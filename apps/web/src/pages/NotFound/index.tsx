import { ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { Button, Flex } from 'ui/src'
import { InterfacePageName } from 'uniswap/src/features/telemetry/constants'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { useIsMobile } from '~/hooks/screenSize/useIsMobile'
import { ThemedText } from '~/theme/components'

interface NotFoundProps {
  title?: ReactNode
  subtitle?: ReactNode
  actionButton?: ReactNode
}

export default function NotFound({ title, subtitle, actionButton }: NotFoundProps) {
  const isMobile = useIsMobile()

  const Title = isMobile ? ThemedText.LargeHeader : ThemedText.Hero
  const Paragraph = isMobile ? ThemedText.HeadlineMedium : ThemedText.HeadlineLarge

  return (
    <Flex flex={1} centered gap="$spacing48" py="$spacing64">
      <Trace logImpression page={InterfacePageName.NotFound}>
        <Flex centered gap="$spacing24">
          {title ?? <Title>404</Title>}
          {subtitle ?? (
            <Paragraph color="neutral2">
              <Trans i18nKey="common.pageNotFound" />
            </Paragraph>
          )}
        </Flex>
        {actionButton ?? (
          <Flex row alignSelf="stretch">
            <Button href="/" tag="a" variant="branded" $platform-web={{ textDecoration: 'none' }}>
              <Trans i18nKey="notFound.oops" />
            </Button>
          </Flex>
        )}
      </Trace>
    </Flex>
  )
}
