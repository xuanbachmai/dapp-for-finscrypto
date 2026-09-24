export const courseActivities = [
  {
    id: 'approval-drain-lab',
    notCompletedMessage: 'This wallet has not finished the Approval & Drain Lab: get drained, revoke every lab approval, and recover every drained token.',
    number: 1,
    week: 3,
    title: 'Survive an Approval Drain',
    description: 'Fall for a convincing airdrop lure, watch an unlimited approval empty your wallet, then revoke it and recover every drained token.',
    activityType: 'approval_lab',
    chainId: 11155111,
    chainLabel: 'Sepolia',
    dappPath: '/labs/approval-debrief',
    requirements: [
      'Connect your registered wallet on Sepolia and claim FINS from the classroom token faucet.',
      'Follow the link your tutor shares in class. Staff run the drain once the room has had a go.',
      'Open Approvals, revoke every lab approval, then confirm recovery on the debrief page.',
      'Recover every drained FINS and AUD token, then return here to verify the Activity.',
    ],
  },
] as const

export type CourseActivityDefinition = (typeof courseActivities)[number]
export type ActivityId = CourseActivityDefinition['id']

export function getCourseActivity(id: string) {
  return courseActivities.find(activity => activity.id === id) ?? null
}
