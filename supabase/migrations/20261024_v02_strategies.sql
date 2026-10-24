-- MOAYO v0.2 전략 4종 증분 마이그레이션 (재실행 안전). 이미 schema.sql이 적용된 DB용.
-- 적용: Supabase SQL Editor에서 이 파일 전체를 실행한다. (배포 순서: 마이그레이션 -> 스모크 -> 코드 배포)

-- ───────── 열거형 ─────────
do $$ begin create type record_kind as enum ('normal','mini','bonus','comeback'); exception when duplicate_object then null; end $$;
do $$ begin create type reminder_setting as enum ('none','hourBefore','morning'); exception when duplicate_object then null; end $$;
do $$ begin create type app_event_type as enum ('reminder_sent','reminder_blocked','alarm_fired','alarm_blocked','notification_off'); exception when duplicate_object then null; end $$;

-- ───────── records: 종류 + 보너스는 목표·미션에 속하지 않음 ─────────
alter table records add column if not exists kind record_kind not null default 'normal';
alter table records add column if not exists bonus_key text;  -- 보너스 3종 id (stretch/squat/march)
alter table records add column if not exists user_id uuid references profiles(user_id) on delete cascade;
alter table records alter column goal_id    drop not null;
alter table records alter column mission_id drop not null;

-- 기존 행의 소유자 보정 후 NOT NULL
update records r set user_id = g.user_id from goals g where r.goal_id = g.goal_id and r.user_id is null;
alter table records alter column user_id set not null;

-- 기존 difficulty 체크(done이면 difficulty 필수)는 보너스(difficulty null)를 막으므로 교체
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'records'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%difficulty%' and conname <> 'records_difficulty_shape'
  loop
    execute format('alter table records drop constraint %I', c);
  end loop;
end $$;
alter table records drop constraint if exists records_difficulty_shape;
alter table records add constraint records_difficulty_shape check (
  kind = 'bonus' or (status = 'done' and difficulty is not null) or (status = 'missed' and difficulty is null));

alter table records drop constraint if exists records_kind_shape;
alter table records add constraint records_kind_shape check (
  (kind = 'bonus' and goal_id is null and mission_id is null and bonus_key is not null and status = 'done')
  or (kind <> 'bonus' and goal_id is not null and mission_id is not null));

create index if not exists records_user_date_idx on records (user_id, record_date desc);

-- RLS: goal 경유 정책은 goal_id null 행을 못 보므로 user_id 기준으로 교체
drop policy if exists records_own on records;
create policy records_own on records for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────── 설정 ─────────
alter table profiles add column if not exists reminder_setting reminder_setting not null default 'hourBefore';
alter table profiles add column if not exists bonus_notification boolean not null default false;

-- ───────── 알림 이벤트 로그 (지표·상한 판단용) ─────────
create table if not exists app_events (
  event_id   text primary key default gen_random_uuid()::text,
  user_id    uuid not null references profiles(user_id) on delete cascade,
  type       app_event_type not null,
  event_date date not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists app_events_user_date_idx on app_events (user_id, event_date);
alter table app_events enable row level security;
drop policy if exists app_events_own on app_events;
create policy app_events_own on app_events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
