-- ==============================================================================
-- ÍNDICES POR employee_id — FICHA DE EMPLEADO LENTA AL ABRIR
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- La ficha de empleado (/employees/[id] y /employees/[id]/edit) consulta
-- employee_salaries, employee_schedules y employee_documents filtrando por
-- employee_id (una fila por empleado, no por organización). Esas 3 tablas
-- solo tenían índice por organization_id (de add_scale_indexes_and_dashboard_rpc.sql),
-- así que cada uno de esos filtros por employee_id hacía un seq scan de TODA
-- la organización en vez de un lookup directo — la causa de que abrir
-- cualquier ficha demore siempre, sin importar el empleado.
--
-- employee_rotating_schedules ya tenía su índice por employee_id desde
-- add_rotating_shift_patterns.sql; este script completa el resto.

create index if not exists idx_employee_salaries_employee
  on employee_salaries (employee_id);

create index if not exists idx_employee_schedules_employee
  on employee_schedules (employee_id);

create index if not exists idx_employee_documents_employee
  on employee_documents (employee_id);
