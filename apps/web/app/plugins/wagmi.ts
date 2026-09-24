import { VueQueryPlugin } from '@tanstack/vue-query'
import { WagmiPlugin, createConfig, http } from '@wagmi/vue'
import { injected, walletConnect } from '@wagmi/vue/connectors'
import { base, baseSepolia, sepolia } from 'viem/chains'
import { supportedChains } from '~/utils/chains'

type WagmiConfig = ReturnType<typeof createConfig>

const wagmiSingleton = globalThis as typeof globalThis & {
  __finsWagmiConfig?: WagmiConfig
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const projectId = config.public.walletconnectProjectId as string
  const connectors = import.meta.client
    ? [
        injected({
          target: 'metaMask',
        }),
        injected({
          target: {
            id: 'browserWallet',
            name: 'Other Browser Wallet',
            provider(window) {
              const ethereum = window?.ethereum

              if (ethereum?.providers?.length) {
                return ethereum.providers.find((provider) => !provider.isMetaMask)
              }

              if (ethereum && !ethereum.isMetaMask) {
                return ethereum
              }

              return undefined
            },
          },
        }),
        ...(projectId ? [walletConnect({ projectId })] : []),
      ]
    : []

  if (!wagmiSingleton.__finsWagmiConfig) {
    wagmiSingleton.__finsWagmiConfig = createConfig({
      chains: supportedChains,
      connectors,
      multiInjectedProviderDiscovery: false,
      transports: {
        [sepolia.id]: http(),
        [base.id]: http(),
        [baseSepolia.id]: http(),
      },
      ssr: true,
    })
  }

  nuxtApp.vueApp.use(WagmiPlugin, { config: wagmiSingleton.__finsWagmiConfig })
  nuxtApp.vueApp.use(VueQueryPlugin)
})
