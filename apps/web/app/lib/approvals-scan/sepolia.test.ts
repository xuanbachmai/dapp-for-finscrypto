import { createPublicClient, http, isAddress } from 'viem'
import { sepolia } from 'viem/chains'
import { describe, expect, it } from 'vitest'

const rpcUrl = process.env.NUXT_SEPOLIA_RPC_URL
const approvalLabAddress = process.env.NUXT_PUBLIC_APPROVAL_LAB_ADDRESS
const canRun = Boolean(rpcUrl && approvalLabAddress && isAddress(approvalLabAddress))

describe.skipIf(!canRun)('Sepolia deployment', () => {
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })

  it('connects to Sepolia and finds deployed Approval Lab bytecode', async () => {
    expect(await client.getChainId()).toBe(sepolia.id)
    const bytecode = await client.getCode({ address: approvalLabAddress as `0x${string}` })
    expect(bytecode && bytecode !== '0x').toBe(true)
  })
})
