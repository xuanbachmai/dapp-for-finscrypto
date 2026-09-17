-- Whitelist z5781854 for the Base mainnet (chain 8453) faucet.
--
-- Base mainnet dispenses REAL ETH, so the 8453 faucet is whitelist-gated
-- (see `requiresWhitelist` in apps/web/app/utils/faucet.ts). Only zIDs present
-- in faucet_whitelist_zids for chain_id 8453 can claim. As of this migration,
-- z5781854 is intended to be the sole approved claimant on Base mainnet.
insert into faucet_whitelist_zids (chain_id, zid)
values (8453, 'z5781854')
on conflict (chain_id, zid) do nothing;
