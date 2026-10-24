-- MOAYO Supabase 스키마 초안 (PRD v0.1 10장 데이터 모델 기준)
-- 가정: 인증은 Supabase Auth, 기기에서 uuid를 생성해 오프라인 기록 후 동기화(PRD 11장). 목표·미션·기록·추천 id는 클라이언트 생성 text.
-- 카메라 영상/사진은 저장하지 않는다(사진 인증 M-05는 P1, 별도 마이그레이션으로 추가).

-- ───────── 열거형 ─────────
create type time_pref        as enum ('morning', 'lunch', 'evening', 'night');
create type user_level       as enum ('beginner', 'intermediate');
create type notif_intensity  as enum ('normal', 'strong');           -- 기본 normal, strong은 P1(M-07)
create type subscription     as enum ('free', 'premium');
create type body_part        as enum ('lower', 'upper', 'core', 'full', 'cardio');
create type goal_unit        as enum ('rep', 'min', 'step');
create type goal_status      as enum ('active', 'paused', 'done');
create type mission_type     as enum ('count', 'steps', 'timer', 'photo', 'mini');
create type record_status    as enum ('done', 'missed');
create type verification     as enum ('auto', 'manual', 'simulated'); -- 수동 카운트·미니 미션은 manual, 웹 프로토타입 걸음 수는 simulated
create type difficulty       as enum ('easy', 'ok', 'hard');
create type record_kind      as enum ('normal', 'mini', 'bonus', 'comeback');   -- v0.2
create type reminder_setting as enum ('none', 'hourBefore', 'morning');         -- v0.2
create type app_event_type   as enum ('reminder_sent', 'reminder_blocked', 'alarm_fired', 'alarm_blocked', 'notification_off'); -- v0.2
create type rec_response     as enum ('accepted', 'edited', 'skipped');
create type rec_rule         as enum (
  'pain_stop', 'missed_down', 'hard_down', 'easy_up', 'ok_hold',
  'four_week_new', 'insufficient_data', 'no_data', 'none'
);

-- ───────── 공통: updated_at 갱신(동기화 충돌 판단용) ─────────
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────── User (auth.users 확장) ─────────
create table profiles (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  nickname               text not null check (char_length(nickname) between 1 and 20),
  preferred_time         time_pref       not null default 'morning',
  level                  user_level      not null default 'beginner',
  notification_intensity notif_intensity not null default 'normal',
  subscription           subscription    not null default 'free',
  onboarded              boolean         not null default false,
  reminder_setting       reminder_setting not null default 'hourBefore',   -- v0.2
  bonus_notification     boolean         not null default false,           -- v0.2
  created_at             timestamptz     not null default now(),
  updated_at             timestamptz     not null default now()
);

-- ───────── Goal ─────────
create table goals (
  goal_id     text primary key default gen_random_uuid()::text,
  user_id     uuid        not null references profiles(user_id) on delete cascade,
  exercise    text        not null,
  body_part   body_part   not null,
  unit        goal_unit   not null,
  target      integer     not null check (target > 0),
  weekdays    smallint[]  not null check (
                cardinality(weekdays) between 1 and 7
                and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),   -- 0=일
  time_of_day time        not null,
  start_date  date        not null,
  end_date    date        not null,
  status      goal_status not null default 'active',
  template_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index goals_user_status_idx on goals (user_id, status);

-- ───────── Mission ─────────
create table missions (
  mission_id    text primary key,                                     -- m-{goal_id}-{YYYYMMDD}, 클라이언트 생성
  goal_id       text         not null references goals(goal_id) on delete cascade,
  mission_date  date         not null,
  scheduled_at  timestamptz  not null,
  type          mission_type not null,
  snooze_count  smallint     not null default 0 check (snooze_count between 0 and 2),  -- M-01: 최대 2회
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  unique (goal_id, mission_date)
);
create index missions_goal_date_idx on missions (goal_id, mission_date);

-- ───────── Record ─────────
create table records (
  record_id     text primary key default gen_random_uuid()::text,
  user_id       uuid          not null references profiles(user_id) on delete cascade,  -- v0.2: 보너스는 goal이 없으므로 직접 소유
  kind          record_kind   not null default 'normal',                              -- v0.2
  bonus_key     text,                                                                 -- v0.2: 보너스 3종 id
  mission_id    text          unique references missions(mission_id) on delete cascade,  -- 보너스는 null
  goal_id       text          references goals(goal_id) on delete cascade,            -- 조회 편의용 비정규화, 보너스는 null
  record_date   date          not null,                                              -- 미션 예정일
  status        record_status not null,
  amount        integer       not null default 0 check (amount >= 0),
  duration_sec  integer       not null default 0 check (duration_sec >= 0),
  verification  verification  not null,
  difficulty    difficulty,                                                          -- missed는 null
  memo          text          not null default '',
  completed_at  timestamptz   not null,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  constraint records_difficulty_shape check (
    kind = 'bonus' or (status = 'done' and difficulty is not null) or (status = 'missed' and difficulty is null)),
  constraint records_kind_shape check (
    (kind = 'bonus' and goal_id is null and mission_id is null and bonus_key is not null and status = 'done')
    or (kind <> 'bonus' and goal_id is not null and mission_id is not null))
);
create index records_goal_date_idx on records (goal_id, record_date desc);
create index records_user_date_idx on records (user_id, record_date desc);

-- ───────── Recommendation ─────────
create table recommendations (
  rec_id          text primary key default gen_random_uuid()::text,
  goal_id         text         not null references goals(goal_id) on delete cascade,
  rule            rec_rule     not null,
  proposed_amount integer      not null check (proposed_amount > 0),
  response        rec_response not null,
  responded_at    timestamptz  not null,
  created_at      timestamptz  not null default now()
);
create index recommendations_goal_idx on recommendations (goal_id, responded_at desc);

-- ───────── Streak ─────────
create table streaks (
  user_id             uuid primary key references profiles(user_id) on delete cascade,
  current_streak      integer not null default 0 check (current_streak >= 0),
  longest_streak      integer not null default 0 check (longest_streak >= current_streak),
  protection_left     integer not null default 0 check (protection_left >= 0),
  protection_used_on  date[]  not null default '{}',
  updated_at          timestamptz not null default now()
);

-- ───────── 통증 메모 해제 기록(추천 중단 가드레일, 8장) ─────────
create table pain_clears (
  user_id    uuid        not null references profiles(user_id) on delete cascade,
  exercise   text        not null,
  cleared_at timestamptz not null,
  primary key (user_id, exercise)
);

-- ───────── 알림 이벤트 로그 (v0.2: 지표·상한 판단용) ─────────
create table app_events (
  event_id   text primary key default gen_random_uuid()::text,
  user_id    uuid not null references profiles(user_id) on delete cascade,
  type       app_event_type not null,
  event_date date not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index app_events_user_date_idx on app_events (user_id, event_date);

-- ───────── updated_at 트리거 ─────────
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger goals_updated    before update on goals    for each row execute function set_updated_at();
create trigger missions_updated before update on missions for each row execute function set_updated_at();
create trigger records_updated  before update on records  for each row execute function set_updated_at();
create trigger streaks_updated  before update on streaks  for each row execute function set_updated_at();

-- ───────── 신규 가입 시 프로필·스트릭 자동 생성 ─────────
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, nickname) values (new.id, '모아요');
  insert into streaks (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ───────── RLS: 본인 데이터만 접근 ─────────
alter table profiles        enable row level security;
alter table goals           enable row level security;
alter table missions        enable row level security;
alter table records         enable row level security;
alter table recommendations enable row level security;
alter table streaks         enable row level security;
alter table pain_clears     enable row level security;
alter table app_events      enable row level security;

create policy profiles_own on profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy streaks_own on streaks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pain_clears_own on pain_clears for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy goals_own on goals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy missions_own on missions for all
  using (exists (select 1 from goals g where g.goal_id = missions.goal_id and g.user_id = auth.uid()))
  with check (exists (select 1 from goals g where g.goal_id = missions.goal_id and g.user_id = auth.uid()));
create policy records_own on records for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy app_events_own on app_events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy recommendations_own on recommendations for all
  using (exists (select 1 from goals g where g.goal_id = recommendations.goal_id and g.user_id = auth.uid()))
  with check (exists (select 1 from goals g where g.goal_id = recommendations.goal_id and g.user_id = auth.uid()));
