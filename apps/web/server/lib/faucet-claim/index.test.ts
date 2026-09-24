import { describe, expect, it } from 'vitest'
import { parseEther } from 'ethers'
import type { FaucetClaim, FaucetClaimRecord, VerifiedStudent } from '../../../app/utils/schemas'
import { createFaucetClaim } from './index'

const chainId = 11_155_111 as const
const now = Date.parse('2026-09-21T00:00:00.000Z')
const wallet = '0x00000000000000000000000000000000000000A1'
const student: VerifiedStudent = {
  id: '12345678-1234-4234-8234-123456789abc',
  zid: 'z0000001',
  wallet_address: wallet,
  display_name: null,
  verified: true,
  verified_at: '2026-09-20T00:00:00.000Z',
  created_at: '2026-09-20T00:00:00.000Z',
}

function setup(options: { registered?: boolean; recentClaim?: boolean; signerReady?: boolean } = {}) {
  const sent: Array<{ to: string; value: bigint }> = []
  const claims: FaucetClaim[] = options.recentClaim ? [{
    id: '12345678-1234-4234-8234-123456789abd',
    student_id: student.id,
    chain_id: chainId,
    amount_wei: parseEther('0.5').toString(),
    tx_hash: '0xprevious',
    created_at: new Date(now - 60_000).toISOString(),
  }] : []

  const faucet = createFaucetClaim({
    policies: { [chainId]: { enabled: true, amountEth: '0.5', cooldownMs: 86_400_000 } },
    registry: { findVerifiedByWallet: async () => options.registered === false ? null : student },
    claims: {
      latestClaim: async () => claims.at(-1) ?? null,
      record: async (claim: FaucetClaimRecord) => {
        claims.push({ ...claim, id: '12345678-1234-4234-8234-123456789abe' })
      },
    },
    runtime: {
      getFaucetSigner: async () => options.signerReady === false
        ? { status: 'missing_config' as const, chainId, setting: 'sepoliaFaucetPrivateKey' }
        : {
            status: 'ready' as const,
            signer: {
              sendTransaction: async (transaction: { to: string; value: bigint }) => {
                sent.push(transaction)
                return { hash: '0xsent' }
              },
            },
          },
    },
    now: () => now,
    logPersistenceError: () => {},
  })

  return { faucet, sent, claims }
}

describe('Sepolia faucet policy', () => {
  it('sends the configured amount to a verified wallet and records the claim', async () => {
    const context = setup()
    await expect(context.faucet.claim({ walletAddress: wallet, chainId })).resolves.toEqual({ status: 'sent', txHash: '0xsent' })
    expect(context.sent).toEqual([{ to: wallet, value: parseEther('0.5') }])
    expect(context.claims).toHaveLength(1)
  })

  it('rejects unregistered wallets before touching the signer', async () => {
    const context = setup({ registered: false })
    await expect(context.faucet.claim({ walletAddress: wallet, chainId })).resolves.toEqual({ status: 'denied', reason: 'unregistered' })
    expect(context.sent).toEqual([])
  })

  it('enforces the persistent cooldown', async () => {
    const context = setup({ recentClaim: true })
    const result = await context.faucet.claim({ walletAddress: wallet, chainId })
    expect(result).toMatchObject({ status: 'denied', reason: 'cooldown' })
    expect(context.sent).toEqual([])
  })

  it('reports missing signer configuration without sending', async () => {
    const context = setup({ signerReady: false })
    await expect(context.faucet.claim({ walletAddress: wallet, chainId })).resolves.toEqual({ status: 'denied', reason: 'not_configured' })
    expect(context.sent).toEqual([])
  })
})
