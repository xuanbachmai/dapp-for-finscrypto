import { createConfig, http } from '@wagmi/core'
import { describe, expect, it } from 'vitest'
import { localAnvil } from '../../utils/chains'
import { getContract } from '../../utils/contracts'
import { createApprovalsScan } from './index'
import { createWagmiApprovalReader } from './wagmi'

// Integration check against a running local Anvil with the lab deployed and the simulation run.
// Skipped unless ANVIL_RPC_URL is set, so `pnpm test` stays offline like the platform's suite.
const rpcUrl = process.env.ANVIL_RPC_URL
const round2Victim = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const round2Refuser = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'

describe.skipIf(!rpcUrl)('Approvals scan against local Anvil', () => {
  const config = createConfig({ chains: [localAnvil], transports: { [localAnvil.id]: http(rpcUrl) } })
  const scan = createApprovalsScan({ chainId: localAnvil.id, reader: createWagmiApprovalReader(config, localAnvil.id) })

  it('finds the round-2 drainer approval still open on the wallet that signed twice', async () => {
    const approvals = await scan.scan(round2Victim)
    expect(approvals).toHaveLength(1)
    expect(approvals[0]).toMatchObject({
      token: getContract('labAud', 31337).address,
      spender: getContract('drainerRound2', 31337).address,
      symbol: 'LAUD',
      unlimited: true,
    })
  })

  it('reports nothing open for the wallet that revoked and refused', async () => {
    expect(await scan.scan(round2Refuser)).toEqual([])
  })
})
