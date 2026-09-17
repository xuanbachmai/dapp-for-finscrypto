import { Contract, Result } from 'ethers'
import type { getChainRuntime } from '../chain-runtime/ethers'
import type { EvidenceSources } from './evidence'

export function createEthersEvidenceSources(runtime: Pick<ReturnType<typeof getChainRuntime>, 'getProvider'>): EvidenceSources {
  return {
    async providerFor(chainId) {
      const result = await runtime.getProvider(chainId)
      const label = chainId === 31337 ? 'Local Anvil' : chainId === 36475547 ? 'FINSCRYPTO' : `Chain ${chainId}`
      if (result.status === 'missing_config') throw new Error(`${label} RPC configuration is missing.`)
      if (result.status === 'wrong_chain') {
        throw new Error(`${label} RPC configuration is pointing at chain ${result.actualChainId} instead of ${chainId}.`)
      }
      return {
        getBalance: wallet => result.provider.getBalance(wallet),
        async readContract({ address, abi, functionName, args }) {
          const value: unknown = await new Contract(address, abi, result.provider).getFunction(functionName).staticCall(...args)
          return value instanceof Result ? value.toObject() : value
        },
      }
    },
  }
}
