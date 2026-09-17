import type { ApprovalKind, ApprovalLog, ApprovalLogRequest, ApprovalReader } from '../../utils/schemas'

export class InMemoryApprovalReader implements ApprovalReader {
  readonly requests: ApprovalLogRequest[] = []
  readonly allowances = new Map<string, bigint>()
  readonly tokens = new Map<string, { symbol: string, decimals: number, balance: bigint } | Error>()
  /** Requests spanning more blocks than this fail, like a strict public RPC. */
  maxRange: bigint | null = null
  failAll = false

  constructor(public latestBlock: bigint, public logs: ApprovalLog[] = []) {}

  static key(kind: ApprovalKind, token: string, spender: string) {
    return `${kind}:${token.toLowerCase()}:${spender.toLowerCase()}`
  }

  setAllowance(kind: ApprovalKind, token: string, spender: string, value: bigint) {
    this.allowances.set(InMemoryApprovalReader.key(kind, token, spender), value)
  }

  async getBlockNumber() { return this.latestBlock }

  async getApprovalLogs(request: ApprovalLogRequest) {
    this.requests.push(request)
    if (this.failAll) throw new Error('RPC unavailable')
    if (this.maxRange !== null && request.toBlock - request.fromBlock > this.maxRange) {
      throw new Error('query exceeds max block range')
    }
    return this.logs.filter(log => log.kind === request.kind
      && log.blockNumber >= request.fromBlock && log.blockNumber <= request.toBlock)
  }

  async allowance(kind: ApprovalKind, token: `0x${string}`, _owner: `0x${string}`, spender: `0x${string}`) {
    return this.allowances.get(InMemoryApprovalReader.key(kind, token, spender)) ?? 0n
  }

  async tokenInfo(token: `0x${string}`) {
    const info = this.tokens.get(token.toLowerCase())
    if (!info) throw new Error(`No scripted token ${token}`)
    if (info instanceof Error) throw info
    return info
  }
}
