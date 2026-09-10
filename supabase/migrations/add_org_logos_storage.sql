-- Bucket público exclusivo para el logo de la empresa (usado en el header de
-- los formatos imprimibles y en la app). Solo imágenes, límite 2 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos',
  'org-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura pública (el bucket es público, pero dejamos la policy explícita).
drop policy if exists "Lectura pública de logos" on storage.objects;
create policy "Lectura pública de logos" on storage.objects
  for select
  using (bucket_id = 'org-logos');

-- Cualquier usuario autenticado puede subir / reemplazar / borrar logos.
-- El path que usa la app es "<organization_id>/logo.<ext>", así que el
-- reemplazo sobrescribe el archivo anterior de esa organización.
drop policy if exists "Subir logos autenticados" on storage.objects;
create policy "Subir logos autenticados" on storage.objects
  for insert
  with check (bucket_id = 'org-logos' and auth.role() = 'authenticated');

drop policy if exists "Actualizar logos autenticados" on storage.objects;
create policy "Actualizar logos autenticados" on storage.objects
  for update
  using (bucket_id = 'org-logos' and auth.role() = 'authenticated');

drop policy if exists "Eliminar logos autenticados" on storage.objects;
create policy "Eliminar logos autenticados" on storage.objects
  for delete
  using (bucket_id = 'org-logos' and auth.role() = 'authenticated');
