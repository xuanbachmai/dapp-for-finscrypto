# FINSCRYPTO Labs (standalone)

Phase-1 risk modules for FINS3647/5547, rebuilt on the course platform's stack and conventions
([jqhils/unsw-fins-website](https://github.com/jqhils/unsw-fins-website)) and tested locally before
anything moves onto the platform. Spec: [FINSCRYPTO-ROADMAP.md](FINSCRYPTO-ROADMAP.md).

Stack matches the platform: Nuxt 3, Vue, Nuxt UI, `@wagmi/vue` + viem, ethers on the server, Supabase,
Foundry (forge-std v1.15.0, OpenZeppelin v5.6.1), pnpm 10.34.4. The old Next.js/Hardhat prototype is in
`_prototype/`.

| Built | Where |
| --- | --- |
| `/tools/approvals` scan + revoke | `apps/web/app/lib/approvals-scan/`, `pages/tools/approvals.vue` |
| Approval & Drain Lab contracts | `contracts/src/` |
| Lures and debrief | `pages/labs/` |
| Activity `approval-drain-lab` + server verifier | `app/utils/activities.ts`, `server/lib/activity-verification/verifiers.ts` |

`ScoreRegistry` from the roadmap is gone: the platform verifies Activities on the server and stores
Progress in Supabase, so the lab exposes `ApprovalLab.hasCompleted(wallet)` and the verifier reads it,
exactly like the Wave Activity reads `hasWaved`.

## Run locally

```bash
anvil --chain-id 31337
```

```bash
cd contracts && forge script script/DeployApprovalLab.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

That key is Anvil's public account #0, never a real key. On a fresh Anvil the addresses match
`apps/web/app/utils/contracts.ts`.

```bash
pnpm dlx supabase start
```

Copy the API URL, anon key and service_role key from `pnpm dlx supabase status` into `.env`.
`supabase/seed.sql` registers Anvil accounts #1–#3 as verified Students.

```bash
pnpm install && pnpm dev
```

Import Anvil account #1 into MetaMask, add the network (RPC `http://127.0.0.1:8545`, chainId 31337),
then open `/labs/approval-debrief`, claim LAUD, and follow `/labs/airdrop-claim`.

Staff levers, from `contracts/` with the same key:

```bash
forge script script/SweepApprovalLab.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <operator>
```

Set `ROUND=2` for the round-2 attempt (must run, or nobody can complete) and `ACTION=refund` to refund.

## Checks

| Command | Covers |
| --- | --- |
| `pnpm contracts:test` | 22 Forge tests, including the round-2 absence proof |
| `pnpm test` | Approvals scan and Activity verification with in-memory adapters |
| `ANVIL_RPC_URL=http://127.0.0.1:8545 pnpm --dir apps/web exec vitest run app/lib/approvals-scan` | Scan against real Anvil logs (after the simulation) |
| `pnpm lint` / `pnpm build` | Nuxt typecheck and production build |

## Differences from the platform to resolve when porting

- Lab Chain is local Anvil (31337); the roadmap places it on Sepolia. Swap `LAB_CHAIN_ID`, the
  `contracts.ts` entry and the Chain runtime mapping.
- Registration, Faucet, week release and the full Activities page are not included; Students are seeded.
- `useChainAction` has one change: it tolerates Chains without a block explorer (Anvil).
- Lure brands are invented: Brightfold Rewards (BFLD) and Sentrywell.
