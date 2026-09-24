import { describe, expect, it } from 'vitest'
import type { ApprovalLog } from '../../utils/schemas'
import { ApprovalScanUnavailableError, UNLIMITED_FLOOR, createApprovalsScan, formatAllowance } from './index'
import { InMemoryApprovalReader } from './memory'

const owner = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const fins = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const usdc = '0x0000000000000000000000000000000000000AAA'
const pixels = '0x0000000000000000000000000000000000000BBB'
const drainer = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
const router = '0x0000000000000000000000000000000000000CCC'
const MAX = 2n ** 256n - 1n

const log = (values: Partial<ApprovalLog>): ApprovalLog => ({
  kind: 'erc20', token: fins, spender: drainer, blockNumber: 10n, logIndex: 0, ...values,
})

function setup(logs: ApprovalLog[], latest = 1_000n) {
  const reader = new InMemoryApprovalReader(latest, logs)
  reader.tokens.set(fins.toLowerCase(), { symbol: 'FINS', decimals: 18, balance: 5_000n * 10n ** 18n })
  reader.tokens.set(usdc.toLowerCase(), { symbol: 'USDC', decimals: 6, balance: 0n })
  return { reader, scan: createApprovalsScan({ chainId: 11155111, reader }) }
}

describe('Approvals scan', () => {
  it('reports only approvals whose current allowance is still open', async () => {
    const { reader, scan } = setup([log({}), log({ token: usdc, spender: router, blockNumber: 20n })])
    reader.setAllowance('erc20', fins, drainer, MAX)
    reader.setAllowance('erc20', usdc, router, 0n) // spent down or revoked since the log

    const approvals = await scan.scan(owner)
    expect(approvals).toHaveLength(1)
    expect(approvals[0]).toMatchObject({ token: fins, spender: drainer, unlimited: true, symbol: 'FINS' })
  })

  it('reads each token and spender pair once however many logs it has', async () => {
    const { reader, scan } = setup([log({ blockNumber: 5n }), log({ blockNumber: 9n }), log({ blockNumber: 9n, logIndex: 3 })])
    reader.setAllowance('erc20', fins, drainer, 7n)
    const approvals = await scan.scan(owner)
    expect(approvals).toHaveLength(1)
    expect(approvals[0]!.blockNumber).toBe(9n)
  })

  it('includes NFT operator approvals, which carry no balance or decimals', async () => {
    const { reader, scan } = setup([log({ kind: 'nft', token: pixels, spender: drainer })])
    reader.setAllowance('nft', pixels, drainer, 1n)
    const [approval] = await scan.scan(owner)
    expect(approval).toMatchObject({ kind: 'nft', symbol: 'NFT', decimals: 0, balance: 0n, unlimited: false })
    expect(formatAllowance(approval!)).toBe('Every item in the collection')
  })

  it('ranks unlimited approvals over held assets first', async () => {
    const { reader, scan } = setup([
      log({ token: usdc, spender: router, blockNumber: 900n }),
      log({ token: fins, spender: drainer, blockNumber: 100n }),
    ])
    reader.setAllowance('erc20', usdc, router, 50n * 10n ** 6n)
    reader.setAllowance('erc20', fins, drainer, UNLIMITED_FLOOR)
    const approvals = await scan.scan(owner)
    expect(approvals.map(approval => approval.token)).toEqual([fins, usdc])
    expect(formatAllowance(approvals[1]!)).toBe('50 USDC')
  })

  it('splits the block range when the RPC rejects a wide query, without losing logs', async () => {
    const { reader, scan } = setup([log({ blockNumber: 3n }), log({ token: usdc, spender: router, blockNumber: 99_000n })], 100_000n)
    reader.maxRange = 20_000n
    reader.setAllowance('erc20', fins, drainer, 1n)
    reader.setAllowance('erc20', usdc, router, 1n)
    expect(await scan.scan(owner)).toHaveLength(2)
    expect(reader.requests.length).toBeGreaterThan(2)
  })

  it('fails loudly instead of reporting a clean wallet when history is unreadable', async () => {
    const { reader, scan } = setup([log({})])
    reader.failAll = true
    reader.setAllowance('erc20', fins, drainer, MAX)
    await expect(scan.scan(owner)).rejects.toBeInstanceOf(ApprovalScanUnavailableError)
  })

  it('still reports an approval when token metadata cannot be read', async () => {
    const { reader, scan } = setup([log({ token: router })])
    reader.setAllowance('erc20', router, drainer, 1n)
    const [approval] = await scan.scan(owner)
    expect(approval).toMatchObject({ symbol: 'Unknown token', decimals: 18, balance: 0n })
  })

  it('only scans the lookback window', async () => {
    const reader = new InMemoryApprovalReader(1_000_000n, [])
    await createApprovalsScan({ chainId: 1, reader, lookbackBlocks: 10n }).scan(owner)
    expect(reader.requests.every(request => request.fromBlock === 999_990n && request.toBlock === 1_000_000n)).toBe(true)
  })
})
