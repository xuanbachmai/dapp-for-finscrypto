# FINSCRYPTO Labs

FINSCRYPTO Labs is a separately deployable course dapp for FINS3647/5547. It uses Ethereum Sepolia
for the lab contracts and the existing FINSCRYPTO wallet, student-record and activity-verification
conventions while keeping the approval-drain teaching experience isolated from the main website.

There is no local EVM mode. Browser writes and server verification target Ethereum Sepolia chain ID
`11155111`. Sepolia ETH pays gas and is never a drainable lab asset. The exercise uses a new
valueless `FINS` test token plus the existing Sepolia course `AUD` token at
`0x3676b864a37b31dfe6372384de7d02d27F6FF4e4`.

## Included

| Feature | Route / location |
| --- | --- |
| Approval scanner and revoke flow | `/tools/approvals` |
| Approval & Drain Lab debrief, refunds and completion reward | `/labs/approval-debrief` |
| Classroom lure pages | `/labs/airdrop-claim`, `/labs/verify-wallet` |
| Sepolia ETH faucet directory | `/faucet` |
| Course activity verification | `/activities` |
| Lab contracts and operator scripts | `contracts/` |

## Configuration

Copy `.env.example` to `.env` and configure:

- the shared Supabase URL, anon key and service-role key;
- `NUXT_SEPOLIA_RPC_URL` for server-side activity verification;
- the FINS/AUD token and drainer `NUXT_PUBLIC_*_ADDRESS` values from the Sepolia deployment;
- an optional WalletConnect project ID.

Missing contract addresses are handled as an explicit “deployment required” state. The dapp never
falls back to guessed addresses or a development chain. The dapp does not custody a Sepolia faucet
key; `/faucet` links to established public faucets.

## Deploy the lab contracts

Set `SEPOLIA_RPC_URL`, export a dedicated `SEPOLIA_DEPLOYER_PRIVATE_KEY`, and set
`LAB_OPERATOR_ADDRESS` to the staff wallet that will run supervised sweeps/refunds. Then run:

```bash
pnpm contracts:deploy:sepolia
```

The script refuses to run on any chain other than Sepolia and writes
`contracts/deployments/approval-lab-11155111.json`. Copy its addresses into the matching public
environment variables. The AUD token address is fixed to the existing course deployment; each
round gets separate immutable FINS and AUD drainers. The deployer and classroom operator may be
different accounts; neither private key belongs in the browser or repository.

## Run the dapp

```bash
pnpm install
pnpm dev
```

The local web server still talks to a live Sepolia RPC. A local Supabase instance can be used for
UI/API development, but it does not create a substitute blockchain network.

## Faucet policy

The faucet page links to public Sepolia ETH faucets maintained by established providers and to the
current ethereum.org list. Sepolia ETH is used only for transaction fees. Drainers explicitly reject
native ETH so Students keep gas for revocation, refunds and reward claims. The in-lab FINS token has
its own once-per-wallet classroom faucet and has no monetary value.

After all FINS/AUD approvals are revoked and every drained token is refunded, a Student can claim
one atomic completion airdrop: `500 FINS` plus a non-transferable “I Survived a
Hack” ERC-721 badge. Its final SVG and metadata are generated fully on-chain. Staff can sponsor the
reward gas for all eligible claimants by setting `LAB_OPERATOR_PRIVATE_KEY` and running:

```powershell
$env:ACTION = "reward"
pnpm contracts:operate:sepolia
```

The operator action skips incomplete and already-rewarded wallets. Students can also self-claim from
the debrief page if staff do not run the sponsored airdrop.

## Checks

| Command | Covers |
| --- | --- |
| `pnpm contracts:test` | Foundry contract tests |
| `pnpm test` | Approval scanning, activity verification and faucet policy |
| `pnpm lint` | Nuxt/TypeScript typecheck |
| `pnpm build` | Production Nuxt build |

The optional live deployment check runs only when `NUXT_SEPOLIA_RPC_URL` and
`NUXT_PUBLIC_APPROVAL_LAB_ADDRESS` are both present in the test process.

## Platform integration

Deploy this app on its own origin and add it to the existing platform's DApp catalogue as an
external Week 3 FINSCRYPTO dapp. Keep registration on `finscrypto.xyz`; this app reads the same
verified student records and links users back to the platform when registration is missing.

See `docs/ADR-001-separate-finscrypto-labs-dapp.md` for the integration decision and operational
consequences.
