'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Organization } from '@/types/employee'
import { createOrganizationWithOwnerAction, acceptInvitationAction } from '@/lib/org/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Building2, Plus, ArrowRight, Loader2, LogOut, Mail, Check, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'

interface PendingInvitation {
  id: string
  token: string
  role: 'admin' | 'member'
  organization_id: string
  organization_name: string
  expires_at: string
}

interface SelectOrgClientProps {
  organizations: Organization[]
  userEmail: string
  pendingInvitations?: PendingInvitation[]
}

export function SelectOrgClient({
  organizations: initialOrgs,
  userEmail,
  pendingInvitations = [],
}: SelectOrgClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [organizations, setOrganizations] = useState<Organization[]>(initialOrgs)
  const [openDialog, setOpenDialog] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [invites, setInvites] = useState<PendingInvitation[]>(pendingInvitations)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  async function handleAcceptInvite(inv: PendingInvitation) {
    setAcceptingId(inv.id)
    setInviteError(null)

    const res = await acceptInvitationAction(inv.token)
    if (!res.success) {
      setInviteError(res.error || 'No se pudo aceptar la invitación.')
      setAcceptingId(null)
      return
    }

    setInvites((prev) => prev.filter((i) => i.id !== inv.id))
    document.cookie = `rh_current_org_id=${inv.organization_id}; path=/; max-age=31536000; SameSite=Lax`
    router.push('/')
    router.refresh()
  }

  function handleSelectOrg(orgId: string) {
    setSelectedId(orgId)
    document.cookie = `rh_current_org_id=${orgId}; path=/; max-age=31536000; SameSite=Lax`
    router.push('/')
    router.refresh()
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setLoading(true)
    setError(null)

    const result = await createOrganizationWithOwnerAction(newOrgName)

    if (!result.success || !result.data) {
      setError(result.error || 'No se pudo crear la organización.')
      setLoading(false)
      return
    }

    const created = result.data
    setOrganizations((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setNewOrgName('')
    setLoading(false)
    setOpenDialog(false)
    handleSelectOrg(created.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-background">
      <AuthBrandPanel headline="Gestión de Recursos Humanos, nómina y documentación." />

      {/* Panel de contenido */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="auth-enter w-full max-w-md space-y-8">
          {/* Marca compacta — solo en mobile */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <UserCheck className="h-6 w-6" />
            </div>
            <span className="text-lg font-bold tracking-tight">RH Control</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Selecciona tu organización</h1>
            <p className="text-sm text-muted-foreground">
              Sesión iniciada como{' '}
              <span className="font-medium text-foreground">{userEmail}</span>
            </p>
          </div>

          {invites.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Invitaciones pendientes
              </p>

              {inviteError && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {inviteError}
                </div>
              )}

              <div className="space-y-2">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {inv.organization_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Te invitaron como{' '}
                          {inv.role === 'admin' ? 'Administrador' : 'Miembro'}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvite(inv)}
                      disabled={Boolean(acceptingId)}
                      className="shrink-0 gap-1.5"
                    >
                      {acceptingId === inv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Aceptar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {invites.length > 0 && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tus organizaciones
              </p>
            )}

            {organizations.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center space-y-2">
                <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Aún no tienes empresas vinculadas</p>
                <p className="text-xs text-muted-foreground">
                  Crea tu primera empresa para comenzar a gestionar personal.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[22rem] overflow-y-auto -mr-1 pr-1">
                {organizations.map((org) => {
                  const isPending = selectedId === org.id
                  return (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      disabled={Boolean(selectedId)}
                      className={cn(
                        'group flex w-full items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3.5 text-left shadow-xs transition-colors duration-200',
                        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isPending && 'opacity-60',
                        selectedId && !isPending && 'pointer-events-none opacity-40'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{org.name}</p>
                          <p className="text-xs text-muted-foreground">Acceder al panel</p>
                        </div>
                      </div>

                      {isPending ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => setOpenDialog(true)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 text-left text-sm text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              Crear nueva empresa
            </button>
          </div>

          <div className="flex justify-end border-t pt-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Modal para crear nueva Organización */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <form onSubmit={handleCreateOrg}>
            <DialogHeader>
              <DialogTitle>Crear Nueva Organización</DialogTitle>
              <DialogDescription>
                Crea un espacio de trabajo vinculado exclusivamente a tu cuenta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="org_name">Nombre de la Empresa *</Label>
                <Input
                  id="org_name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ej. ACME International, Grupo Garden"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenDialog(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear y Continuar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
