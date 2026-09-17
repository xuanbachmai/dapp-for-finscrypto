import { createStudentRegistry } from '~~/server/lib/student-registry'
import { createSupabaseStudentsStore } from '~~/server/lib/student-registry/store'
import { ActivityStatusQuerySchema } from '~~/app/utils/schemas'
import { courseActivities } from '~~/app/utils/activities'
import { createSupabaseProgressStore } from '~~/server/lib/activity-verification/store'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, value => ActivityStatusQuerySchema.parse(value))
  const walletAddress = query.walletAddress

  const supabase = useSupabaseServiceRole()

  const registry = createStudentRegistry(createSupabaseStudentsStore(supabase))
  const student = await registry.findVerifiedByWallet(walletAddress).catch((error: unknown) => {
    throw createError({ statusCode: 500, message: error instanceof Error ? error.message : 'Student lookup failed' })
  })

  if (!student) {
    return {
      studentFound: false,
      activities: courseActivities.map(activity => ({
        id: activity.id,
        completed: false,
        verifiedAt: null,
      })),
    }
  }

  const records = await createSupabaseProgressStore(supabase).listVerified(student.id).catch((error: unknown) => {
    throw createError({ statusCode: 500, message: error instanceof Error ? error.message : 'Progress lookup failed.' })
  })

  return {
    studentFound: true,
    activities: courseActivities.map((activity) => {
      const match = records.find(record =>
        record.activity_type === activity.activityType && record.chain_id === activity.chainId,
      )

      return {
        id: activity.id,
        completed: Boolean(match),
        verifiedAt: match?.verified_at ?? null,
      }
    }),
  }
})
