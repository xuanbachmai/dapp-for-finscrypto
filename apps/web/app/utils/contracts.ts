import type { Abi, Address } from 'viem'
import { getAddress, isAddress, zeroAddress } from 'viem'
import { approvalLabAbi } from './abis/approvalLab'
import { courseAudAbi } from './abis/courseAud'
import { drainerAbi } from './abis/drainer'
import { fakeAirdropAbi } from './abis/fakeAirdrop'
import { finsTokenAbi } from './abis/finsToken'

export const labContractNames = [
  'finsToken',
  'audToken',
  'drainerRound1',
  'drainerRound2',
  'audDrainerRound1',
  'audDrainerRound2',
  'fakeAirdrop',
  'approvalLab',
] as const

export type LabContractName = (typeof labContractNames)[number]
export type LabContractAddressInput = Partial<Record<LabContractName, string>>

export interface ContractConfig {
  address: Address
  abi: Abi
}

export type LabContracts = Record<LabContractName, ContractConfig>

const abis: Record<LabContractName, Abi> = {
  finsToken: finsTokenAbi as Abi,
  audToken: courseAudAbi as Abi,
  drainerRound1: drainerAbi as Abi,
  drainerRound2: drainerAbi as Abi,
  audDrainerRound1: drainerAbi as Abi,
  audDrainerRound2: drainerAbi as Abi,
  fakeAirdrop: fakeAirdropAbi as Abi,
  approvalLab: approvalLabAbi as Abi,
}

/**
 * Contract addresses are deployment data, not development defaults. Missing or malformed
 * values become the zero address so the UI can render an explicit configuration warning
 * without ever sending a transaction to a guessed address.
 */
export function createLabContracts(input: LabContractAddressInput = {}): LabContracts {
  return Object.fromEntries(labContractNames.map((name) => {
    const value = input[name]
    const address = value && isAddress(value) ? getAddress(value) : zeroAddress
    return [name, { address, abi: abis[name] }]
  })) as LabContracts
}

export function areLabContractsConfigured(contracts: LabContracts) {
  return labContractNames.every(name => contracts[name].address !== zeroAddress)
}

export function getLabContract(contracts: LabContracts, name: LabContractName): ContractConfig {
  return contracts[name]
}
