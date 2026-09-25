import { describe, expect, it } from 'vitest'
import { courseActivities, getCourseActivity } from '../../../app/utils/activities'
import { ActivityVerificationResponseSchema } from '../../../app/utils/schemas'
import { createStudentRegistry } from '../student-registry'
import { createInMemoryStudentsStore } from '../student-registry/store'
import { createActivityVerification } from './index'
import { createInMemoryEvidenceSources } from './evidence'
import { createInMemoryProgressStore } from './store'
import { createActivityVerifiers } from './verifiers'

const wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const student = {
  id: '12345678-1234-4234-8234-123456789abc',
  zid: 'z0000001', wallet_address: wallet, display_name: null, verified: true,
  verified_at: '2026-09-12T00:00:00.000Z', created_at: '2026-09-11T00:00:00.000Z',
}
const verifiedAt = '2026-09-28T01:00:00.000Z'
const chainId = 11_155_111
const approvalLabAddress = '0x0000000000000000000000000000000000000a11'
const survivorBadgeAddress = '0x0000000000000000000000000000000000000b22'
const labRead = {
  address: approvalLabAddress, functionName: 'hasCompleted', abi: [], args: [wallet],
}
const badgeRead = {
  address: survivorBadgeAddress, functionName: 'hasBadge', abi: [], args: [wallet],
}

function setup(registered = true) {
  const evidence = createInMemoryEvidenceSources()
  const progress = createInMemoryProgressStore()
  const students = createStudentRegistry(createInMemoryStudentsStore(registered ? [student] : []))
  const verifiers = createActivityVerifiers({ approvalLabAddress, survivorBadgeAddress })
  const verification = createActivityVerification({ students, progress, evidence, verifiers, now: () => new Date(verifiedAt) })
  return { ...verification, evidence, progress, verifiers }
}

describe('Approval & Drain Lab Activity verification', () => {
  it('verifies only once ApprovalLab reports the wallet complete', async () => {
    const scenario = setup()
    scenario.evidence.setContractRead(chainId, labRead, false)
    expect(await scenario.verifyActivity('approval-drain-lab', wallet)).toEqual({
      status: 'NotCompleted', message: getCourseActivity('approval-drain-lab')!.notCompletedMessage,
    })
    expect(await scenario.progress.listVerified(student.id)).toEqual([])

    scenario.evidence.setContractRead(chainId, labRead, true)
    expect(await scenario.verifyActivity('approval-drain-lab', wallet)).toEqual({ status: 'Verified', verifiedAt })
    expect(await scenario.progress.listVerified(student.id)).toEqual([{
      student_id: student.id, activity_type: 'approval_lab', chain_id: chainId, verified_at: verifiedAt,
    }])
  })

  it('keeps earned Progress when the wallet later re-approves a lab drainer', async () => {
    const scenario = setup()
    scenario.evidence.setContractRead(chainId, labRead, true)
    await scenario.verifyActivity('approval-drain-lab', wallet)
    scenario.evidence.setContractRead(chainId, labRead, false)
    expect((await scenario.verifyActivity('approval-drain-lab', wallet)).status).toBe('NotCompleted')
    expect(await scenario.progress.listVerified(student.id)).toHaveLength(1)
  })

  it('returns Unregistered without reading the Chain', async () => {
    const scenario = setup(false)
    expect(await scenario.verifyActivity('approval-drain-lab', wallet)).toEqual({ status: 'Unregistered' })
  })

  it('propagates a failed Chain read without recording Progress', async () => {
    const scenario = setup()
    scenario.evidence.setContractRead(chainId, labRead, new Error('RPC unavailable'))
    await expect(scenario.verifyActivity('approval-drain-lab', wallet)).rejects.toThrow('RPC unavailable')
    expect(await scenario.progress.listVerified(student.id)).toEqual([])
  })

  it('rejects a malformed contract result rather than recording Progress', async () => {
    const scenario = setup()
    scenario.evidence.setContractRead(chainId, labRead, 'true')
    await expect(scenario.verifyActivity('approval-drain-lab', wallet)).rejects.toThrow()
    expect(await scenario.progress.listVerified(student.id)).toEqual([])
  })

  it('has exactly one verifier for every catalogue entry', () => {
    expect(Object.keys(setup().verifiers).sort()).toEqual(courseActivities.map(activity => activity.id).sort())
  })
})

describe('Survivor Credential Activity verification', () => {
  it('verifies only once the SurvivorBadge reports the wallet holds its badge', async () => {
    const scenario = setup()
    scenario.evidence.setContractRead(chainId, badgeRead, false)
    expect(await scenario.verifyActivity('survivor-badge', wallet)).toEqual({
      status: 'NotCompleted', message: getCourseActivity('survivor-badge')!.notCompletedMessage,
    })
    expect(await scenario.progress.listVerified(student.id)).toEqual([])

    scenario.evidence.setContractRead(chainId, badgeRead, true)
    expect(await scenario.verifyActivity('survivor-badge', wallet)).toEqual({ status: 'Verified', verifiedAt })
    expect(await scenario.progress.listVerified(student.id)).toEqual([{
      student_id: student.id, activity_type: 'survivor_badge', chain_id: chainId, verified_at: verifiedAt,
    }])
  })

  it.each([
    { verified: true, message: 'Verified', verifiedAt },
    { verified: false, message: 'Not completed', verifiedAt: null },
  ])('parses the public response %j', (response) => {
    expect(ActivityVerificationResponseSchema.parse(response)).toEqual(response)
  })
})
