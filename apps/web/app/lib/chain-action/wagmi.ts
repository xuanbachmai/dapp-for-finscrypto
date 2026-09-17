import { waitForTransactionReceipt } from '@wagmi/core'
import { useConfig, useWriteContract } from '@wagmi/vue'
import type { SupportedChainId } from '../../utils/chains'
import type { ChainWriter } from '../../utils/schemas'

export function useWagmiChainWriter(chainId: SupportedChainId): ChainWriter {
  const config = useConfig()
  const { writeContractAsync } = useWriteContract({ config })

  return {
    write: (request) => writeContractAsync(request),
    async waitForReceipt(hash) {
      const receipt = await waitForTransactionReceipt(config, {
        chainId,
        hash,
        pollingInterval: 1_500,
      })
      return receipt.status === 'success' ? 'success' : 'failure'
    },
  }
}
