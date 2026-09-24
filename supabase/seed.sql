-- Local database development only. Production uses the existing FINSCRYPTO student registry.
-- Keep a single presenter wallet for UI/API development; no local-chain accounts are seeded.

insert into students (zid, email, wallet_address, display_name, verified, verified_at)
values
  ('z0000004', 'z0000004@unsw.edu.au', '0x554c209b68a3e2b82ba4ee1c7cfcf8b68f651fe3', 'Demo Presenter', true, now())
on conflict (zid) do nothing;
