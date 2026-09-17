import type { SupabaseClient } from '@supabase/supabase-js'
import { StudentIdentitySchema, type StudentIdentity } from '../../../app/utils/schemas'

// Read-only subset of the course platform's Students store. Registration (codes, nonces,
// wallet binding) is not part of this build; local Students come from supabase/seed.sql.
export interface StudentsStore {
  findByWallet(wallet: string): Promise<StudentIdentity | null>
}

const identityColumns = 'id, zid, wallet_address, display_name, verified, verified_at, created_at'

function normalizeStudent(row: unknown): StudentIdentity {
  const student = StudentIdentitySchema.parse(row)
  return { ...student, wallet_address: student.wallet_address?.toLowerCase() ?? null }
}

export function createSupabaseStudentsStore(supabase: SupabaseClient): StudentsStore {
  return {
    async findByWallet(wallet) {
      const { data, error } = await supabase.from('students')
        .select(identityColumns).eq('wallet_address', wallet.toLowerCase()).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? normalizeStudent(data) : null
    },
  }
}

export function createInMemoryStudentsStore(initialStudents: StudentIdentity[] = []): StudentsStore {
  const students = initialStudents.map(normalizeStudent)
  return {
    async findByWallet(wallet) {
      const student = students.find(student => student.wallet_address === wallet.toLowerCase())
      return student ? normalizeStudent(student) : null
    },
  }
}
