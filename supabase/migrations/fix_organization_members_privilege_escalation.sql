-- =========================================================
-- FIX DE SEGURIDAD: Escalada de privilegios en organization_members
-- Ejecuta este script en el SQL Editor de Supabase
-- =========================================================
--
-- Problema: la policy de INSERT anterior solo validaba
-- `auth.uid() = user_id`, sin restringir el campo `role`. Cualquier
-- usuario autenticado podía, desde el cliente (o la consola del
-- navegador), insertarse a sí mismo como 'owner' en CUALQUIER
-- organización existente con solo conocer su `organization_id`:
--
--   supabase.from('organization_members').insert({
--     organization_id: '<org-id-ajena>',
--     user_id: auth.uid(),
--     role: 'owner',
--   })
--
-- Fix: un usuario solo puede auto-insertarse con role='owner' cuando
-- la organización todavía NO tiene ningún miembro (caso legítimo de
-- creación de una nueva organización, cubierto por el Server Action
-- `createOrganizationWithOwnerAction`, que corre con el cliente
-- autenticado normal y por tanto SÍ respeta esta policy). Para sumar
-- miembros a una organización que ya tiene dueño hace falta un flujo
-- de invitación aparte (no implementado todavía) que sí use
-- service_role o una policy adicional explícita para ese caso.

drop policy if exists "Insertar members" on organization_members;

create policy "Insertar primer miembro (owner) de una org nueva"
  on organization_members
  for insert
  with check (
    auth.uid() = user_id
    and role = 'owner'
    and not exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
    )
  );
