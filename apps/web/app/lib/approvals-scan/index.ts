import type { ApprovalLog, ApprovalReader, LiveApproval } from '../../utils/schemas'

export const APPROVAL_LOOKBACK_BLOCKS = 500_000n
const MIN_CHUNK_BLOCKS = 2_000n

/** Anything at or above half of uint256 is "unlimited" for practical purposes. */
export const UNLIMITED_FLOOR = (2n ** 256n - 1n) / 2n

export class ApprovalScanUnavailableError extends Error {
  constructor(chainId: number, options?: ErrorOptions) {
    super(`Unable to read approval history on chain ${chainId}.`, options)
    this.name = 'ApprovalScanUnavailableError'
  }
}

type Owner = `0x${string}`

/**
 * Finds every approval a wallet still has open on one Chain.
 *
 * There is no on-chain call that lists a wallet's approvals, so history (Approval and
 * ApprovalForAll logs) says where to look, and current state (allowance / isApprovedForAll)
 * says what is actually still open.
 */
export function createApprovalsScan(options: {
  chainId: number
  reader: ApprovalReader
  lookbackBlocks?: bigint
}) {
  const { chainId, reader } = options
  const lookback = options.lookbackBlocks ?? APPROVAL_LOOKBACK_BLOCKS

  // RPCs cap log ranges inconsistently. Ask for the whole window and split on failure,
  // so a permissive node costs one request and a strict one costs a few.
  async function logsInRange(kind: ApprovalLog['kind'], owner: Owner, fromBlock: bigint, toBlock: bigint): Promise<ApprovalLog[]> {
    try {
      return await reader.getApprovalLogs({ kind, owner, fromBlock, toBlock })
    } catch (cause) {
      const span = toBlock - fromBlock
      // An error on a small range is not a range limit; do not report an empty wallet.
      if (span <= MIN_CHUNK_BLOCKS) throw new ApprovalScanUnavailableError(chainId, { cause })
      const middle = fromBlock + span / 2n
      const [left, right] = await Promise.all([
        logsInRange(kind, owner, fromBlock, middle),
        logsInRange(kind, owner, middle + 1n, toBlock),
      ])
      return [...left, ...right]
    }
  }

  async function scan(owner: Owner): Promise<LiveApproval[]> {
    const latest = await reader.getBlockNumber()
    const fromBlock = latest > lookback ? latest - lookback : 0n

    const logs = (await Promise.all([
      logsInRange('erc20', owner, fromBlock, latest),
      logsInRange('nft', owner, fromBlock, latest),
    ])).flat()

    // The latest log per (kind, token, spender) supersedes earlier ones.
    const candidates = new Map<string, ApprovalLog>()
    for (const log of logs) {
      const key = `${log.kind}:${log.token.toLowerCase()}:${log.spender.toLowerCase()}`
      const previous = candidates.get(key)
      if (!previous || log.blockNumber > previous.blockNumber
        || (log.blockNumber === previous.blockNumber && log.logIndex > previous.logIndex)) {
        candidates.set(key, log)
      }
    }

    const live = await Promise.all([...candidates.values()].map(async (log) => {
      const allowance = await reader.allowance(log.kind, log.token, owner, log.spender)
      if (allowance === 0n) return null

      const info = await reader.tokenInfo(log.token, owner).catch(() => null)
      return {
        kind: log.kind,
        token: log.token,
        spender: log.spender,
        blockNumber: log.blockNumber,
        chainId,
        symbol: info?.symbol ?? (log.kind === 'nft' ? 'NFT' : 'Unknown token'),
        decimals: log.kind === 'nft' ? 0 : info?.decimals ?? 18,
        allowance,
        unlimited: log.kind === 'erc20' && allowance >= UNLIMITED_FLOOR,
        balance: log.kind === 'nft' ? 0n : info?.balance ?? 0n,
      } satisfies LiveApproval
    }))

    return sortByRisk(live.filter(approval => approval !== null))
  }

  return { scan }
}

export function approvalRisk(approval: LiveApproval) {
  return (approval.unlimited || approval.kind === 'nft' ? 2 : 0) + (approval.balance > 0n ? 1 : 0)
}

/** Riskiest first: open-ended permission over assets the wallet actually holds. */
export function sortByRisk(approvals: LiveApproval[]) {
  return [...approvals].sort((a, b) =>
    approvalRisk(b) - approvalRisk(a) || (a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1),
  )
}

export function approvalId(approval: Pick<LiveApproval, 'chainId' | 'kind' | 'token' | 'spender'>) {
  return `${approval.chainId}:${approval.kind}:${approval.token}:${approval.spender}`.toLowerCase()
}

export function formatTokenAmount(amount: bigint, decimals: number) {
  const unit = 10n ** BigInt(decimals)
  const whole = amount / unit
  const fraction = decimals === 0 ? 0n : (amount % unit) * 100n / unit
  return fraction === 0n ? whole.toLocaleString('en-AU') : `${whole.toLocaleString('en-AU')}.${fraction.toString().padStart(2, '0')}`
}

export function formatAllowance(approval: LiveApproval) {
  if (approval.kind === 'nft') return 'Every item in the collection'
  if (approval.unlimited) return 'Unlimited'
  return `${formatTokenAmount(approval.allowance, approval.decimals)} ${approval.symbol}`
}
