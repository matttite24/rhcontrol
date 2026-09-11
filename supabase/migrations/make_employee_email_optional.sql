-- ==============================================================================
-- HACER OPCIONAL EL CORREO DEL EMPLEADO
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- La ficha de empleado ya no exige correo en el formulario (fase de
-- recolección de datos: exigirlo llevaba a capturar correos inventados solo
-- para poder guardar). La columna seguía con NOT NULL en la base, así que el
-- insert fallaba con:
--   null value in column "email" of relation "employees" violates not-null constraint

alter table employees alter column email drop not null;
