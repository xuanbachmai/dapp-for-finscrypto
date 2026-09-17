-- students
create table students (
  id uuid primary key default gen_random_uuid(),
  zid text unique not null,
  email text not null,
  wallet_address text unique,
  display_name text,
  verification_code text,
  verification_code_sent_at timestamptz,
  verification_code_expires_at timestamptz,
  verification_attempt_count integer not null default 0,
  verification_blocked_until timestamptz,
  registration_nonce text,
  registration_nonce_expires_at timestamptz,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- balances
create table balances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  chain_id integer not null,
  balance_wei text not null,
  updated_at timestamptz not null default now(),
  unique(student_id, chain_id)
);

-- activities
create table activities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  activity_type text not null,
  chain_id integer not null,
  tx_hash text,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- faucet_claims
create table faucet_claims (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  chain_id integer not null,
  amount_wei text not null,
  tx_hash text not null,
  created_at timestamptz not null default now()
);

-- row level security
-- No client policies are defined yet. Access is intended to flow through the
-- server-side service role until explicit per-role policies are introduced.
alter table students enable row level security;
alter table balances enable row level security;
alter table activities enable row level security;
alter table faucet_claims enable row level security;

-- indexes
create index idx_students_zid on students(zid);
create index idx_students_wallet on students(wallet_address);
create index idx_activities_student on activities(student_id);
create index idx_faucet_student_chain on faucet_claims(student_id, chain_id, created_at);
