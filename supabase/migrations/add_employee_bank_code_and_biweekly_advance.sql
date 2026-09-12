-- Código de banco (2-4 dígitos, ingresado manualmente por el usuario junto
-- al nombre del banco en Datos de la Empresa) y anticipo quincenal recurrente
-- (monto opcional que algunos empleados reciben a mitad de mes, y que se
-- resta del rol mensual completo — ver calculatePayroll en
-- src/lib/payroll/calculate.ts, que solo lo resta si el corte supera 15 días).
alter table employees add column if not exists bank_code text;
alter table employees add column if not exists biweekly_advance_amount numeric;
