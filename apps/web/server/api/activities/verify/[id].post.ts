import { createStudentRegistry } from '~~/server/lib/student-registry'
import { createSupabaseStudentsStore } from '~~/server/lib/student-registry/store'
import { ActivityVerificationRequestSchema } from '~~/app/utils/schemas'
import { getCourseActivity } from '~~/app/utils/activities'
import { getChainRuntime } from '~~/server/lib/chain-runtime/ethers'
import { createActivityVerification } from '~~/server/lib/activity-verification'
import { createActivityVerifiers } from '~~/server/lib/activity-verification/verifiers'
import { createEthersEvidenceSources } from '~~/server/lib/activity-verification/ethers'
import { createSupabaseProgressStore } from '~~/server/lib/activity-verification/store'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  if (!id) throw createError({ statusCode: 400, message: 'Activity id is required.' })
  // Keep the existing unknown-id response ahead of request-body validation.
  if (!getCourseActivity(id)) throw createError({ statusCode: 404, message: 'Unknown activity.' })
  const body = await readValidatedBody(event, value => ActivityVerificationRequestSchema.parse(value))
  const supabase = useSupabaseServiceRole()
  const config = useRuntimeConfig()

  const verification = createActivityVerification({
    students: createStudentRegistry(createSupabaseStudentsStore(supabase)),
    progress: createSupabaseProgressStore(supabase),
    evidence: createEthersEvidenceSources(getChainRuntime(config)),
    verifiers: createActivityVerifiers({
      approvalLabAddress: config.public.labContracts.approvalLab,
      survivorBadgeAddress: config.public.labContracts.survivorBadge,
    }),
  })
  const verdict = await verification.verifyActivity(id, body.walletAddress).catch((error: unknown) => {
    if (isError(error)) throw error
    throw createError({ statusCode: 500, message: error instanceof Error ? error.message : 'Activity verification failed.' })
  })

  switch (verdict.status) {
    case 'ExplorerUnavailable':
      throw createError({ statusCode: 502, message: verdict.message })
    case 'UnknownActivity':
      throw createError({ statusCode: 404, message: 'Unknown activity.' })
    case 'Unregistered':
      throw createError({ statusCode: 403, message: 'Register and verify this wallet before checking activities.' })
    case 'NotCompleted':
      return { verified: false, message: verdict.message, verifiedAt: null }
    case 'Verified':
      return { verified: true, message: 'Activity verified and saved to your progress record.', verifiedAt: verdict.verifiedAt }
  }
})
