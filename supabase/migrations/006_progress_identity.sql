begin;
lock table activities in access exclusive mode;

-- Consolidate only duplicate identities, retaining a verified row and its earliest known verification.
with duplicates as (
  select id, row_number() over (
    partition by student_id, activity_type, chain_id
    order by verified desc, verified_at asc nulls last, created_at asc, id
  ) as position
  from activities
)
delete from activities using duplicates
where activities.id = duplicates.id and duplicates.position > 1;

create unique index activities_progress_identity
  on activities(student_id, activity_type, chain_id);
commit;
