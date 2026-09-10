'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptInvitationAction } from '@/lib/org/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  Loader2,
} from 'lucide-react'

interface InviteFlowClientProps {
  token: string
  orgName: string
  inviteEmail: string
  role: 'admin' | 'member'
  /** Email de la sesión actual, o null si no hay sesión. */
  sessionEmail: string | null
  /** true: el correo ya tiene cuenta; false: no; null: no se pudo determinar. */
  hasAccount: boolean | null
}

export function InviteFlowClient({
  token,
  orgName,
  inviteEmail,
  role,
  sessionEmail,
  hasAccount,
}: InviteFlowClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const loggedIn = !!sessionEmail
  const emailMismatch = loggedIn && sessionEmail!.toLowerCase() !== inviteEmail.toLowerCase()

  // Modo inicial según si el correo ya tiene cuenta. Si no se pudo
  // determinar (hasAccount === null), asumimos usuario nuevo.
  const [mode, setMode] = useState<'signup' | 'login'>(
    hasAccount ? 'login' : 'signup'
  )
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleLabel = role === 'admin' ? 'Administrador' : 'Miembro'

  async function acceptAndRedirect() {
    const res = await acceptInvitationAction(token)
    if (!res.success) {
      throw new Error(res.error || 'No se pudo unir a la organización.')
    }
    if (res.organization_id) {
      try {
        document.cookie = `rh_current_org_id=${res.organization_id}; path=/; max-age=${60 * 60 * 24 * 365}`
      } catch {
        /* noop */
      }
    }
    router.push('/')
    router.refresh()
  }

  async function handleAuthAndAccept(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'signup') {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: inviteEmail,
          password,
        })
        if (signUpErr) {
          // Si el usuario ya existe, sugerir iniciar sesión.
          if (/already registered|already exists/i.test(signUpErr.message)) {
            setMode('login')
            setError('Ya existe una cuenta con este correo. Ingresa tu contraseña.')
            setLoading(false)
            return
          }
          throw signUpErr
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: inviteEmail,
          password,
        })
        if (signInErr) throw signInErr
      }

      await acceptAndRedirect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error.')
      setLoading(false)
    }
  }

  async function handleAcceptLoggedIn() {
    setLoading(true)
    setError(null)
    try {
      await acceptAndRedirect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error.')
      setLoading(false)
    }
  }

  async function handleSwitchAccount() {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 shadow-lg">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-7 w-7" />
        </div>

        <h1 className="text-2xl font-bold text-center">Únete a {orgName}</h1>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Has sido invitado a colaborar con el rol de{' '}
          <span className="font-semibold text-foreground">{roleLabel}</span>.
        </p>

        <div className="my-6 p-4 rounded-xl bg-muted/50 border text-left text-xs space-y-1.5">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Invitación para:</span>
            <span className="font-medium text-foreground break-all">{inviteEmail}</span>
          </div>
          {loggedIn && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sesión actual:</span>
              <span className="font-medium text-foreground break-all">{sessionEmail}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* CASO 1: sesión activa con el correo correcto → aceptar directo */}
        {loggedIn && !emailMismatch && (
          <Button
            onClick={handleAcceptLoggedIn}
            disabled={loading}
            className="w-full gap-2 text-sm font-medium"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Aceptar invitación y entrar
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {/* CASO 2: sesión activa con OTRO correo */}
        {loggedIn && emailMismatch && (
          <div className="space-y-3">
            <p className="text-xs text-amber-600 text-center">
              Esta invitación es para <strong>{inviteEmail}</strong>, pero tu sesión es{' '}
              <strong>{sessionEmail}</strong>.
            </p>
            <Button onClick={handleSwitchAccount} variant="outline" className="w-full">
              Cerrar sesión y usar otra cuenta
            </Button>
          </div>
        )}

        {/* CASO 3: sin sesión → crear cuenta o iniciar sesión */}
        {!loggedIn && (
          <form onSubmit={handleAuthAndAccept} className="space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              {mode === 'signup'
                ? 'No encontramos una cuenta con este correo. Crea una contraseña para registrarte y unirte.'
                : 'Ya tienes una cuenta con este correo. Ingresa tu contraseña para unirte.'}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-medium">
                Correo electrónico
              </Label>
              <Input id="invite-email" type="email" value={inviteEmail} readOnly disabled className="bg-muted/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-password" className="text-xs font-medium">
                {mode === 'signup' ? 'Crea una contraseña' : 'Tu contraseña'}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invite-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2 text-sm font-medium">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {mode === 'signup' ? 'Crear cuenta y unirme' : 'Iniciar sesión y unirme'}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup')
                setError(null)
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              {mode === 'signup'
                ? '¿Ya tienes una cuenta? Inicia sesión'
                : '¿Nuevo aquí? Crea tu cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
