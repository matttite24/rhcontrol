-- ==============================================================================
-- GERENTE PROPIETARIO (AUTOAFILIACIÓN IESS 17.60%)
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- El Gerente Propietario de una compañía (sin relación de dependencia laboral
-- ordinaria) se autoafilia al IESS aportando él mismo el equivalente
-- combinado personal + patronal: 17.60%, en vez del 9.45% de aporte personal
-- normal. La empresa no genera aporte patronal (12.15%) aparte para él.
--
-- Ver src/lib/payroll/ecuador.ts (IESS_MANAGER_OWNER_RATE) y el cálculo del
-- rol de pago en src/app/(dashboard)/payroll/page.tsx.

alter table employees
  add column if not exists is_owner_manager boolean not null default false;

comment on column employees.is_owner_manager is
  'Gerente Propietario autoafiliado al IESS (aporta 17.60% él mismo, sin aporte patronal aparte de la empresa).';
