import { faucetChainConfig, getFaucetChainConfig } from '~~/app/utils/faucet'
import { FaucetRequestSchema, FaucetVerdictSchema } from '~~/app/utils/schemas'
import { getChainRuntime } from '~~/server/lib/chain-runtime/ethers'
import { createFaucetClaim } from '~~/server/lib/faucet-claim'
import { createSupabaseFaucetClaimsStore } from '~~/server/lib/faucet-claim/store'
import { createStudentRegistry } from '~~/server/lib/student-registry'
import { createSupabaseStudentsStore } from '~~/server/lib/student-registry/store'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, value => FaucetRequestSchema.parse(value))
  const policy = getFaucetChainConfig(body.chainId)
  const supabase = useSupabaseServiceRole()
  const faucet = createFaucetClaim({
    policies: faucetChainConfig,
    registry: createStudentRegistry(createSupabaseStudentsStore(supabase)),
    claims: createSupabaseFaucetClaimsStore(supabase),
    runtime: getChainRuntime(useRuntimeConfig()),
    logPersistenceError: (error, txHash) => console.error('[faucet] Failed to persist claim:', txHash, error),
  })
  const verdict = FaucetVerdictSchema.parse(await faucet.claim(body).catch((error: unknown) => {
    throw createError({ statusCode: 500, message: error instanceof Error ? error.message : 'Faucet request failed.' })
  }))

  if (verdict.status === 'sent') return verdict

  switch (verdict.reason) {
    case 'disabled':
      throw createError({ statusCode: 403, message: 'The self-hosted Sepolia faucet is disabled. Use one of the public faucets listed on the faucet page.', data: verdict })
    case 'unregistered':
      throw createError({ statusCode: 403, message: 'Register and verify this wallet on FINSCRYPTO before claiming.', data: verdict })
    case 'cooldown':
      throw createError({ statusCode: 429, message: `Already claimed. Next claim available at ${verdict.nextClaimAt}.`, data: verdict })
    case 'not_configured':
      throw createError({ statusCode: 503, message: `The faucet signer is not configured for this chain (${policy.amountEth} ETH claims).`, data: verdict })
  }
})
