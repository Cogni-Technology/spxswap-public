import { lazy, ReactNode, Suspense } from 'react'
import { matchPath, Navigate, useLocation } from 'react-router'
import Swap from '~/pages/Swap'
import { isBrowserRouterEnabled } from '~/utils/env'

const NotFound = lazy(() => import('~/pages/NotFound'))

interface RouterConfig {
  browserRouterEnabled?: boolean
  hash?: string
}

export function useRouterConfig(): RouterConfig {
  const browserRouterEnabled = isBrowserRouterEnabled()
  const { hash } = useLocation()
  return { browserRouterEnabled, hash }
}

const StaticTitlesAndDescriptions = {
  SPXSwapTitle: 'SPXSwap',
  SwapTitle: 'Swap',
  SwapDescription: 'Trade tokens in an instant',
}

export interface RouteDefinition {
  path: string
  nestedPaths: string[]
  getTitle: (path?: string) => string
  getDescription: (path?: string) => string
  enabled: (args: RouterConfig) => boolean
  getElement: (args: RouterConfig) => ReactNode
}

function createRouteDefinition(route: Partial<RouteDefinition>): RouteDefinition {
  return {
    getElement: () => null,
    getTitle: () => StaticTitlesAndDescriptions.SPXSwapTitle,
    getDescription: () => StaticTitlesAndDescriptions.SwapDescription,
    enabled: () => true,
    path: '/',
    nestedPaths: [],
    ...route,
  }
}

export const routes: RouteDefinition[] = [
  createRouteDefinition({
    path: '/',
    getElement: (args) =>
      args.browserRouterEnabled && args.hash ? <Navigate to={args.hash.replace('#', '')} replace /> : <Swap />,
    getTitle: () => StaticTitlesAndDescriptions.SwapTitle,
  }),
  createRouteDefinition({
    path: '/swap',
    getElement: () => <Swap />,
    getTitle: () => StaticTitlesAndDescriptions.SwapTitle,
  }),
  createRouteDefinition({
    path: '/not-found',
    getElement: () => (
      <Suspense fallback={null}>
        <NotFound />
      </Suspense>
    ),
  }),
  createRouteDefinition({
    path: '*',
    getElement: () => <Navigate to="/not-found" replace />,
  }),
]

export const findRouteByPath = (pathname: string) => {
  for (const route of routes) {
    const match = matchPath(route.path, pathname)
    if (match) {
      return route
    }
    const subPaths = route.nestedPaths.map((nestedPath) => `${route.path}/${nestedPath}`)
    for (const subPath of subPaths) {
      const match = matchPath(subPath, pathname)
      if (match) {
        return route
      }
    }
  }
  return undefined
}
