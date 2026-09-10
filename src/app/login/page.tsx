'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, Mail, UserCheck } from 'lucide-react'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    // Destino tras autenticarse: respeta ?redirect= (p. ej. enlaces de invitación)
    const redirectParam = new URLSearchParams(window.location.search).get('redirect')
    const destination = redirectParam?.startsWith('/') ? redirectParam : '/select-org'

    if (isSignUp) {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.')
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden. Verifícalas e inténtalo de nuevo.')
        setLoading(false)
        return
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // Con confirmación de correo desactivada, signUp deja sesión activa.
      if (signUpData.session) {
        router.push(destination)
        router.refresh()
        return
      }

      setMessage('Cuenta creada con éxito. Si tu proyecto requiere confirmación, revisa tu correo.')
      setLoading(false)
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      router.push(destination)
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-background">
      <AuthBrandPanel headline="Gestión de Recursos Humanos, nómina y documentación." />

      {/* Panel de formulario */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="auth-enter w-full max-w-sm space-y-8">
          {/* Marca compacta — solo en mobile */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <UserCheck className="h-6 w-6" />
            </div>
            <span className="text-lg font-bold tracking-tight">RH Control</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isSignUp ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSignUp
                ? 'Regístrate para empezar a gestionar tu organización.'
                : 'Ingresa tus credenciales para acceder a tu panel.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 leading-relaxed">
                {error}
              </div>
            )}

            {message && (
              <div className="p-3 text-xs rounded-xl bg-primary/10 text-primary border border-primary/20 leading-relaxed">
                {message}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="admin@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={isSignUp ? 6 : undefined}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9"
                    aria-invalid={confirmPassword.length > 0 && confirmPassword !== password}
                  />
                </div>
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
                )}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSignUp ? 'Crear cuenta' : 'Iniciar Sesión'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setMessage(null)
                setConfirmPassword('')
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              {isSignUp
                ? '¿Ya tienes una cuenta? Inicia sesión aquí'
                : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
