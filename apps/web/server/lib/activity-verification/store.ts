import type { SupabaseClient } from '@supabase/supabase-js'
import { ProgressRecordSchema, type ProgressIdentity, type ProgressRecord } from '../../../app/utils/schemas'

export interface ProgressStore {
  listVerified(studentId: string): Promise<ProgressRecord[]>
  recordVerified(identity: ProgressIdentity, verifiedAt: string): Promise<string>
}

export function createSupabaseProgressStore(supabase: SupabaseClient): ProgressStore {
  return {
    async listVerified(studentId) {
      const { data, error } = await supabase.from('activities')
        .select('student_id, activity_type, chain_id, verified_at')
        .eq('student_id', studentId).eq('verified', true)
      if (error) throw new Error(error.message)
      return ProgressRecordSchema.array().parse(data)
    },
    async recordVerified(identity, verifiedAt) {
      // The unique Progress identity makes concurrent first verifications converge on one row.
      const { error: insertError } = await supabase.from('activities').upsert({
        ...identity, verified: true, verified_at: verifiedAt, tx_hash: null,
      }, { onConflict: 'student_id,activity_type,chain_id', ignoreDuplicates: true })
      if (insertError) throw new Error(insertError.message)

      // Promote an old unverified row, but retain any already-recorded verification time.
      const { error: updateError } = await supabase.from('activities')
        .update({ verified: true, verified_at: verifiedAt })
        .match(identity).or('verified.eq.false,verified_at.is.null')
      if (updateError) throw new Error(updateError.message)

      const { data, error } = await supabase.from('activities')
        .select('student_id, activity_type, chain_id, verified_at').match(identity).single()
      if (error) throw new Error(error.message)
      const record = ProgressRecordSchema.parse(data)
      if (!record.verified_at) throw new Error('Progress verification time was not saved.')
      return record.verified_at
    },
  }
}

export function createInMemoryProgressStore(initialRecords: ProgressRecord[] = []): ProgressStore {
  const records = new Map<string, ProgressRecord>()
  const key = (record: ProgressIdentity) => JSON.stringify([record.student_id, record.activity_type, record.chain_id])
  for (const record of initialRecords) records.set(key(record), { ...record })
  return {
    async listVerified(studentId) {
      return [...records.values()].filter(record => record.student_id === studentId).map(record => ({ ...record }))
    },
    async recordVerified(identity, verifiedAt) {
      const id = key(identity)
      const firstVerifiedAt = records.get(id)?.verified_at ?? verifiedAt
      records.set(id, { ...identity, verified_at: firstVerifiedAt })
      return firstVerifiedAt
    },
  }
}
