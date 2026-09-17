create table faucet_whitelist_zids (
  id uuid primary key default gen_random_uuid(),
  chain_id integer not null,
  zid text not null check (zid ~ '^z[0-9]{7}$'),
  created_at timestamptz not null default now(),
  unique (chain_id, zid)
);

alter table faucet_whitelist_zids enable row level security;

create index idx_faucet_whitelist_chain_zid on faucet_whitelist_zids(chain_id, zid);
