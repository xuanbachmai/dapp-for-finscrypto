import type { ActivityId } from '../../../app/utils/activities'
import { getCourseActivity } from '../../../app/utils/activities'
import { EvidenceBooleanSchema } from '../../../app/utils/schemas'
import type { ActivityVerifier } from './index'
import { getAddress, isAddress, zeroAddress } from 'viem'

export function createActivityVerifiers(options: { approvalLabAddress?: string, survivorBadgeAddress?: string } = {}) {
  const approvalLabAddress = options.approvalLabAddress && isAddress(options.approvalLabAddress)
    ? getAddress(options.approvalLabAddress)
    : zeroAddress
  const survivorBadgeAddress = options.survivorBadgeAddress && isAddress(options.survivorBadgeAddress)
    ? getAddress(options.survivorBadgeAddress)
    : zeroAddress

  return {
    // Same shape as the platform's Wave verifier: one contract read, the contract decides.
    // ApprovalLab.hasCompleted re-checks live allowances, so a wallet that has re-approved a
    // lab drainer reads as incomplete until it revokes again.
    // The Chain comes from the Activity catalogue, so moving the Activity moves the check with it.
    'approval-drain-lab': async ({ walletAddress, evidence }) => {
      const chainId = getCourseActivity('approval-drain-lab')!.chainId
      if (approvalLabAddress === zeroAddress) throw new Error('The Approval Lab contract address is not configured.')
      const provider = await evidence.providerFor(chainId)
      return EvidenceBooleanSchema.parse(await provider.readContract({
        address: approvalLabAddress,
        abi: ['function hasCompleted(address) view returns (bool)'], functionName: 'hasCompleted', args: [walletAddress],
      }))
    },
    // Separate SurvivorBadge dapp: complete once the wallet holds its soulbound badge.
    'survivor-badge': async ({ walletAddress, evidence }) => {
      const chainId = getCourseActivity('survivor-badge')!.chainId
      if (survivorBadgeAddress === zeroAddress) throw new Error('The Survivor Badge contract address is not configured.')
      const provider = await evidence.providerFor(chainId)
      return EvidenceBooleanSchema.parse(await provider.readContract({
        address: survivorBadgeAddress,
        abi: ['function hasBadge(address) view returns (bool)'], functionName: 'hasBadge', args: [walletAddress],
      }))
    },
  } satisfies Record<ActivityId, ActivityVerifier>
}
