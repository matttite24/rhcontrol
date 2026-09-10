import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente admin de Supabase (service_role). SÓLO para uso en el servidor.
 * Salta RLS y expone `auth.admin.*` (inviteUserByEmail, generateLink, etc).
 *
 * Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY.
 * Devuelve `null` si no está configurada, para permitir degradar con gracia.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
