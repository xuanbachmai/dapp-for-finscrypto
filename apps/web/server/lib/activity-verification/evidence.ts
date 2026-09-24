import type { EvidenceContractRead } from '../../../app/utils/schemas'

// Subset of the course platform's Evidence sources. The platform also exposes a block
// explorer and the Safe service; the Approval & Drain Lab only needs Chain reads.

export interface EvidenceProvider {
  getBalance(wallet: string): Promise<bigint>
  readContract(read: EvidenceContractRead): Promise<unknown>
}

export class ExplorerUnavailableError extends Error {
  constructor() {
    super('Unable to load Sepolia activity history from the RPC provider.')
  }
}

export interface EvidenceSources {
  providerFor(chainId: number): Promise<EvidenceProvider>
}

export function createInMemoryEvidenceSources() {
  const reads = new Map<string, unknown>()
  const key = (chainId: number, read: EvidenceContractRead) =>
    JSON.stringify([chainId, read.address.toLowerCase(), read.functionName, read.args.map(arg => arg.toLowerCase())])

  return {
    setContractRead(chainId: number, read: EvidenceContractRead, result: unknown) {
      reads.set(key(chainId, read), result)
    },
    async providerFor(chainId: number): Promise<EvidenceProvider> {
      return {
        async getBalance() {
          throw new Error('No balance evidence in this build.')
        },
        async readContract(read) {
          const id = key(chainId, read)
          if (!reads.has(id)) throw new Error(`No contract evidence for ${id}`)
          const result = reads.get(id)
          if (result instanceof Error) throw result
          return result
        },
      }
    },
  }
}
