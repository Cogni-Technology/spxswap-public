import { Flex, styled, Nav as TamaguiNav } from 'ui/src'
import { breakpoints, INTERFACE_NAV_HEIGHT, zIndexes } from 'ui/src/theme'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import Row from '~/components/deprecated/Row'
import { CompanyMenu } from '~/components/NavBar/CompanyMenu'
import TestnetModeTooltip from '~/components/NavBar/TestnetMode/TestnetModeTooltip'
import Web3Status from '~/components/Web3Status'
import { css, deprecatedStyled } from '~/lib/deprecated-styled'

const UnpositionedFlex = styled(Flex, {
  position: 'unset',
})
const Nav = styled(TamaguiNav, {
  position: 'unset',
  px: '$padding12',
  width: '100%',
  height: INTERFACE_NAV_HEIGHT,
  zIndex: zIndexes.sticky,
  justifyContent: 'center',
})
const NavItems = css`
  gap: 12px;
  @media screen and (max-width: ${breakpoints.md}px) {
    gap: 4px;
  }
`
const Left = deprecatedStyled(Row)`
  display: flex;
  align-items: center;
  wrap: nowrap;
  ${NavItems}
`
const Right = deprecatedStyled(Row)`
  justify-content: flex-end;
  ${NavItems}
`

export default function Navbar() {
  const { isTestnetModeEnabled } = useEnabledChains()

  return (
    <Nav>
      <UnpositionedFlex row centered width="100%">
        <Left>
          <CompanyMenu />
        </Left>

        <Right>
          {isTestnetModeEnabled && <TestnetModeTooltip />}
          <Web3Status />
        </Right>
      </UnpositionedFlex>
    </Nav>
  )
}
