import { Flex, styled } from 'ui/src'

const Container = styled(Flex, {
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'auto',
  variants: {
    clickable: {
      true: { cursor: 'pointer' },
    },
  },
})

type NavIconProps = {
  clickable?: boolean
  onClick?: () => void
}

export const NavIcon = ({ clickable, onClick }: NavIconProps) => {
  return (
    <Container clickable={clickable} onPress={onClick}>
      <img src="/images/spx6900.png" alt="SPXSwap" width={28} height={28} style={{ display: 'block' }} />
    </Container>
  )
}
