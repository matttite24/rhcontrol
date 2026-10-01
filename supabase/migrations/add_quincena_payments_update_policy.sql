-- ==============================================================================
-- QUINCENA — permitir registrar el número de cheque DESPUÉS del pago
-- Ejecuta este script en el SQL Editor de Supabase
-- ==============================================================================
--
-- quincena_payments solo tenía políticas de lectura, inserción y eliminación.
-- Registrar el número de cheque tras pagar requiere UPDATE; sin esta política
-- RLS descarta el update en silencio (0 filas afectadas).

drop policy if exists "Permitir actualizacion quincena_payments" on quincena_payments;
create policy "Permitir actualizacion quincena_payments" on quincena_payments
  for update using (auth.role() = 'authenticated');
