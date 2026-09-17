-- Enable row level security on all application tables created so far.
-- This migration is needed for databases that already applied 001_initial.sql
-- before RLS statements were added there.

alter table if exists students enable row level security;
alter table if exists balances enable row level security;
alter table if exists activities enable row level security;
alter table if exists faucet_claims enable row level security;
