import type { ChainActionHash, ChainReceiptStatus, ChainWriteRequest, ChainWriter } from '../../utils/schemas'

export class InMemoryChainWriter implements ChainWriter {
  readonly requests: ChainWriteRequest[] = []
  readonly receiptHashes: ChainActionHash[] = []

  constructor(
    private readonly writes: Array<ChainActionHash | Error | Promise<ChainActionHash>>,
    private readonly receipts: Array<ChainReceiptStatus | Error | Promise<ChainReceiptStatus>>,
  ) {}

  async write(request: ChainWriteRequest) {
    this.requests.push(request)
    const outcome = this.writes.shift()
    if (outcome instanceof Error) throw outcome
    if (outcome === undefined) throw new Error('No scripted Chain write remains.')
    return outcome
  }

  async waitForReceipt(hash: ChainActionHash) {
    this.receiptHashes.push(hash)
    const outcome = this.receipts.shift()
    if (outcome instanceof Error) throw outcome
    if (outcome === undefined) throw new Error('No scripted Chain receipt remains.')
    return outcome
  }
}
