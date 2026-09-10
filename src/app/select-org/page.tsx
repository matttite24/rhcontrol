import { getUserOrganizations } from '@/lib/org/server'
import { getMyPendingInvitationsAction } from '@/lib/org/actions'
import { SelectOrgClient } from '@/components/org/SelectOrgClient'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SelectOrgPage() {
  const supabase = await createClient()

  // 1. Validar sesión de usuario
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Cargar organizaciones del usuario + invitaciones pendientes a su correo
  const [organizations, invitesRes] = await Promise.all([
    getUserOrganizations(),
    getMyPendingInvitationsAction(),
  ])

  return (
    <SelectOrgClient
      organizations={organizations}
      userEmail={user.email ?? 'Usuario'}
      pendingInvitations={invitesRes.success ? invitesRes.data ?? [] : []}
    />
  )
}
