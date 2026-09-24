# ADR-001: Integrate FINSCRYPTO Labs as a separate dapp

**Status:** Accepted; amended for Sepolia on 2026-09-22  
**Date:** 2026-09-21  
**Deciders:** FINSCRYPTO course maintainers

## Context

The Approval & Drain Lab began as an isolated build using a local development chain. Course staff
want it to fit the existing FINSCRYPTO platform without putting the deliberately deceptive lure UI
inside the primary website deployment. The dapp must use the existing wallet and student identity,
run on a public testnet, support on-chain activity verification, and give students a safe route to
obtain test gas.

## Decision

Build and deploy the lab as a separate Nuxt dapp with an external entry in the main platform's DApp
catalogue. The dapp targets Ethereum Sepolia chain ID `11155111`. It shares the platform's Supabase
schema and server-side verification conventions, but owns its routes, lab contracts and classroom
operator workflow. The lab ERC-20 is the valueless Sepolia-only FINS classroom token.

Contract addresses are public deployment configuration. The fee page directs students to public
Sepolia ETH faucets; the dapp does not custody a gas-faucet key. There is no local EVM fallback.

## Options considered

### Merge every lab route into the primary website

| Dimension | Assessment |
| --- | --- |
| Deployment complexity | Low |
| Isolation of deceptive classroom UI | Low |
| Platform consistency | High |
| Independent release control | Low |

This minimizes hosting work but couples experimental lab releases and lure pages to the primary
course website.

### Separate dapp with shared platform boundaries

| Dimension | Assessment |
| --- | --- |
| Deployment complexity | Medium |
| Isolation of deceptive classroom UI | High |
| Platform consistency | High |
| Independent release control | High |

This keeps the lab operationally isolated while reusing the student registry, wallet stack and
activity-verification pattern used by the main platform.

### Private course chain

| Dimension | Assessment |
| --- | --- |
| Deployment complexity | Medium |
| Student network setup | High |
| Operator dependency | High |
| Public explorer/tool compatibility | Low |

This offers instructor control but makes the lab depend on private RPC availability, owner approval
and a self-funded faucet. Sepolia provides a standard wallet network, public explorers and several
independent faucets, so the private-chain option was rejected for this lab.

## Consequences

- The main platform needs one external DApp catalogue entry and the deployed app URL.
- Students use the standard Sepolia wallet network and their existing registered wallet identity.
- The lab cannot run until the FINS token, four token-specific drainers, fake airdrop and ApprovalLab
  addresses are deployed and configured; the existing course AUD address is fixed separately.
- Sepolia ETH availability is delegated to public faucets; the app holds no faucet private key.
- Classroom operator actions must target Sepolia and follow course key controls.
- Local development requires Sepolia RPC access; tests remain offline through in-memory adapters.

## Action items

1. Deploy the seven lab contracts to Sepolia chain `11155111` and bind the AUD drainers to the
   existing course AUD token.
2. Configure their public addresses in the dapp environment.
3. Confirm at least two public Sepolia faucets are available to students.
4. Deploy the dapp on its own origin.
5. Add the external dapp URL to the main platform's Week 3 catalogue.
6. Run the live deployment check and classroom rehearsal before release.
