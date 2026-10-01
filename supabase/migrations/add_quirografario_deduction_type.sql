-- ==============================================================================
-- DESCUENTOS — tipo 'quirografario' (Crédito Quirografario del IESS)
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================

do $$
declare
  c record;
begin
  -- Elimina el check de deduction_type existente (el nombre varía entre entornos).
  for c in
    select conname from pg_constraint
    where conrelid = 'public.deductions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%deduction_type%'
  loop
    execute format('alter table public.deductions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.deductions
  add constraint deductions_deduction_type_check
  check (deduction_type in ('faltante_caja', 'inventario', 'multa', 'prestamo', 'alimentacion', 'quirografario', 'otro'));
