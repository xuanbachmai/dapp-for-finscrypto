import type { Abi, Address } from 'viem'
import { approvalLabAbi } from './abis/approvalLab'
import { drainerAbi } from './abis/drainer'
import { fakeAirdropAbi } from './abis/fakeAirdrop'
import { labAudAbi } from './abis/labAud'
import type { SupportedChainId } from './chains'

export interface ContractConfig {
  address: Address
  abi: Abi
}

export const contracts: Record<number, Record<string, ContractConfig>> = {
  // Local Anvil. Addresses are deterministic for the first five deployments from Anvil
  // account #0 on a fresh node (contracts/script/DeployApprovalLab.s.sol).
  31337: {
    labAud: {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
      abi: labAudAbi as Abi,
    },
    drainerRound1: {
      address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Address,
      abi: drainerAbi as Abi,
    },
    drainerRound2: {
      address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Address,
      abi: drainerAbi as Abi,
    },
    fakeAirdrop: {
      address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as Address,
      abi: fakeAirdropAbi as Abi,
    },
    approvalLab: {
      address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as Address,
      abi: approvalLabAbi as Abi,
    },
  },
  // FINSCRYPTO (36475547): add the five lab entries here after deploying with
  // contracts/script/DeployApprovalLab.s.sol --rpc-url finscrypto. Addresses are written to
  // contracts/deployments/approval-lab-36475547.json.
}

/** Chains with the Approval & Drain Lab deployed. The lab pages work on any of them. */
export const approvalLabChainIds = Object.keys(contracts)
  .map(Number)
  .filter(chainId => Boolean(contracts[chainId]?.approvalLab)) as SupportedChainId[]

export function getContract(name: string, chainId: SupportedChainId): ContractConfig {
  const chain = contracts[chainId]
  if (!chain?.[name]) throw new Error(`Contract ${name} not found on chain ${chainId}`)
  return chain[name]
}
