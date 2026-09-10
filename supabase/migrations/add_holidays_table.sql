-- =========================================================
-- MIGRACIÓN: TABLA DE FERIADOS NACIONALES / LOCALES
-- Ejecuta este script en el SQL Editor de Supabase
-- =========================================================

create table if not exists holidays (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  date            date not null,
  name            text not null,
  created_at      timestamptz not null default now(),
  unique(organization_id, date)
);

alter table holidays enable row level security;

drop policy if exists "Permitir lectura feriados" on holidays;
create policy "Permitir lectura feriados" on holidays for select using (auth.role() = 'authenticated');
drop policy if exists "Permitir insercion feriados" on holidays;
create policy "Permitir insercion feriados" on holidays for insert with check (auth.role() = 'authenticated');
drop policy if exists "Permitir actualizacion feriados" on holidays;
create policy "Permitir actualizacion feriados" on holidays for update using (auth.role() = 'authenticated');
drop policy if exists "Permitir eliminacion feriados" on holidays;
create policy "Permitir eliminacion feriados" on holidays for delete using (auth.role() = 'authenticated');
