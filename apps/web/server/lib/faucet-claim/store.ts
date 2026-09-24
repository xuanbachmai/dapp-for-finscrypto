import type { SupabaseClient } from '@supabase/supabase-js'
import { FaucetClaimSchema, type FaucetClaim, type FaucetClaimRecord } from '../../../app/utils/schemas'

export interface FaucetClaimsStore {
  latestClaim(studentId: string, chainId: number): Promise<FaucetClaim | null>
  record(claim: FaucetClaimRecord): Promise<void>
}

export function createSupabaseFaucetClaimsStore(supabase: SupabaseClient): FaucetClaimsStore {
  return {
    async latestClaim(studentId, chainId) {
      const { data, error } = await supabase.from('faucet_claims')
        .select('id, student_id, chain_id, amount_wei, tx_hash, created_at')
        .eq('student_id', studentId).eq('chain_id', chainId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? FaucetClaimSchema.parse(data) : null
    },
    async record(claim) {
      const { error } = await supabase.from('faucet_claims').insert(claim)
      if (error) throw new Error(error.message)
    },
  }
}
