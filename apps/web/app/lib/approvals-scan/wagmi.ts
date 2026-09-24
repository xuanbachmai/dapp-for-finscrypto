import { getPublicClient, type Config } from '@wagmi/core'
import { erc20Abi, getAddress, parseAbiItem } from 'viem'
import type { SupportedChainId } from '../../utils/chains'
import type { ApprovalReader } from '../../utils/schemas'

const approvalEvent = parseAbiItem('event Approval(address indexed owner, address indexed spender, uint256 value)')
const approvalForAllEvent = parseAbiItem('event ApprovalForAll(address indexed owner, address indexed operator, bool approved)')
const isApprovedForAllAbi = [parseAbiItem('function isApprovedForAll(address owner, address operator) view returns (bool)')]

export function createWagmiApprovalReader(config: Config, chainId: SupportedChainId): ApprovalReader {
  const client = () => {
    const publicClient = getPublicClient(config, { chainId })
    if (!publicClient) throw new Error('Approval public client is unavailable.')
    return publicClient
  }

  return {
    getBlockNumber: () => client().getBlockNumber({ cacheTime: 0 }),

    async getApprovalLogs({ kind, owner, fromBlock, toBlock }) {
      if (kind === 'erc20') {
        const logs = await client().getLogs({ event: approvalEvent, args: { owner }, fromBlock, toBlock })
        return logs.flatMap(log => log.args.spender && log.blockNumber !== null && log.logIndex !== null
          ? [{ kind, token: getAddress(log.address), spender: getAddress(log.args.spender), blockNumber: log.blockNumber, logIndex: log.logIndex }]
          : [])
      }
      // ERC-721 and ERC-1155 share ApprovalForAll. ERC-20 never emits it.
      const logs = await client().getLogs({ event: approvalForAllEvent, args: { owner }, fromBlock, toBlock })
      return logs.flatMap(log => log.args.operator && log.blockNumber !== null && log.logIndex !== null
        ? [{ kind, token: getAddress(log.address), spender: getAddress(log.args.operator), blockNumber: log.blockNumber, logIndex: log.logIndex }]
        : [])
    },

    async allowance(kind, token, owner, spender) {
      if (kind === 'erc20') {
        return client().readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [owner, spender] })
      }
      const approved = await client().readContract({
        address: token, abi: isApprovedForAllAbi, functionName: 'isApprovedForAll', args: [owner, spender],
      })
      return approved ? 1n : 0n
    },

    async tokenInfo(token, owner) {
      // Sequential reads avoid assuming Multicall3 is deployed on every supported course chain.
      const [symbol, decimals, balance] = await Promise.all([
        client().readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
        client().readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
        client().readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
      ])
      return { symbol, decimals, balance }
    },
  }
}
