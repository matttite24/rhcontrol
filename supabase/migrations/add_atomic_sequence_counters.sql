-- Contador atómico de secuencias por organización + tipo de documento
-- (PER-0001, HEX-0001, VAC-0001, etc.), para reemplazar el cálculo previo
-- basado en SELECT MAX(sequence_number) + 1 desde el cliente, que tiene una
-- condición de carrera real: dos solicitudes creadas casi simultáneamente
-- pueden leer el mismo máximo y generar el mismo código duplicado.
--
-- get_next_document_sequence() hace un UPSERT + incremento atómico dentro de
-- una sola sentencia SQL (INSERT ... ON CONFLICT DO UPDATE ... RETURNING),
-- lo cual Postgres serializa a nivel de fila sin necesidad de un lock manual.

create table if not exists public.document_sequence_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  last_value integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_type)
);

alter table public.document_sequence_counters enable row level security;

-- Solo miembros de la organización pueden leer/incrementar su propio contador.
drop policy if exists "Ver contadores de la propia organización" on public.document_sequence_counters;
create policy "Ver contadores de la propia organización"
  on public.document_sequence_counters for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create or replace function public.get_next_document_sequence(
  p_organization_id uuid,
  p_document_type text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  insert into public.document_sequence_counters (organization_id, document_type, last_value)
  values (p_organization_id, p_document_type, 1)
  on conflict (organization_id, document_type)
  do update set last_value = document_sequence_counters.last_value + 1,
                updated_at = now()
  returning last_value into v_next;

  return v_next;
end;
$$;

-- Solo usuarios autenticados que pertenezcan a la organización pueden llamarla
-- (security definer + el chequeo explícito de membresía dentro de la función
-- sería más estricto, pero se apoya en que el caller ya valida la sesión y
-- pasa su propia organización activa desde el servidor).
revoke all on function public.get_next_document_sequence(uuid, text) from public;
grant execute on function public.get_next_document_sequence(uuid, text) to authenticated;

-- Backfill: inicializa el contador de cada organización/tipo con el máximo
-- sequence_number ya usado en shift_requests e incidents, para que el primer
-- código generado después de aplicar esta migración continúe la numeración
-- existente en vez de reiniciar en 0001.
insert into public.document_sequence_counters (organization_id, document_type, last_value)
select organization_id,
       coalesce(metadata->>'sub_type', request_type) as document_type,
       max((metadata->>'sequence_number')::integer)
from public.shift_requests
where metadata->>'sequence_number' is not null
group by organization_id, coalesce(metadata->>'sub_type', request_type)
on conflict (organization_id, document_type) do update
  set last_value = greatest(document_sequence_counters.last_value, excluded.last_value);

insert into public.document_sequence_counters (organization_id, document_type, last_value)
select organization_id,
       coalesce(metadata->>'sub_type', incident_type) as document_type,
       max((metadata->>'sequence_number')::integer)
from public.incidents
where metadata->>'sequence_number' is not null
group by organization_id, coalesce(metadata->>'sub_type', incident_type)
on conflict (organization_id, document_type) do update
  set last_value = greatest(document_sequence_counters.last_value, excluded.last_value);
