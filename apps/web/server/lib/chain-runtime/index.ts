import type { ChainRuntimeConfig, ChainRuntimeError } from '../../../app/utils/schemas'

const chains = {
  11155111: { rpcUrl: 'sepoliaRpcUrl', privateKey: 'sepoliaFaucetPrivateKey' },
} as const satisfies Record<number, { rpcUrl: keyof ChainRuntimeConfig, privateKey: keyof ChainRuntimeConfig }>

export function createChainRuntime<Provider extends { getNetwork(): Promise<{ chainId: bigint }> }, Signer>(
  config: ChainRuntimeConfig,
  adapters: {
    createProvider(rpcUrl: string): Provider
    createSigner(privateKey: string, provider: Provider): Signer
  },
) {
  const providers = new Map<number, Promise<ChainRuntimeError | { status: 'ready', provider: Provider }>>()

  async function getProvider(chainId: number): Promise<ChainRuntimeError | { status: 'ready', provider: Provider }> {
    const chain = chains[chainId as keyof typeof chains]
    const rpcUrl = chain && config[chain.rpcUrl]
    if (!rpcUrl) {
      return { status: 'missing_config', chainId, setting: chain?.rpcUrl ?? 'chainId' }
    }

    if (!providers.has(chainId)) {
      const initialization = (async () => {
        const provider = adapters.createProvider(rpcUrl)
        const network = await provider.getNetwork()
        if (network.chainId !== BigInt(chainId)) {
          return { status: 'wrong_chain', chainId, actualChainId: network.chainId.toString() } as const
        }
        return { status: 'ready', provider } as const
      })()
      providers.set(chainId, initialization)
      // Retry transport failures on the next call; configuration verdicts remain memoised.
      void initialization.catch(() => providers.delete(chainId))
    }

    return providers.get(chainId)!
  }

  async function getFaucetSigner(chainId: number): Promise<ChainRuntimeError | { status: 'ready', signer: Signer }> {
    const chain = chains[chainId as keyof typeof chains]
    const privateKey = chain && config[chain.privateKey]
    if (!privateKey) {
      return { status: 'missing_config', chainId, setting: chain?.privateKey ?? 'chainId' }
    }

    const result = await getProvider(chainId)
    if (result.status !== 'ready') return result
    return { status: 'ready', signer: adapters.createSigner(privateKey, result.provider) }
  }

  return { getProvider, getFaucetSigner }
}
