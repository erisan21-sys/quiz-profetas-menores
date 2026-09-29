-- ============================================================================
--  QUIZ BÍBLICO — PROFETAS MENORES  ·  v1.0
--  Esquema do banco (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
--  Executar no SQL Editor do Supabase (ou via psql) na ordem:
--     1) database/schema.sql   (este arquivo)
--     2) database/seed.sql     (60 perguntas + conquistas)
--     3) database/rls.sql      (Row Level Security + policies)
-- ============================================================================

-- Extensões -----------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- nicknames case-insensitive

-- Enums ---------------------------------------------------------------------
do $$ begin
  create type question_difficulty as enum ('facil', 'medio', 'dificil');
exception when duplicate_object then null; end $$;

do $$ begin
  create type answer_letter as enum ('A', 'B', 'C', 'D');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attempt_status as enum ('STARTED', 'FINISHED', 'ABANDONED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quiz_mode as enum ('mixed', 'facil', 'medio', 'dificil');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('player', 'admin');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- USERS
-- ============================================================================
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          varchar(80)  not null,
  nickname      citext       not null,
  email         varchar(255),                 -- reservado p/ v1.2 (Supabase Auth)
  auth_id       uuid,                          -- reservado p/ v1.2 (auth.users.id)
  role          user_role    not null default 'player',
  share_profile boolean      not null default true,
  created_at    timestamptz  not null default now(),
  last_seen_at  timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),   -- usado pelo trigger trg_users_updated_at

  constraint users_name_len      check (char_length(trim(name)) between 2 and 80),
  constraint users_nickname_len  check (char_length(trim(nickname::text)) between 2 and 30),
  constraint users_nickname_fmt  check (nickname::text ~ '^[A-Za-z0-9._\- ]+$'),
  constraint users_email_fmt     check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create unique index if not exists users_nickname_key on public.users (nickname);
create unique index if not exists users_auth_id_key  on public.users (auth_id) where auth_id is not null;
create index if not exists users_created_at_idx      on public.users (created_at desc);

comment on table  public.users is 'Jogadores. v1.0: cadastro por nome/apelido. v1.2: email/auth_id passam a ser usados pelo Supabase Auth.';

-- ============================================================================
-- QUESTIONS
-- ============================================================================
create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  book            varchar(24)  not null default 'todos', -- identificador do profeta
  book_name       varchar(40)  not null default 'Todos os Profetas',
  chapter         smallint     not null,
  question        text         not null,
  difficulty      question_difficulty not null,
  option_a        text         not null,
  option_b        text         not null,
  option_c        text         not null,
  option_d        text         not null,
  correct_answer  answer_letter not null,
  explanation     text         not null,
  hint            text         not null,
  source_type     varchar(16)  not null default 'texto_biblico',  -- texto_biblico | historico | interpretacao
  order_index     integer      not null default 0,
  active          boolean      not null default true,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),

  constraint questions_book_check check (book in ('oseias','joel','amos','obadias','jonas','miqueias','naum','habacuque','sofonias','ageu','zacarias','malaquias','todos')),
  constraint questions_chapter_range check (chapter between 1 and 66),
  constraint questions_text_len      check (char_length(question) between 10 and 600),
  constraint questions_option_len    check (char_length(option_a) between 1 and 300
                                          and char_length(option_b) between 1 and 300
                                          and char_length(option_c) between 1 and 300
                                          and char_length(option_d) between 1 and 300),
  constraint questions_options_distinct check (
        lower(trim(option_a)) <> lower(trim(option_b))
    and lower(trim(option_a)) <> lower(trim(option_c))
    and lower(trim(option_a)) <> lower(trim(option_d))
    and lower(trim(option_b)) <> lower(trim(option_c))
    and lower(trim(option_b)) <> lower(trim(option_d))
    and lower(trim(option_c)) <> lower(trim(option_d))
  ),
  constraint questions_source_type check (source_type in ('texto_biblico','historico','interpretacao'))
);

alter table public.questions add column if not exists book_name varchar(40) not null default 'Todos os Profetas';

create index if not exists questions_book_idx on public.questions (book, active);
create index if not exists questions_difficulty_idx on public.questions (difficulty) where active;
create index if not exists questions_active_idx     on public.questions (active, order_index);

-- ============================================================================
-- QUIZ_ATTEMPTS  (partida)
-- ============================================================================
create table if not exists public.quiz_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  status           attempt_status not null default 'STARTED',
  prophet          varchar(24) not null default 'todos',
  mode             quiz_mode      not null default 'mixed',
  difficulty       varchar(16)    not null default 'mixed',  -- redundância legível p/ ranking
  score            integer not null default 0,
  base_score       integer not null default 0,
  bonus_score      integer not null default 0,
  correct_answers  integer not null default 0,
  wrong_answers    integer not null default 0,
  total_questions  integer not null default 0,
  answered_count   integer not null default 0,
  percentage       numeric(5,2) not null default 0,
  duration_seconds integer,                                  -- calculado no SERVIDOR
  question_order   jsonb not null default '[]'::jsonb,        -- ordem sorteada (uuids)
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- PARTIDA IMUTÁVEL APÓS TERMINAR ---------------------------------------
  constraint attempts_status_check      check (status in ('STARTED','FINISHED','ABANDONED')),
  constraint attempts_score_nonneg      check (score >= 0 and base_score >= 0 and bonus_score >= 0),
  constraint attempts_counts_nonneg     check (correct_answers >= 0 and wrong_answers >= 0
                                               and answered_count >= 0 and total_questions >= 0),
  constraint attempts_counts_consistent check (correct_answers + wrong_answers = answered_count
                                               and answered_count <= total_questions),
  constraint attempts_percentage_range  check (percentage >= 0 and percentage <= 100),
  constraint attempts_finished_requires check (
        (status = 'FINISHED' and finished_at is not null)
     or (status <> 'FINISHED')
  ),
  constraint attempts_duration_nonneg   check (duration_seconds is null or duration_seconds >= 0)
);

alter table public.quiz_attempts add column if not exists prophet varchar(24) not null default 'todos';

create index if not exists attempts_user_idx        on public.quiz_attempts (user_id, created_at desc);
create index if not exists attempts_status_idx      on public.quiz_attempts (status);
create index if not exists attempts_finished_idx    on public.quiz_attempts (score desc, percentage desc, correct_answers desc, finished_at desc)
                                                     where status = 'FINISHED';
create index if not exists attempts_created_at_idx  on public.quiz_attempts (created_at desc);

-- ============================================================================
-- QUIZ_ANSWERS  (resposta de cada questão dentro de uma partida)
-- ============================================================================
create table if not exists public.quiz_answers (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id     uuid not null references public.questions(id)      on delete restrict,
  user_id         uuid not null references public.users(id)          on delete cascade,
  selected_answer answer_letter not null,
  is_correct      boolean not null,
  points          integer not null default 0,
  position        integer not null,                -- posição na ordem sorteada
  time_spent_ms   integer not null default 0,
  used_hint       boolean not null default false,
  answered_at     timestamptz not null default now(),

  -- SEM RESPOSTA DUPLICADA NA MESMA QUESTÃO ------------------------------
  constraint answers_unique_per_question unique (attempt_id, question_id),
  constraint answers_points_nonneg       check (points >= 0),
  constraint answers_time_nonneg         check (time_spent_ms between 0 and 600000)
);

create index if not exists answers_attempt_idx  on public.quiz_answers (attempt_id, position);
create index if not exists answers_question_idx on public.quiz_answers (question_id);
create index if not exists answers_user_idx     on public.quiz_answers (user_id);

-- ============================================================================
-- ACHIEVEMENTS / USER_ACHIEVEMENTS  (conquistas)
-- ============================================================================
create table if not exists public.achievements (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(40) not null unique,
  name        varchar(80) not null,
  description text        not null,
  icon        varchar(16) not null default '🏅',
  criteria    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id)        on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  attempt_id     uuid references public.quiz_attempts(id) on delete set null,

  constraint user_achievements_unique unique (user_id, achievement_id)
);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id, unlocked_at);

-- ============================================================================
-- ADMIN_TOKENS  (acesso à área /admin)
-- ============================================================================
create table if not exists public.admin_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,          -- sha256 do token
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists admin_tokens_user_idx on public.admin_tokens (user_id);

-- ============================================================================
-- AUDIT_LOG  (trilha de auditoria anti-fraude)
-- ============================================================================
create table if not exists public.audit_log (
  id         bigserial primary key,
  user_id    uuid references public.users(id) on delete set null,
  attempt_id uuid references public.quiz_attempts(id) on delete set null,
  action     varchar(40) not null,
  detail     jsonb not null default '{}'::jsonb,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_user_idx    on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_action_idx  on public.audit_log (action, created_at desc);

-- ============================================================================
-- TRIGGER: updated_at automático
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_questions_updated_at on public.questions;
create trigger trg_questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_attempts_updated_at on public.quiz_attempts;
create trigger trg_attempts_updated_at before update on public.quiz_attempts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TRIGGER: partida FINISHED/ABANDONED é IMUTÁVEL
-- ============================================================================
create or replace function public.protect_finished_attempt()
returns trigger language plpgsql as $$
begin
  if old.status in ('FINISHED','ABANDONED') and (
        new.status      is distinct from old.status      or
        new.score       is distinct from old.score       or
        new.base_score  is distinct from old.base_score  or
        new.bonus_score is distinct from old.bonus_score or
        new.correct_answers is distinct from old.correct_answers or
        new.wrong_answers   is distinct from old.wrong_answers   or
        new.percentage      is distinct from old.percentage      or
        new.duration_seconds is distinct from old.duration_seconds or
        new.answered_count   is distinct from old.answered_count
     ) then
    raise exception 'attempt % já está encerrado (status %) e não pode ser alterado', old.id, old.status
      using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists trg_attempts_immutable on public.quiz_attempts;
create trigger trg_attempts_immutable before update on public.quiz_attempts
  for each row execute function public.protect_finished_attempt();

-- ============================================================================
-- TRIGGER: respostas só entram em partida STARTED e na ordem sorteada
-- ============================================================================
create or replace function public.protect_answer_insert()
returns trigger language plpgsql as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_expected uuid;
begin
  select * into v_attempt from public.quiz_attempts where id = new.attempt_id for update;
  if not found then
    raise exception 'partida inexistente';
  end if;
  if v_attempt.status <> 'STARTED' then
    raise exception 'não é possível responder: partida com status %', v_attempt.status using errcode = '23505';
  end if;
  if new.user_id <> v_attempt.user_id then
    raise exception 'resposta pertence a outro usuário' using errcode = '23505';
  end if;
  if v_attempt.total_questions > 0 and new.position <> (v_attempt.answered_count + 1) then
    raise exception 'ordem de resposta inválida' using errcode = '23505';
  end if;
  v_expected := (v_attempt.question_order ->> (new.position - 1))::uuid;
  if v_expected is not null and v_expected <> new.question_id then
    raise exception 'questão fora da ordem sorteada da partida' using errcode = '23505';
  end if;
  if not exists (select 1 from public.questions q where q.id = new.question_id and q.active) then
    raise exception 'questão inexistente ou inativa';
  end if;
  return new;
end $$;

drop trigger if exists trg_answers_guard on public.quiz_answers;
create trigger trg_answers_guard before insert on public.quiz_answers
  for each row execute function public.protect_answer_insert();

-- ============================================================================
-- RPC: leaderboard (ranking) — calculado 100% no banco
--   p_period: 'all' | 'today' | 'week' | 'month'
--   p_mode:   'mixed' | 'facil' | 'medio' | 'dificil' | 'all'
--   Critério: 1) maior pontuação 2) maior percentual 3) mais acertos 4) resultado mais recente
-- ============================================================================
create or replace function public.leaderboard(
  p_period text default 'all',
  p_mode   text default 'all',
  p_limit  integer default 100,
  p_offset integer default 0
)
returns table (
  rank             bigint,
  user_id          uuid,
  name             varchar,
  nickname         text,
  best_score       integer,
  best_percentage  numeric,
  best_correct     integer,
  best_total       integer,
  attempts_count   bigint,
  total_correct    bigint,
  last_played_at   timestamptz
)
language sql stable as $$
  with filtered as (
    select a.*
    from public.quiz_attempts a
    where a.status = 'FINISHED'
      and a.total_questions > 0
      and (
            p_period = 'all'
         or (p_period = 'today' and a.finished_at >= date_trunc('day', now()))
         or (p_period = 'week'  and a.finished_at >= date_trunc('week', now()))
         or (p_period = 'month' and a.finished_at >= date_trunc('month', now()))
      )
      and (p_mode = 'all' or a.mode = p_mode::public.quiz_mode)
  ),
  best as (
    select distinct on (f.user_id)
           f.user_id, f.score, f.percentage, f.correct_answers, f.total_questions, f.finished_at
    from filtered f
    order by f.user_id, f.score desc, f.percentage desc, f.correct_answers desc, f.finished_at desc
  ),
  agg as (
    select f.user_id,
           count(*)              as attempts_count,
           coalesce(sum(f.correct_answers), 0) as total_correct,
           max(f.finished_at)    as last_played_at
    from filtered f
    group by f.user_id
  )
  select row_number() over (
           order by b.score desc, b.percentage desc, b.correct_answers desc, b.finished_at desc
         )                                   as rank,
         b.user_id,
         u.name,
         u.nickname::text                    as nickname,
         b.score                             as best_score,
         b.percentage                        as best_percentage,
         b.correct_answers                   as best_correct,
         b.total_questions                   as best_total,
         a.attempts_count,
         a.total_correct,
         a.last_played_at
  from best b
  join public.users u on u.id = b.user_id
  join agg a          on a.user_id = b.user_id
  where u.share_profile = true
  order by b.score desc, b.percentage desc, b.correct_answers desc, b.finished_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
$$;

-- ============================================================================
-- RPC: posição de um jogador + percentual superado
-- ============================================================================
create or replace function public.player_rank(p_user uuid, p_period text default 'all', p_mode text default 'all')
returns table (rank bigint, total_players bigint, beaten_percentage numeric)
language sql stable as $$
  with lb as (select * from public.leaderboard(p_period, p_mode, 200, 0)),
       me as (select * from lb where lb.user_id = p_user)
  select coalesce(me.rank, 0)::bigint                       as rank,
         (select count(*) from lb)::bigint                  as total_players,
         case
           when me.rank is null then 0
           when (select count(*) from lb) <= 1 then 100
           else round(100.0 * ((select count(*) from lb) - me.rank) / ((select count(*) from lb) - 1), 1)
         end                                                as beaten_percentage
  from me
  union all
  select 0, (select count(*) from public.leaderboard(p_period, p_mode, 200, 0)), 0
  where not exists (select 1 from me);
$$;

-- ============================================================================
-- RPC: estatísticas gerais do dashboard
-- ============================================================================
create or replace function public.global_stats()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'total_players',        (select count(*) from public.users),
    'total_attempts',       (select count(*) from public.quiz_attempts where status = 'FINISHED'),
    'total_answers',        (select count(*) from public.quiz_answers),
    'total_questions',      (select count(*) from public.questions where active),
    'best_score',           (select coalesce(max(score), 0) from public.quiz_attempts where status = 'FINISHED'),
    'best_percentage',      (select coalesce(max(percentage), 0) from public.quiz_attempts where status = 'FINISHED'),
    'avg_score',            (select coalesce(round(avg(score)), 0) from public.quiz_attempts where status = 'FINISHED'),
    'avg_correct',          (select coalesce(round(avg(correct_answers)::numeric, 1), 0) from public.quiz_attempts where status = 'FINISHED'),
    'avg_percentage',       (select coalesce(round(avg(percentage), 1), 0) from public.quiz_attempts where status = 'FINISHED'),
    'most_correct_question', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'question_id', q.id, 'text', q.question, 'correct', s.correct, 'wrong', s.wrong,
                 'accuracy', round(100.0 * s.correct / nullif(s.correct + s.wrong, 0), 1))
               order by (s.correct::numeric / nullif(s.correct + s.wrong, 0)) desc nulls last)
               filter (where rn <= 5), '[]'::jsonb)
        from (
          select qa.question_id,
                 count(*) filter (where qa.is_correct)     as correct,
                 count(*) filter (where not qa.is_correct) as wrong,
                 row_number() over (order by (count(*) filter (where qa.is_correct))::numeric
                                      / nullif(count(*), 0) desc) as rn
          from public.quiz_answers qa group by qa.question_id
        ) s join public.questions q on q.id = s.question_id
    ),
    'most_wrong_question', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'question_id', q.id, 'text', q.question, 'correct', s.correct, 'wrong', s.wrong,
                 'accuracy', round(100.0 * s.correct / nullif(s.correct + s.wrong, 0), 1))
               order by (s.wrong::numeric / nullif(s.correct + s.wrong, 0)) desc nulls last)
               filter (where rn <= 5), '[]'::jsonb)
        from (
          select qa.question_id,
                 count(*) filter (where qa.is_correct)     as correct,
                 count(*) filter (where not qa.is_correct) as wrong,
                 row_number() over (order by (count(*) filter (where not qa.is_correct))::numeric
                                      / nullif(count(*), 0) desc) as rn
          from public.quiz_answers qa group by qa.question_id
        ) s join public.questions q on q.id = s.question_id
    )
  );
$$;

-- ============================================================================
-- RPC: estatísticas de um jogador (perfil + gráfico de evolução)
-- ============================================================================
create or replace function public.player_stats(p_user uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'attempts',        (select count(*) from public.quiz_attempts a where a.user_id = p_user and a.status = 'FINISHED'),
    'total_correct',   (select coalesce(sum(correct_answers),0) from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'total_wrong',     (select coalesce(sum(wrong_answers),0)   from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'best_score',      (select coalesce(max(score),0)           from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'best_percentage', (select coalesce(max(percentage),0)      from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'avg_score',       (select coalesce(round(avg(score)),0)    from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'avg_correct',     (select coalesce(round(avg(correct_answers)::numeric,1),0) from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'total_duration',  (select coalesce(sum(duration_seconds),0) from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'last_attempt_at', (select max(finished_at) from public.quiz_attempts a where a.user_id = p_user and a.status='FINISHED'),
    'evolution', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'date', to_char(a.finished_at, 'DD/MM/YYYY'),
                 'score', a.score, 'percentage', a.percentage, 'correct', a.correct_answers,
                 'total', a.total_questions) order by a.finished_at asc), '[]'::jsonb)
        from (select * from public.quiz_attempts
              where user_id = p_user and status = 'FINISHED'
              order by finished_at desc limit 30) a
    )
  );
$$;

-- ============================================================================
-- GRANTS (o backend usa a service_role key; o frontend NUNCA acessa o banco)
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select on public.questions to anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
