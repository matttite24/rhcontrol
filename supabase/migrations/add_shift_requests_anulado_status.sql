-- ==============================================================================
-- NOVEDADES — estado 'anulado' para novedades aprobadas que no se ejecutaron
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Una novedad aprobada (p. ej. horas extras) que finalmente no se cumple se
-- anula en vez de borrarse: conserva toda su información en modo lectura pero
-- deja de contar en calendario y nómina (que solo consideran 'aprobado').

do $$
declare
  c record;
begin
  -- Elimina el check de status existente (el nombre varía entre entornos).
  for c in
    select conname from pg_constraint
    where conrelid = 'public.shift_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.shift_requests drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.shift_requests
  add constraint shift_requests_status_check
  check (status in ('pendiente', 'aprobado', 'rechazado', 'anulado'));
