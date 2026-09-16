-- =========================================================
-- MIGRACIÓN: NUEVO TIPO DE INCIDENCIA "acta_capacitacion"
-- (Acta de Capacitación, dentro del módulo de Incidencias)
-- Ejecuta este script en el SQL Editor de Supabase
-- =========================================================

alter table incidents drop constraint if exists incidents_incident_type_check;

alter table incidents add constraint incidents_incident_type_check check (incident_type in (
  'actividad_no_conforme',
  'llamado_atencion',
  'solicitud_vacaciones',
  'anticipo_sueldo',
  'incapacidad',
  'permiso_laboral',
  'acta_entrega',
  'certificado_trabajo',
  'acta_capacitacion',
  'otro'
));
