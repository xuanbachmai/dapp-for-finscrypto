import { getCourseActivity, type ActivityId } from '../../../app/utils/activities'
import type { ActivityVerificationVerdict, VerifiedStudent } from '../../../app/utils/schemas'
import { ExplorerUnavailableError, type EvidenceSources } from './evidence'
import type { ProgressStore } from './store'

export type ActivityVerifier = (context: {
  studentId: string
  walletAddress: string
  evidence: EvidenceSources
}) => Promise<boolean>

export function createActivityVerification(dependencies: {
  students: { findVerifiedByWallet(wallet: string): Promise<VerifiedStudent | null> }
  progress: ProgressStore
  evidence: EvidenceSources
  verifiers: Record<ActivityId, ActivityVerifier>
  now?: () => Date
}) {
  return {
    async verifyActivity(activityId: string, walletAddress: string): Promise<ActivityVerificationVerdict> {
      const activity = getCourseActivity(activityId)
      if (!activity) return { status: 'UnknownActivity' }
      const student = await dependencies.students.findVerifiedByWallet(walletAddress)
      if (!student) return { status: 'Unregistered' }

      let verified: boolean
      try {
        verified = await dependencies.verifiers[activity.id]({
          studentId: student.id, walletAddress: student.wallet_address, evidence: dependencies.evidence,
        })
      } catch (error) {
        if (error instanceof ExplorerUnavailableError) return { status: 'ExplorerUnavailable', message: error.message }
        throw error
      }
      if (!verified) return { status: 'NotCompleted', message: activity.notCompletedMessage }

      const verifiedAt = await dependencies.progress.recordVerified({
        student_id: student.id, activity_type: activity.activityType, chain_id: activity.chainId,
      }, (dependencies.now?.() ?? new Date()).toISOString())
      return { status: 'Verified', verifiedAt }
    },
  }
}
