import { getUserOrganizations } from '@/lib/org/server'
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

  // 2. Cargar ÚNICAMENTE las organizaciones a las que pertenece este usuario
  const organizations = await getUserOrganizations()

  return (
    <SelectOrgClient
      organizations={organizations}
      userEmail={user.email ?? 'Usuario'}
    />
  )
}
