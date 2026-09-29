-- Migração 2026-09-02: coluna updated_at em public.users
-- Motivo: o trigger trg_users_updated_at (set_updated_at) referencia NEW.updated_at;
-- sem a coluna, TODO update em users falhava no Postgres (anonimização/edição de perfil).
alter table public.users
  add column if not exists updated_at timestamptz not null default now();
