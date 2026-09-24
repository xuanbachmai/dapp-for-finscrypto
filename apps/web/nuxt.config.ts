import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',

  css: ['~/assets/css/main.css'],

  vite: {
    resolve: {
      alias: {
        '@vue/devtools-api': 'vue-devtools-stub',
      },
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  nitro: {
    // Bundling server dependencies avoids Nitro's pathological external-file
    // tracing on Windows and keeps the production output self-contained.
    noExternals: true,
    esbuild: {
      options: {
        target: 'es2022',
      },
    },
    alias: {
      'bufferutil': fileURLToPath(new URL('./server/utils/ws-bufferutil.ts', import.meta.url)),
      'utf-8-validate': fileURLToPath(new URL('./server/utils/ws-utf8-validate.ts', import.meta.url)),
    },
  },

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/supabase',
    '@nuxt/icon',
  ],

  supabase: {
    redirect: false,
    types: '',
  },

  runtimeConfig: {
    sepoliaRpcUrl: process.env.NUXT_SEPOLIA_RPC_URL || '',
    // Intentionally blank by default: the public faucet page uses established Sepolia faucets.
    sepoliaFaucetPrivateKey: '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    public: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_KEY || '',
      walletconnectProjectId: process.env.NUXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      platformUrl: process.env.NUXT_PUBLIC_PLATFORM_URL || 'https://finscrypto.xyz',
      labContracts: {
        finsToken: process.env.NUXT_PUBLIC_FINS_TOKEN_ADDRESS || '',
        audToken: process.env.NUXT_PUBLIC_AUD_TOKEN_ADDRESS || '',
        drainerRound1: process.env.NUXT_PUBLIC_DRAINER_ROUND1_ADDRESS || '',
        drainerRound2: process.env.NUXT_PUBLIC_DRAINER_ROUND2_ADDRESS || '',
        audDrainerRound1: process.env.NUXT_PUBLIC_AUD_DRAINER_ROUND1_ADDRESS || '',
        audDrainerRound2: process.env.NUXT_PUBLIC_AUD_DRAINER_ROUND2_ADDRESS || '',
        fakeAirdrop: process.env.NUXT_PUBLIC_FAKE_AIRDROP_ADDRESS || '',
        approvalLab: process.env.NUXT_PUBLIC_APPROVAL_LAB_ADDRESS || '',
      },
    },
  },

  devtools: { enabled: true },
})
