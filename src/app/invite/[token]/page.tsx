import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { checkEmailHasAccountAction } from '@/lib/org/actions'
import { InviteFlowClient } from './InviteFlowClient'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const supabase = await createClient()

  // 1. Obtener usuario actual
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2. Consultar la invitación
  const { data: invitation, error } = await supabase
    .from('organization_invitations')
    .select('*, organizations(name, slug, logo_url)')
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-lg">
          <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Invitación no válida</h1>
          <p className="text-sm text-muted-foreground mt-2">
            El enlace de invitación no existe o ya no está disponible.
          </p>
          <div className="mt-6">
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Ir al inicio
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Comprobar estado y expiración
  const isExpired = new Date(invitation.expires_at) < new Date()
  if (invitation.status !== 'pending' || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-lg">
          <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Invitación no disponible</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {invitation.status === 'accepted'
              ? 'Esta invitación ya fue aceptada previamente.'
              : 'Esta invitación ha expirado o fue cancelada por el administrador.'}
          </p>
          <div className="mt-6">
            <Link href="/employees">
              <Button className="w-full">Ir al panel</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const orgName = invitation.organizations?.name || 'Organización'

  // Si no hay sesión, averiguamos si el correo ya tiene cuenta para
  // arrancar el formulario en el modo correcto (login vs. registro).
  const hasAccount = user ? null : (await checkEmailHasAccountAction(invitation.email)).exists

  return (
    <InviteFlowClient
      token={token}
      orgName={orgName}
      inviteEmail={invitation.email}
      role={invitation.role}
      sessionEmail={user?.email ?? null}
      hasAccount={hasAccount}
    />
  )
}
