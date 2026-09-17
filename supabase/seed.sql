-- Local development only. Loaded by `supabase db reset`.
-- Registration (email code + wallet signature) is not part of this standalone build, so three
-- Anvil development accounts are seeded as verified Students. Wallets are stored lowercase,
-- matching the platform's Student registry.
--
--   Anvil #1  0x70997970C51812dc3A010C7d01b50e0d17dc79C8
--   Anvil #2  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
--   Anvil #3  0x90F79bf6EB2c4f870365E785982E1f101E93b906

insert into students (zid, email, wallet_address, display_name, verified, verified_at)
values
  ('z0000001', 'z0000001@unsw.edu.au', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'Local Student 1', true, now()),
  ('z0000002', 'z0000002@unsw.edu.au', '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'Local Student 2', true, now()),
  ('z0000003', 'z0000003@unsw.edu.au', '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 'Local Student 3', true, now())
on conflict (zid) do nothing;
