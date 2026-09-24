import { parseEther } from 'ethers'
import type { ChainRuntimeError, FaucetChainConfig, FaucetRequest, FaucetVerdict, VerifiedStudent } from '../../../app/utils/schemas'
import type { FaucetClaimsStore } from './store'

export function createFaucetClaim(dependencies: {
  policies: Partial<Record<number, FaucetChainConfig>>
  registry: { findVerifiedByWallet(wallet: string): Promise<VerifiedStudent | null> }
  claims: FaucetClaimsStore
  runtime: {
    getFaucetSigner(chainId: number): Promise<ChainRuntimeError | {
      status: 'ready'
      signer: { sendTransaction(transaction: { to: string, value: bigint }): Promise<{ hash: string }> }
    }>
  }
  now?: () => number
  logPersistenceError: (error: unknown, txHash: string) => void
}) {
  const { policies, registry, claims, runtime, logPersistenceError, now = Date.now } = dependencies

  return {
    async claim({ walletAddress, chainId }: FaucetRequest): Promise<FaucetVerdict> {
      const policy = policies[chainId]
      if (!policy) return { status: 'denied', reason: 'not_configured' }
      if (!policy.enabled) return { status: 'denied', reason: 'disabled' }

      const student = await registry.findVerifiedByWallet(walletAddress)
      if (!student) return { status: 'denied', reason: 'unregistered' }

      const recentClaim = await claims.latestClaim(student.id, chainId)
      if (recentClaim) {
        const nextClaimAt = Date.parse(recentClaim.created_at) + policy.cooldownMs
        if (now() <= nextClaimAt) {
          return { status: 'denied', reason: 'cooldown', nextClaimAt: new Date(nextClaimAt).toISOString() }
        }
      }

      const result = await runtime.getFaucetSigner(chainId)
      if (result.status !== 'ready') return { status: 'denied', reason: 'not_configured' }

      const amount = parseEther(policy.amountEth)
      const tx = await result.signer.sendTransaction({ to: student.wallet_address, value: amount })
      try {
        await claims.record({
          student_id: student.id,
          chain_id: chainId,
          amount_wei: amount.toString(),
          tx_hash: tx.hash,
          created_at: new Date(now()).toISOString(),
        })
      } catch (error) {
        logPersistenceError(error, tx.hash)
      }
      return { status: 'sent', txHash: tx.hash }
    },
  }
}
