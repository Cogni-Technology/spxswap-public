// SPXSwap stub for @statsig/react-bindings.
//
// The upstream Uniswap interface drives its Statsig SDK at runtime from
// interface.gateway.uniswap.org. SPXSwap is an IPFS-deployed static site with
// no runtime feature-flag service, so every gate/experiment/config/layer
// returns its safe default and no network calls fire. The local override
// adapter still exists in memory so the dev FeatureFlagModal doesn't crash,
// but nothing reads from it — gate evaluation is hardcoded.
//
// Types are re-exported from the real Statsig packages so existing call-site
// type declarations keep working without a separate `.d.ts` shim.

import type {
  DynamicConfig,
  Experiment,
  EvaluationDetails,
  FeatureGate,
  Layer,
  PrecomputedEvaluationsInterface,
  TypedGet,
} from '@statsig/client-core'
import { type ReactNode, createContext } from 'react'

export type { StatsigOptions, StatsigUser, StorageProvider, TypedReturn } from '@statsig/react-bindings'

import { LocalOverrideAdapterWrapper } from '@universe/gating/src/LocalOverrideAdapterWrapper'

const STUB_DETAILS: EvaluationDetails = { reason: 'Stub:SPXSwap' }

const stubGet: TypedGet = (<T>(_key: string, fallback?: T) => fallback) as TypedGet

function makeStubGate(name: string): FeatureGate {
  return {
    name,
    ruleID: 'stub',
    details: STUB_DETAILS,
    value: false,
    __evaluation: null,
  }
}

function makeStubExperiment(name: string): Experiment {
  return {
    name,
    ruleID: 'stub',
    details: STUB_DETAILS,
    value: {},
    groupName: null,
    __evaluation: null,
    get: stubGet,
  }
}

function makeStubDynamicConfig(name: string): DynamicConfig {
  return {
    name,
    ruleID: 'stub',
    details: STUB_DETAILS,
    value: {},
    __evaluation: null,
    get: stubGet,
  }
}

function makeStubLayer(name: string): Layer {
  return {
    name,
    ruleID: 'stub',
    details: STUB_DETAILS,
    groupName: null,
    __value: {},
    __evaluation: null,
    get: stubGet,
  }
}

class StubStatsigClient {
  readonly loadingStatus = 'Ready' as const

  checkGate(_name: string, _opts?: { disableExposureLog?: boolean }): boolean {
    return false
  }

  getFeatureGate(name: string, _opts?: { disableExposureLog?: boolean }): FeatureGate {
    return makeStubGate(name)
  }

  getExperiment(name: string, _opts?: { disableExposureLog?: boolean }): Experiment {
    return makeStubExperiment(name)
  }

  getDynamicConfig(name: string): DynamicConfig {
    return makeStubDynamicConfig(name)
  }

  getLayer(name: string): Layer {
    return makeStubLayer(name)
  }

  on(_event: string, _handler: unknown): void {
    // no-op — never fires because the stub is always 'Ready'
  }

  off(_event: string, _handler: unknown): void {
    // no-op
  }

  getContext(): { user: { userID: string; customIDs: Record<string, string> } } {
    return { user: { userID: '', customIDs: {} } }
  }

  async updateUserAsync(_user: unknown): Promise<void> {
    // no-op — LocalOverrideAdapterWrapper.refreshStatsig calls this
  }
}

const stubClient = new StubStatsigClient() as unknown as PrecomputedEvaluationsInterface

export class StatsigClient extends StubStatsigClient {
  static instance(_apiKey: string): StatsigClient {
    return stubClient as unknown as StatsigClient
  }
}

// --- React context + provider stubs -------------------------------------

export const StatsigContext = createContext<{ client: PrecomputedEvaluationsInterface }>({
  client: stubClient,
})

export function StatsigProvider({ children }: { client?: unknown; children?: ReactNode }): ReactNode {
  return children ?? null
}

// --- React hook stubs ---------------------------------------------------

export function useGateValue(_name: string, _opts?: { disableExposureLog?: boolean }): boolean {
  return false
}

export function useFeatureGate(name: string, _opts?: { disableExposureLog?: boolean }): FeatureGate {
  return makeStubGate(name)
}

export function useExperiment(name: string, _opts?: { disableExposureLog?: boolean }): Experiment {
  return makeStubExperiment(name)
}

export function useDynamicConfig(name: string): DynamicConfig {
  return makeStubDynamicConfig(name)
}

export function useLayer(name: string): Layer {
  return makeStubLayer(name)
}

export function useStatsigClient(): {
  client: PrecomputedEvaluationsInterface
  checkGate: (name: string) => boolean
  getFeatureGate: (name: string) => FeatureGate
  getExperiment: (name: string) => Experiment
  getDynamicConfig: (name: string) => DynamicConfig
  getLayer: (name: string) => Layer
  logEvent: (event: unknown) => void
} {
  return {
    client: stubClient,
    checkGate: () => false,
    getFeatureGate: (name: string) => makeStubGate(name),
    getExperiment: (name: string) => makeStubExperiment(name),
    getDynamicConfig: (name: string) => makeStubDynamicConfig(name),
    getLayer: (name: string) => makeStubLayer(name),
    logEvent: () => undefined,
  }
}

export function useStatsigUser(): { user: { userID: string } } {
  return { user: { userID: '' } }
}

// oxlint-disable-next-line max-params -- shape matches @statsig/react-bindings useClientAsyncInit(apiKey, user, options)
export function useClientAsyncInit(
  _apiKey: string,
  _user: unknown,
  _options?: unknown,
): { client: PrecomputedEvaluationsInterface; isLoading: boolean } {
  return { client: stubClient, isLoading: false }
}

// --- Accessors ----------------------------------------------------------

export function getStatsigClient(): PrecomputedEvaluationsInterface {
  return stubClient
}

// --- Storage ------------------------------------------------------------

const memoryStorage = new Map<string, string>()

export const Storage = {
  getItem: (key: string): string | null => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    memoryStorage.set(key, value)
  },
  removeItem: (key: string): void => {
    memoryStorage.delete(key)
  },
}

// --- Local override adapter --------------------------------------------

let localOverrideAdapter: LocalOverrideAdapterWrapper | undefined

export function getOverrideAdapter(): LocalOverrideAdapterWrapper {
  if (!localOverrideAdapter) {
    localOverrideAdapter = new LocalOverrideAdapterWrapper('spxswap-stub-key')
  }
  return localOverrideAdapter
}
