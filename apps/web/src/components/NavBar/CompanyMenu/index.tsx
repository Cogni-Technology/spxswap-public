import { Link } from 'react-router'
import { Flex, Text } from 'ui/src'
import { ElementName } from 'uniswap/src/features/telemetry/constants'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { TestID } from 'uniswap/src/test/fixtures/testIDs'
import { NavIcon } from '~/components/Logo/NavIcon'

export function CompanyMenu() {
  return (
    <Trace logPress element={ElementName.NavbarCompanyMenuLogo}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Flex row alignItems="center" gap="$gap8" p="$spacing8" cursor="pointer" data-testid={TestID.NavLogo}>
          <NavIcon />
          <Text variant="subheading1" color="$accent1" userSelect="none">
            SPXSwap
          </Text>
        </Flex>
      </Link>
    </Trace>
  )
}
