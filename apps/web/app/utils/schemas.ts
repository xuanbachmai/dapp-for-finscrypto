import type { Abi } from 'viem'
import { z } from 'zod'

// Subset of the course platform's schemas.ts, kept identical where shared, plus the
// Approval & Drain Lab and approvals-scan additions marked below.

// --- Row schemas ---

export const PublicStudentSchema = z.object({
  id: z.string().uuid(),
  wallet_address: z.string().nullable(),
  display_name: z.string().nullable(),
  verified: z.boolean(),
  verified_at: z.string().nullable(),
  created_at: z.string(),
})
export type PublicStudent = z.infer<typeof PublicStudentSchema>

export const StudentIdentitySchema = PublicStudentSchema.extend({
  zid: z.string(),
})
export type StudentIdentity = z.infer<typeof StudentIdentitySchema>

export const VerifiedStudentSchema = StudentIdentitySchema.extend({
  wallet_address: z.string(),
  verified: z.literal(true),
})
export type VerifiedStudent = z.infer<typeof VerifiedStudentSchema>

export const ActivityTypeSchema = z.enum([
  'amm_add_liquidity',
  'amm_bot_trading',
  'amm_swap',
  'aave_supply_eth',
  'bridge_eth_base_sepolia',
  'clob_make',
  'clob_take',
  'meme_buy',
  'meme_create',
  'wave',
  'aud_hold',
  'aud_stake',
  'aud_unstake',
  'casino_flip',
  'faucet_claim',
  'gnosis_safe',
  'predict_bet',
  'lotto_entry',
  'nft_mint',
  // Added: Approval & Drain Lab
  'approval_lab',
])
export type ActivityType = z.infer<typeof ActivityTypeSchema>

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  activity_type: ActivityTypeSchema,
  chain_id: z.number().int(),
  tx_hash: z.string().nullable(),
  verified: z.boolean(),
  verified_at: z.string().nullable(),
  created_at: z.string(),
})
export type Activity = z.infer<typeof ActivitySchema>

export const ProgressIdentitySchema = ActivitySchema.pick({ student_id: true, activity_type: true, chain_id: true })
export type ProgressIdentity = z.infer<typeof ProgressIdentitySchema>
export const ProgressRecordSchema = ProgressIdentitySchema.extend({ verified_at: z.string().nullable() })
export type ProgressRecord = z.infer<typeof ProgressRecordSchema>

export const ActivityVerificationVerdictSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('Verified'), verifiedAt: z.string() }),
  z.object({ status: z.literal('NotCompleted'), message: z.string() }),
  z.object({ status: z.literal('UnknownActivity') }),
  z.object({ status: z.literal('Unregistered') }),
  z.object({ status: z.literal('ExplorerUnavailable'), message: z.string() }),
])
export type ActivityVerificationVerdict = z.infer<typeof ActivityVerificationVerdictSchema>

export const ActivityVerificationResponseSchema = z.discriminatedUnion('verified', [
  z.object({ verified: z.literal(true), message: z.string(), verifiedAt: z.string() }),
  z.object({ verified: z.literal(false), message: z.string(), verifiedAt: z.null() }),
])
export type ActivityVerificationResponse = z.infer<typeof ActivityVerificationResponseSchema>

export const ActivityStatusResponseSchema = z.object({
  studentFound: z.boolean(),
  activities: z.array(z.object({ id: z.string(), completed: z.boolean(), verifiedAt: z.string().nullable() })),
})
export type ActivityStatusResponse = z.infer<typeof ActivityStatusResponseSchema>

export const EvidenceContractReadSchema = z.object({
  address: z.string(),
  abi: z.array(z.string()),
  functionName: z.string(),
  args: z.array(z.string()).default([]),
})
export type EvidenceContractRead = z.infer<typeof EvidenceContractReadSchema>
export const EvidenceBooleanSchema = z.boolean()
export const EvidenceUintSchema = z.bigint().nonnegative()

// --- Request schemas ---

export const ActivityStatusQuerySchema = z.object({
  walletAddress: z.string(),
})
export type ActivityStatusQuery = z.infer<typeof ActivityStatusQuerySchema>

export const ActivityVerificationRequestSchema = z.object({
  walletAddress: z.string(),
})
export type ActivityVerificationRequest = z.infer<typeof ActivityVerificationRequestSchema>

// --- Chain runtime configuration and error verdicts ---

export const ChainRuntimeConfigSchema = z.object({
  // Added: local Anvil Chain for the standalone build.
  localRpcUrl: z.string().optional(),
  finscryptoRpcUrl: z.string().optional(),
})
export type ChainRuntimeConfig = z.infer<typeof ChainRuntimeConfigSchema>

export const ChainRuntimeErrorSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('missing_config'),
    chainId: z.number(),
    setting: z.string(),
  }),
  z.object({
    status: z.literal('wrong_chain'),
    chainId: z.number(),
    actualChainId: z.string(),
  }),
])
export type ChainRuntimeError = z.infer<typeof ChainRuntimeErrorSchema>

// --- Chain action ---

export const ChainActionRequestSchema = z.object({
  functionName: z.string().min(1),
  args: z.array(z.unknown()).readonly().optional(),
  value: z.bigint().nonnegative().optional(),
  contract: z.string().min(1).optional(),
})
export type ChainActionRequest = z.infer<typeof ChainActionRequestSchema>

export const ChainActionHashSchema = z.templateLiteral(['0x', z.string()])
export type ChainActionHash = z.infer<typeof ChainActionHashSchema>

export const ChainWriteRequestSchema = ChainActionRequestSchema.omit({ contract: true }).extend({
  address: ChainActionHashSchema,
  abi: z.custom<Abi>(),
  chainId: z.number().int().positive(),
})
export type ChainWriteRequest = z.infer<typeof ChainWriteRequestSchema>

export const ChainReceiptStatusSchema = z.enum(['success', 'failure'])
export type ChainReceiptStatus = z.infer<typeof ChainReceiptStatusSchema>

export const ChainActionFailureReasonSchema = z.enum([
  'pending',
  'wallet-not-connected',
  'wrong-chain',
  'connection-cancelled',
  'user-rejected',
  'insufficient-funds',
  'receipt-failed',
  'failed',
])
export type ChainActionFailureReason = z.infer<typeof ChainActionFailureReasonSchema>

export const ChainWriterSchema = z.object({
  write: z.function({ input: [ChainWriteRequestSchema], output: z.promise(ChainActionHashSchema) }),
  waitForReceipt: z.function({ input: [ChainActionHashSchema], output: z.promise(ChainReceiptStatusSchema) }),
})
export type ChainWriter = z.infer<typeof ChainWriterSchema>

// --- Added: approvals scan ---

const AddressSchema = z.templateLiteral(['0x', z.string()]).refine(value => /^0x[0-9a-fA-F]{40}$/.test(value))

export const ApprovalKindSchema = z.enum(['erc20', 'nft'])
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>

export const ApprovalLogSchema = z.object({
  kind: ApprovalKindSchema,
  token: AddressSchema,
  spender: AddressSchema,
  blockNumber: z.bigint().nonnegative(),
  logIndex: z.number().int().nonnegative(),
})
export type ApprovalLog = z.infer<typeof ApprovalLogSchema>

export const ApprovalLogRequestSchema = z.object({
  kind: ApprovalKindSchema,
  owner: AddressSchema,
  fromBlock: z.bigint().nonnegative(),
  toBlock: z.bigint().nonnegative(),
})
export type ApprovalLogRequest = z.infer<typeof ApprovalLogRequestSchema>

export const LiveApprovalSchema = ApprovalLogSchema.omit({ logIndex: true }).extend({
  chainId: z.number().int(),
  symbol: z.string(),
  decimals: z.number().int().nonnegative(),
  allowance: z.bigint().nonnegative(),
  unlimited: z.boolean(),
  balance: z.bigint().nonnegative(),
})
export type LiveApproval = z.infer<typeof LiveApprovalSchema>

export interface ApprovalReader {
  getBlockNumber(): Promise<bigint>
  getApprovalLogs(request: ApprovalLogRequest): Promise<ApprovalLog[]>
  allowance(kind: ApprovalKind, token: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`): Promise<bigint>
  tokenInfo(token: `0x${string}`, owner: `0x${string}`): Promise<{ symbol: string, decimals: number, balance: bigint }>
}

// --- Added: Approval & Drain Lab ---

export const ApprovalLabProgressSchema = z.object({
  drained: z.boolean(),
  revoked: z.boolean(),
  round2Started: z.boolean(),
  round2Tested: z.boolean(),
  round2Passed: z.boolean(),
  complete: z.boolean(),
  secondsExposed: z.bigint().nonnegative(),
  round1Allowance: z.bigint().nonnegative(),
  round2Allowance: z.bigint().nonnegative(),
})
export type ApprovalLabProgress = z.infer<typeof ApprovalLabProgressSchema>
