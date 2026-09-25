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
  {
    id: 'survivor-badge',
    notCompletedMessage: 'This wallet has not claimed its Survivor reward yet. Finish the Approval & Drain Lab, then claim your 500 FINS and badge.',
    number: 2,
    week: 3,
    title: 'Claim Your Survivor Credential',
    description: 'After surviving the drain, claim the completion reward: 500 FINS plus a non-transferable "I Survived" badge with fully on-chain artwork.',
    activityType: 'survivor_badge',
    chainId: 11155111,
    chainLabel: 'Sepolia',
    dappPath: '/labs/survivor-badge',
    requirements: [
      'Finish the Approval & Drain Lab first: get drained, revoke every approval, and recover every token.',
      'Open the Survivor Credential page and claim your reward (or let staff run the sponsored airdrop).',
      'Return here to verify that your soulbound badge has been minted.',
    ],
  },
] as const

export type CourseActivityDefinition = (typeof courseActivities)[number]
export type ActivityId = CourseActivityDefinition['id']

export function getCourseActivity(id: string) {
  return courseActivities.find(activity => activity.id === id) ?? null
}
