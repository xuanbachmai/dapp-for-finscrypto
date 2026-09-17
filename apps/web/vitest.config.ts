import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Run before Nuxt generates .nuxt/tsconfig.json on a fresh checkout.
  esbuild: { tsconfigRaw: '{}' },
  test: {
    environment: 'node',
  },
})
