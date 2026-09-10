import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { SettingsTabsView } from '@/components/settings/SettingsTabsView'
import { Department, Position, Organization, Holiday } from '@/types/employee'
import { Building2 } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <div className="flex flex-col flex-1 p-8 items-center justify-center text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">No hay empresa seleccionada</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Selecciona o crea una empresa desde el menú superior del sidebar para gestionar sus parámetros.
        </p>
      </div>
    )
  }

  // Cargar datos completos de la organización, departamentos y cargos
  const [{ data: orgData }, { data: departments }, { data: positions }, { data: holidays }] = await Promise.all([
    supabase
      .from('organizations')
      .select('*')
      .eq('id', currentOrg.id)
      .single(),
    supabase
      .from('departments')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true }),
    supabase
      .from('positions')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true }),
    supabase
      .from('holidays')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('date', { ascending: true }),
  ])

  const fullOrg = (orgData as Organization) ?? currentOrg

  return (
    <SettingsTabsView
      organization={fullOrg}
      departments={(departments as Department[]) ?? []}
      positions={(positions as Position[]) ?? []}
      holidays={(holidays as Holiday[]) ?? []}
    />
  )
}
