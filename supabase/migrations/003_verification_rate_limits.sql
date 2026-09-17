alter table if exists students
  add column if not exists verification_code_sent_at timestamptz,
  add column if not exists verification_attempt_count integer not null default 0,
  add column if not exists verification_blocked_until timestamptz;
