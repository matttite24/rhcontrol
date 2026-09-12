'use client'

import { useState } from 'react'
import { Organization } from '@/types/employee'
import { createOrganizationWithOwnerAction } from '@/lib/org/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, ChevronsUpDown, Check, Plus, Loader2 } from 'lucide-react'

interface OrgSwitcherProps {
  currentOrg: Organization | null
  organizations: Organization[]
}

export function OrgSwitcher({
  currentOrg,
  organizations: initialOrgs,
}: OrgSwitcherProps) {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrgs)
  const [activeOrg, setActiveOrg] = useState<Organization | null>(currentOrg)
  const [openDialog, setOpenDialog] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Evita doble clic mientras se procesa el cambio de empresa (la recarga
  // completa de abajo tarda un instante en arrancar).
  const [switching, setSwitching] = useState(false)

  function handleSelectOrg(org: Organization) {
    if (org.id === activeOrg?.id || switching) return
    setSwitching(true)
    document.cookie = `rh_current_org_id=${org.id}; path=/; max-age=31536000; SameSite=Lax`
    setActiveOrg(org)
    // router.refresh() solo revalida los Server Components de la ruta
    // actual: no reejecuta el middleware ni reinicializa el estado de los
    // Client Components que ya cargaron datos de la organización anterior
    // (selects con useState inicial, cachés en memoria, etc.) — eso es lo
    // que dejaba el cambio de empresa "en el aire" a veces. Una recarga dura
    // de la página resincroniza todo (middleware, cookies, cada componente)
    // desde cero contra la organización nueva, sin arriesgar estado residual.
    window.location.href = '/'
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
    handleSelectOrg(created)
    setNewOrgName('')
    setLoading(false)
    setOpenDialog(false)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={switching}
              render={
                <SidebarMenuButton
                  size="lg"
                  disabled={switching}
                  className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground disabled:opacity-70 disabled:cursor-wait"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {switching ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Building2 className="size-4" />
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {switching ? 'Cambiando de empresa...' : (activeOrg?.name ?? 'Seleccionar Empresa')}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      Organización
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              }
            />

            <DropdownMenuContent
              className="w-64 rounded-lg"
              align="start"
              side="bottom"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Empresas
                </DropdownMenuLabel>

                {organizations.map((org) => {
                  const isSelected = org.id === activeOrg?.id
                  return (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => handleSelectOrg(org)}
                      className="gap-2 p-2 cursor-pointer"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <Building2 className="size-3.5 shrink-0" />
                      </div>
                      <span className="flex-1 truncate">{org.name}</span>
                      {isSelected && <Check className="size-4 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setOpenDialog(true)}
                className="gap-2 p-2 cursor-pointer text-primary"
              >
                <div className="flex size-6 items-center justify-center rounded-md border border-dashed">
                  <Plus className="size-4" />
                </div>
                <span className="font-medium">Crear empresa</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Modal para crear nueva Organización */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <form onSubmit={handleCreateOrg}>
            <DialogHeader>
              <DialogTitle>Crear Empresa</DialogTitle>
              <DialogDescription>
                Crea una nueva organización para gestionar su personal.
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
                  placeholder="Ej. ACME Corp"
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
                Crear Empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
