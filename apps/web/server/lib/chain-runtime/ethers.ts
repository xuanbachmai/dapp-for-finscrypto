import { JsonRpcProvider } from 'ethers'
import { ChainRuntimeConfigSchema, type ChainRuntimeConfig } from '../../../app/utils/schemas'
import { createChainRuntime } from './index'

const adapters = {
  createProvider: (rpcUrl: string) => new JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true }),
}

let runtime: ReturnType<typeof createChainRuntime<JsonRpcProvider>> | undefined
let configuration: string | undefined

// Shared across route invocations, including when Nuxt returns a new config object.
export function getChainRuntime(config: ChainRuntimeConfig) {
  const parsed = ChainRuntimeConfigSchema.parse(config)
  const key = JSON.stringify(parsed)
  if (!runtime || key !== configuration) {
    runtime = createChainRuntime(parsed, adapters)
    configuration = key
  }
  return runtime
}
