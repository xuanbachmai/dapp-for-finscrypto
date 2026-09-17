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
    localRpcUrl: process.env.NUXT_LOCAL_RPC_URL || 'http://127.0.0.1:8545',
    finscryptoRpcUrl: process.env.NUXT_FINSCRYPTO_RPC_URL || 'https://chain.finscrypto.xyz/rpc/',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    public: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_KEY || '',
      walletconnectProjectId: process.env.NUXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    },
  },

  devtools: { enabled: true },
})
