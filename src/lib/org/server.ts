import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Organization } from '@/types/employee'

const ORG_COOKIE_NAME = 'rh_current_org_id'

/**
 * `cache()` deduplica esta función dentro de un mismo request/render.
 * El layout y cada page llaman a getCurrentOrganization()/getUserOrganizations()
 * de forma independiente; sin cache() eso disparaba 2 auth.getUser() + 2 queries
 * de organization_members idénticas por cada carga de página.
 */
export const getUserOrganizations = cache(async (): Promise<Organization[]> => {
  const supabase = await createClient()

  // 1. Obtener usuario autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // 2. Consultar organizaciones vinculadas al usuario
  const { data: members, error } = await supabase
    .from('organization_members')
    .select('organization_id, organizations (*)')
    .eq('user_id', user.id)

  if (error || !members) return []

  // Extraer las organizaciones mapeadas
  const orgs = members
    .map((m: any) => m.organizations)
    .filter(Boolean) as Organization[]

  return orgs.sort((a, b) => a.name.localeCompare(b.name))
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
