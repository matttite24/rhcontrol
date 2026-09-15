'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SelectIncidentTypeModal } from './SelectIncidentTypeModal'
import { Plus, Loader2 } from 'lucide-react'
import { IncidentType, Employee, Incident } from '@/types/employee'
import { cn } from '@/lib/utils'
import { useNewItemShortcut } from '@/hooks/use-new-item-shortcut'

// Wizards pesados (700-1150 líneas c/u) que solo se muestran condicionalmente
// al elegir un tipo de incidencia: se cargan bajo demanda para no inflar el
// bundle inicial de /incidents con los 5 juntos.
const wizardLoading = (
  <div className="flex items-center justify-center p-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)
const loadWarningWizard = () => import('./WarningWizardModal').then((m) => m.WarningWizardModal)
const loadNonCompliantWizard = () => import('./NonCompliantWizardModal').then((m) => m.NonCompliantWizardModal)
const loadSalaryAdvanceWizard = () => import('./SalaryAdvanceWizardModal').then((m) => m.SalaryAdvanceWizardModal)
const loadDeliveryActWizard = () => import('./DeliveryActWizardModal').then((m) => m.DeliveryActWizardModal)
const loadWorkCertificateWizard = () => import('./WorkCertificateWizardModal').then((m) => m.WorkCertificateWizardModal)

const WarningWizardModal = dynamic(loadWarningWizard, { loading: () => wizardLoading })
const NonCompliantWizardModal = dynamic(loadNonCompliantWizard, { loading: () => wizardLoading })
const SalaryAdvanceWizardModal = dynamic(loadSalaryAdvanceWizard, { loading: () => wizardLoading })
const DeliveryActWizardModal = dynamic(loadDeliveryActWizard, { loading: () => wizardLoading })
const WorkCertificateWizardModal = dynamic(loadWorkCertificateWizard, { loading: () => wizardLoading })

type ActiveView =
  | 'select'
  | 'llamado_atencion'
  | 'actividad_no_conforme'
  | 'anticipo_sueldo'
  | 'acta_entrega'
  | 'certificado_trabajo'

interface NewIncidentButtonProps {
  organizationId?: string
  organizationName?: string
  employees?: Employee[]
}

export function NewIncidentButton({
  organizationId,
  organizationName,
  employees = [],
}: NewIncidentButtonProps = {}) {
  // Un único <Dialog> raíz para todo el flujo (selector + los 5 wizards): ver
  // NewShiftRequestButton (Turnos) para la explicación completa del porqué.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('select')

  // Estado para escalado de actividades no conformes a llamado de atención
  const [escalatedEmployee, setEscalatedEmployee] = useState<Employee | null>(null)
  const [escalatedActivities, setEscalatedActivities] = useState<Incident[]>([])

  const router = useRouter()
  const searchParams = useSearchParams()

  // El wizard activo publica aquí su propio "cerrar con confirmación si hay
  // cambios sin guardar" (ver onRegisterRequestClose en cada wizard), para
  // que Escape/click-fuera en el Dialog raíz respeten esa misma confirmación
  // en vez de cerrar directo.
  const requestCloseRef = React.useRef<(() => void) | null>(null)

  // Abrir automáticamente el selector cuando se navega con ?new=1 (ej. desde el sidebar)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setActiveView('select')
      setDialogOpen(true)
      router.replace('/incidents')
    }
  }, [searchParams, router])

  // Atajo de teclado "N": abre el mismo selector que el botón.
  useNewItemShortcut(() => {
    setActiveView('select')
    setDialogOpen(true)
  }, dialogOpen)

  // Precargar los chunks de wizards en paralelo apenas se abre el diálogo
  // (sin mostrarlos), para que ya estén en caché cuando el usuario elija uno.
  useEffect(() => {
    if (dialogOpen) {
      loadWarningWizard()
      loadNonCompliantWizard()
      loadSalaryAdvanceWizard()
      loadDeliveryActWizard()
      loadWorkCertificateWizard()
    }
  }, [dialogOpen])

  function handleSelectType(type: IncidentType) {
    if (
      type === 'acta_entrega' ||
      type === 'llamado_atencion' ||
      type === 'actividad_no_conforme' ||
      type === 'anticipo_sueldo' ||
      type === 'certificado_trabajo'
    ) {
      if (type === 'llamado_atencion') {
        setEscalatedEmployee(null)
        setEscalatedActivities([])
      }
      requestCloseRef.current = null
      setActiveView(type)
      return
    }
    setDialogOpen(false)
    router.push(`/incidents/new?type=${type}`)
  }

  function handleTriggerWarningFromNonCompliant(employee: Employee, activities: Incident[]) {
    setEscalatedEmployee(employee)
    setEscalatedActivities(activities)
    requestCloseRef.current = null
    setActiveView('llamado_atencion')
  }

  function forceCloseDialog() {
    setDialogOpen(false)
    requestCloseRef.current = null
    // Al cerrar del todo, volver al selector para la próxima apertura.
    setTimeout(() => setActiveView('select'), 200)
  }

  // Onopenchange del Dialog raíz: si hay un wizard activo con su propio
  // cierre-con-confirmación registrado, se delega ahí (Escape y click-fuera
  // se comportan igual que su botón "Cerrar" interno); si no, cierra directo
  // (caso del selector, o wizards sin datos que perder).
  function handleDialogOpenChange(open: boolean) {
    if (open) {
      setDialogOpen(true)
      return
    }
    if (requestCloseRef.current) {
      requestCloseRef.current()
    } else {
      forceCloseDialog()
    }
  }

  // Cada wizard pide cerrarse a través de esto tras su propia confirmación
  // (o directo, si no había cambios que perder) en vez de controlar su
  // propio Dialog.
  function handleWizardOpenChange(open: boolean) {
    if (!open) forceCloseDialog()
  }

  return (
    <>
      <Button
        onClick={() => {
          setActiveView('select')
          setDialogOpen(true)
        }}
        size="sm"
        className="gap-2 font-medium cursor-pointer"
        title="Atajo: N"
      >
        <Plus className="h-4 w-4" />
        Nueva Incidencia
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        {/* Un único <DialogContent> para todo el flujo: cambiar de vista solo
            cambia qué children recibe, sin desmontar el Portal/Overlay. */}
        <DialogContent
          className={cn(
            activeView === 'select'
              ? 'sm:max-w-xl max-h-[85vh] overflow-y-auto'
              : activeView === 'acta_entrega'
                ? 'sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden'
                : 'sm:max-w-2xl p-0 overflow-hidden border-border/80 gap-0 max-h-[92vh] flex flex-col'
          )}
          showCloseButton={activeView === 'select'}
        >
          {activeView === 'certificado_trabajo' && (
            <WorkCertificateWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}
          {activeView === 'select' && (
            <SelectIncidentTypeModal onSelectType={handleSelectType} />
          )}

          {activeView === 'llamado_atencion' && (
            <WarningWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              open={dialogOpen}
              onOpenChange={(val) => {
                if (!val) {
                  handleWizardOpenChange(false)
                  setEscalatedEmployee(null)
                  setEscalatedActivities([])
                }
              }}
              onSuccess={() => router.refresh()}
              initialEmployee={escalatedEmployee}
              initialNonCompliantActivities={escalatedActivities}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'actividad_no_conforme' && (
            <NonCompliantWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onTriggerWarningModal={handleTriggerWarningFromNonCompliant}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'anticipo_sueldo' && (
            <SalaryAdvanceWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'acta_entrega' && (
            <DeliveryActWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              open={dialogOpen}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
