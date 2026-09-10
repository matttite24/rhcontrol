'use client'

import { useState } from 'react'
import { Department, Position, Organization, Holiday } from '@/types/employee'
import { OrgProfileForm } from '@/components/settings/OrgProfileForm'
import { SettingsManager } from '@/components/settings/SettingsManager'
import { PayrollParametersSettings } from '@/components/settings/PayrollParametersSettings'
import { HolidaysSettings } from '@/components/settings/HolidaysSettings'
import { OrgMembersSettings } from '@/components/settings/OrgMembersSettings'
import { Button } from '@/components/ui/button'
import { Building2, Layers, Coins, Check, CalendarHeart, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsTabsViewProps {
  organization: Organization
  departments: Department[]
  positions: Position[]
  holidays: Holiday[]
}

type SettingsTab = 'profile' | 'structure' | 'payroll' | 'holidays' | 'members'

const TABS: { id: SettingsTab; label: string; icon: typeof Building2 }[] = [
  { id: 'profile', label: 'Perfil', icon: Building2 },
  { id: 'structure', label: 'Departamentos y Cargos', icon: Layers },
  { id: 'payroll', label: 'Parámetros de Nómina', icon: Coins },
  { id: 'holidays', label: 'Feriados', icon: CalendarHeart },
  { id: 'members', label: 'Miembros e Invitaciones', icon: Users },
]

export function SettingsTabsView({
  organization,
  departments,
  positions,
  holidays,
}: SettingsTabsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Las pestañas ocupan el lugar del header: barra sticky superior */}
      <header className="sticky top-0 z-10 border-b bg-background px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {activeTab === 'profile' && (
            <Button
              type="submit"
              form="org-profile-form"
              size="sm"
              className="shadow-sm self-start sm:self-auto shrink-0"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Guardar Cambios
            </Button>
          )}
        </div>
      </header>

      {/* Contenido de la pestaña activa */}
      <div className="p-6 md:p-8 max-w-7xl w-full mx-auto">
        {activeTab === 'profile' ? (
          <OrgProfileForm organization={organization} />
        ) : activeTab === 'structure' ? (
          <SettingsManager
            currentOrgId={organization.id}
            departments={departments}
            positions={positions}
          />
        ) : activeTab === 'payroll' ? (
          <PayrollParametersSettings currentOrgId={organization.id} />
        ) : activeTab === 'holidays' ? (
          <HolidaysSettings currentOrgId={organization.id} holidays={holidays} />
        ) : (
          <OrgMembersSettings organization={organization} />
        )}
      </div>
    </div>
  )
}
