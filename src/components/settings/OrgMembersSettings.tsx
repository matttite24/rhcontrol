'use client'

import { useState, useEffect } from 'react'
import { Organization, OrganizationMember, OrganizationInvitation } from '@/types/employee'
import {
  getOrganizationMembersAction,
  getOrganizationInvitationsAction,
  inviteUserToOrganizationAction,
  revokeInvitationAction,
  removeMemberAction,
} from '@/lib/org/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Copy,
  Check,
  Clock,
  UserCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface OrgMembersSettingsProps {
  organization: Organization
}

export function OrgMembersSettings({ organization }: OrgMembersSettingsProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [loading, setLoading] = useState(true)

  // Form de invitación
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const [membersRes, invitesRes] = await Promise.all([
      getOrganizationMembersAction(organization.id),
      getOrganizationInvitationsAction(organization.id),
    ])

    if (membersRes.success && membersRes.data) {
      setMembers(membersRes.data)
    }
    if (invitesRes.success && invitesRes.data) {
      setInvitations(invitesRes.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [organization.id])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)
    setLastInviteLink(null)

    const res = await inviteUserToOrganizationAction({
      organizationId: organization.id,
      email: email.trim(),
      role,
    })

    if (!res.success) {
      setInviteError(res.error || 'Error al enviar invitación.')
      setInviting(false)
      return
    }

    const inviteUrl =
      res.inviteUrl || `${window.location.origin}/invite/${res.invitation?.token}`
    setLastInviteLink(inviteUrl)
    setInviteSuccess(
      res.emailSent
        ? `Invitación enviada por correo a ${email}`
        : `Invitación generada para ${email}. ${
            res.emailError ? 'No se pudo enviar el correo automáticamente; comparte el enlace.' : ''
          }`
    )
    setEmail('')
    setInviting(false)
    loadData()
  }

  const handleCopyLink = (tokenOrUrl: string) => {
    const fullUrl = tokenOrUrl.startsWith('http')
      ? tokenOrUrl
      : `${window.location.origin}/invite/${tokenOrUrl}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedToken(tokenOrUrl)
    setTimeout(() => setCopiedToken(null), 2500)
  }

  const handleRevoke = async (inviteId: string) => {
    if (!confirm('¿Deseas cancelar esta invitación pendiente?')) return
    const res = await revokeInvitationAction(inviteId, organization.id)
    if (res.success) {
      loadData()
    } else {
      alert(res.error || 'No se pudo cancelar la invitación.')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('¿Seguro que deseas remover este usuario de la organización? Perderá el acceso de inmediato.')) return
    const res = await removeMemberAction(memberId, organization.id)
    if (res.success) {
      loadData()
    } else {
      alert(res.error || 'No se pudo remover al usuario.')
    }
  }

  return (
    <div className="space-y-8">
      {/* Sección Formulario de Invitación */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Invitar Colaborador</h3>
            <p className="text-sm text-muted-foreground">
              Agrega administradores o miembros para que colaboren en la gestión de esta organización.
            </p>
          </div>
        </div>

        <form onSubmit={handleInvite} className="space-y-4 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-medium">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role" className="text-xs font-medium">Rol</Label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="member">Miembro</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          {inviteError && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {inviteSuccess && (
            <div className="p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Check className="h-4 w-4 shrink-0" />
                <span>{inviteSuccess}</span>
              </div>
              {lastInviteLink && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    readOnly
                    value={lastInviteLink}
                    className="h-8 text-xs bg-background"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink(lastInviteLink)}
                    className="h-8 shrink-0 flex items-center gap-1.5"
                  >
                    {copiedToken === lastInviteLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar enlace</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button type="submit" disabled={inviting} className="gap-2">
            {inviting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando invitación...</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Generar Invitación</span>
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Sección Invitaciones Pendientes */}
      {invitations.length > 0 && (
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold text-foreground">
              Invitaciones Pendientes ({invitations.length})
            </h3>
          </div>

          <div className="divide-y border rounded-xl overflow-hidden">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 bg-background"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{inv.email}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      Rol: {inv.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Expira en 7 días
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink(inv.token)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {copiedToken === inv.token ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar enlace</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevoke(inv.id)}
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección Miembros Actuales */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Miembros de la Organización ({members.length})
            </h3>
            <p className="text-sm text-muted-foreground">
              Usuarios con acceso activo y sus roles configurados.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm">Cargando miembros...</span>
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No se encontraron miembros activos.
          </p>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-background"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {member.user_id.slice(0, 8)}... (ID Usuario)
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          member.role === 'owner'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : member.role === 'admin'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {member.role === 'owner' ? 'Propietario' : member.role === 'admin' ? 'Administrador' : 'Miembro'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Miembro desde: {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {member.role !== 'owner' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveMember(member.id)}
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remover
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
