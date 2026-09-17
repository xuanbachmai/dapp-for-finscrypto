export const courseActivities = [
  {
    id: 'approval-drain-lab',
    notCompletedMessage: 'This wallet has not finished the Approval & Drain Lab: get drained, revoke every lab approval, then refuse the second lure after staff run it.',
    number: 1,
    week: 3,
    title: 'Survive an Approval Drain',
    description: 'Fall for a convincing airdrop lure, watch an unlimited approval empty your wallet, revoke it, then recognise and refuse a second lure.',
    activityType: 'approval_lab',
    chainId: 31337,
    chainLabel: 'Anvil (local)',
    dappPath: '/labs/approval-debrief',
    requirements: [
      'Connect your registered wallet on the lab Chain and claim LAUD from the lab faucet.',
      'Follow the link your tutor shares in class. Staff run the drain once the room has had a go.',
      'Open Approvals, revoke every lab approval, then confirm recovery on the debrief page.',
      'Start round 2 and visit the second lure. You pass by not signing anything.',
      'Return here and verify once staff have run the round-2 attempt.',
    ],
  },
] as const

export type CourseActivityDefinition = (typeof courseActivities)[number]
export type ActivityId = CourseActivityDefinition['id']

export function getCourseActivity(id: string) {
  return courseActivities.find(activity => activity.id === id) ?? null
}
