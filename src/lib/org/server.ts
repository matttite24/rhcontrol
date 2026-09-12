import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Organization } from '@/types/employee'
import { withTimeout } from '@/lib/utils/with-timeout'

const ORG_COOKIE_NAME = 'rh_current_org_id'

/**
 * `cache()` deduplica esta función dentro de un mismo request/render.
 * El layout y cada page llaman a getCurrentOrganization()/getUserOrganizations()
 * de forma independiente; sin cache() eso disparaba 2 auth.getUser() + 2 queries
 * de organization_members idénticas por cada carga de página.
 *
 * Es también el punto compartido por TODAS las páginas del dashboard (vía
 * getCurrentOrganization en el layout) — si alguna de sus dos llamadas a
 * Supabase se queda colgada (red intermitente, cold start de conexión), sin
 * timeout la página entera nunca resuelve: Next.js deja el loading.tsx de la
 * ruta mostrado indefinidamente, sin importar cuántos datos tenga esa lista.
 * Con el timeout, se falla rápido y se trata igual que "sin organizaciones"
 * en vez de colgar la carga para siempre.
 */
export const getUserOrganizations = cache(async (): Promise<Organization[]> => {
  try {
    const supabase = await createClient()

    // 1. Obtener usuario autenticado
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), 8000, 'Timeout obteniendo usuario autenticado')

    if (!user) return []

    // 2. Consultar organizaciones vinculadas al usuario
    const { data: members, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('organization_members')
          .select('organization_id, organizations (*)')
          .eq('user_id', user.id)
      ),
      8000,
      'Timeout consultando organizaciones del usuario'
    )

    if (error || !members) return []

    // Extraer las organizaciones mapeadas
    const orgs = members
      .map((m: any) => m.organizations)
      .filter(Boolean) as Organization[]

    return orgs.sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    console.error('[getUserOrganizations] Error/timeout:', err)
    // Fail-safe: mejor mostrar "sin organizaciones" (ver NoActiveOrg) que
    // dejar la página colgada esperando una respuesta que nunca llega.
    return []
  }
})

export const getCurrentOrganization = cache(async (): Promise<Organization | null> => {
  const userOrgs = await getUserOrganizations()
  if (userOrgs.length === 0) return null

  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get(ORG_COOKIE_NAME)?.value

  // Si tiene guardada una org en cookies y pertenece al usuario, usarla
  if (savedOrgId) {
    const matched = userOrgs.find((o) => o.id === savedOrgId)
    if (matched) return matched
  }

  // Si no, usar la primera organización que tenga asignada el usuario
  return userOrgs[0]
})
