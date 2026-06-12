import { atom, useAtom } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { Platform } from 'uniswap/src/features/platforms/types/Platform'
import { useEvent } from 'utilities/src/react/hooks'

export enum MenuStateVariant {
  MAIN = 'main',
  CONNECT_PLATFORM = 'connect_platform',
}

type MenuState =
  | {
      variant: MenuStateVariant.CONNECT_PLATFORM
      platform: Platform
    }
  | {
      variant: MenuStateVariant.MAIN
    }

const miniPortfolioMenuStateAtom = atom<MenuState>({ variant: MenuStateVariant.MAIN })

export function useMenuState() {
  const [menuState, setMenu] = useAtom(miniPortfolioMenuStateAtom)
  const setMenuState = useEvent((state: MenuState) => setMenu(state))

  return { menuState, setMenuState }
}

export function useSetMenu() {
  const setMenu = useUpdateAtom(miniPortfolioMenuStateAtom)
  return useEvent((state: MenuState) => setMenu(state))
}
