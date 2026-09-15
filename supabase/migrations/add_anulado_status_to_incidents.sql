-- El check constraint de incidents.status en la base de datos real nunca
-- incluyó 'anulado' — solo estaba documentado en schema.sql (estado
-- deseado), pero la migración que lo agregaba nunca se creó/corrió. Esto
-- hacía fallar cancelIncidentAction (src/lib/incidents/actions.ts) con
-- "new row for relation incidents violates check constraint
-- incidents_status_check" al intentar anular cualquier comprobante.

alter table incidents drop constraint if exists incidents_status_check;

alter table incidents add constraint incidents_status_check
  check (status in ('pendiente', 'aprobado', 'rechazado', 'registrado', 'anulado'));
