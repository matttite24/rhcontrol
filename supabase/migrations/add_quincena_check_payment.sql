-- ==============================================================================
-- QUINCENA POR CHEQUE — número de cheque por pago
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- Empleados con payment_type = 'Cheque' no tienen cuenta bancaria (no van en
-- el TSV de transferencias) pero sí necesitan quedar registrados como
-- pagados en Quincena, con el número de cheque usado para ese pago.

alter table quincena_payments
  add column if not exists payment_method text not null default 'Transferencia'
    check (payment_method in ('Transferencia', 'Cheque')),
  add column if not exists check_number text;
