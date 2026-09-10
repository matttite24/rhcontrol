'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Organization } from '@/types/employee'
import { createOrganizationWithOwnerAction, acceptInvitationAction } from '@/lib/org/actions'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Building2, Plus, ArrowRight, Loader2, LogOut, Mail, Check } from 'lucide-react'

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
    router.push('/employees')
    router.refresh()
  }

  function handleSelectOrg(orgId: string) {
    setSelectedId(orgId)
    document.cookie = `rh_current_org_id=${orgId}; path=/; max-age=31536000; SameSite=Lax`
    router.push('/employees')
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-xl shadow-lg border">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Seleccionar Organización</CardTitle>
            <CardDescription className="text-sm mt-1">
              Sesión iniciada como <span className="font-medium text-foreground">{userEmail}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {invites.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invitaciones pendientes
              </Label>

              {inviteError && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {inviteError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl border bg-primary/5 border-primary/30"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Mail className="h-5 w-5" />
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

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tus Empresas y Organizaciones
            </Label>

            {organizations.length === 0 ? (
              <div className="p-8 text-center border rounded-2xl border-dashed space-y-2">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Aún no tienes empresas vinculadas</p>
                <p className="text-xs text-muted-foreground">
                  Crea tu primera empresa a continuación para comenzar a gestionar personal.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {organizations.map((org) => {
                  const isPending = selectedId === org.id
                  return (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      disabled={Boolean(selectedId)}
                      className="flex items-center justify-between p-4 rounded-2xl border bg-card hover:bg-muted/60 hover:border-primary/50 transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{org.name}</p>
                          <p className="text-xs text-muted-foreground">Acceder al panel de RRHH</p>
                        </div>
                      </div>

                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => setOpenDialog(true)}
            className="w-full border-dashed h-11"
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear nueva empresa
          </Button>
        </CardContent>

        <CardFooter className="flex justify-between items-center border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Cerrar sesión
          </Button>

          <span className="text-xs text-muted-foreground">RH Garden v1.0</span>
        </CardFooter>
      </Card>

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
