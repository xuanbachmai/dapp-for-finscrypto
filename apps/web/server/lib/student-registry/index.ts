import { VerifiedStudentSchema } from '../../../app/utils/schemas'
import type { StudentsStore } from './store'

// Read-only subset of the course platform's Student registry.
export function createStudentRegistry(students: StudentsStore) {
  return {
    async findVerifiedByWallet(wallet: string) {
      const student = await students.findByWallet(wallet)
      return student?.verified && student.wallet_address
        ? VerifiedStudentSchema.parse(student)
        : null
    },
  }
}
