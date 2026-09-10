import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { acceptInvitationAction } from '@/lib/org/actions'
import { Button } from '@/components/ui/button'
import { Building2, CheckCircle2, AlertCircle, ArrowRight, LogIn } from 'lucide-react'

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

  // Si no está logueado, pedir login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-lg">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Te han invitado a {orgName}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Se ha enviado una invitación a <strong className="text-foreground">{invitation.email}</strong> para unirse con el rol de <strong className="text-foreground">{invitation.role === 'admin' ? 'Administrador' : 'Miembro'}</strong>.
          </p>
          <div className="mt-6 space-y-3">
            <Link href={`/login?redirect=/invite/${token}`}>
              <Button className="w-full gap-2">
                <LogIn className="h-4 w-4" />
                Iniciar sesión para aceptar
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Server action al hacer click en Aceptar
  async function handleAccept() {
    'use server'
    const res = await acceptInvitationAction(token)
    if (!res.success) {
      throw new Error(res.error || 'Error al unirse a la organización.')
    }
    // Guardar cookie de org activa
    if (res.organization_id) {
      const cookieStore = await cookies()
      cookieStore.set('rh_current_org_id', res.organization_id, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
    redirect('/employees')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-lg">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-7 w-7" />
        </div>

        <h1 className="text-2xl font-bold">Únete a {orgName}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Has sido invitado a colaborar con el rol de{' '}
          <span className="font-semibold text-foreground">
            {invitation.role === 'admin' ? 'Administrador' : 'Miembro'}
          </span>
          .
        </p>

        <div className="my-6 p-4 rounded-xl bg-muted/50 border text-left text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invitación para:</span>
            <span className="font-medium text-foreground">{invitation.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sesión actual:</span>
            <span className="font-medium text-foreground">{user.email}</span>
          </div>
        </div>

        <form action={handleAccept}>
          <Button type="submit" className="w-full gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Aceptar invitación y entrar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
