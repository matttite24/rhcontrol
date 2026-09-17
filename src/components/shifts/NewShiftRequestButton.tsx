'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SelectShiftRequestTypeModal } from './SelectShiftRequestTypeModal'
import { Plus, Loader2 } from 'lucide-react'
import { ShiftRequestType, Employee } from '@/types/employee'
import { cn } from '@/lib/utils'
import { useNewItemShortcut } from '@/hooks/use-new-item-shortcut'

// Wizards pesados (800-1100 líneas c/u) que solo se muestran condicionalmente
// al elegir un tipo de solicitud: se cargan bajo demanda para no inflar el
// bundle inicial de /shifts/requests con los 4 juntos.
const wizardLoading = (
  <div className="flex items-center justify-center p-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)
const loadOvertimeWizard = () => import('./OvertimeWizardModal').then((m) => m.OvertimeWizardModal)
const loadLeaveWizard = () => import('./LeavePermissionWizardModal').then((m) => m.LeavePermissionWizardModal)
const loadScheduleChangeWizard = () => import('./ScheduleChangeWizardModal').then((m) => m.ScheduleChangeWizardModal)
const loadVacationWizard = () => import('./VacationWizardModal').then((m) => m.VacationWizardModal)
const loadBiometricWizard = () => import('./BiometricIncidentWizardModal').then((m) => m.BiometricIncidentWizardModal)

const OvertimeWizardModal = dynamic(loadOvertimeWizard, { loading: () => wizardLoading })
const LeavePermissionWizardModal = dynamic(loadLeaveWizard, { loading: () => wizardLoading })
const ScheduleChangeWizardModal = dynamic(loadScheduleChangeWizard, { loading: () => wizardLoading })
const VacationWizardModal = dynamic(loadVacationWizard, { loading: () => wizardLoading })
const BiometricIncidentWizardModal = dynamic(loadBiometricWizard, { loading: () => wizardLoading })

type ActiveView = 'select' | 'horas_extras' | 'permiso_laboral' | 'cambio_horario' | 'solicitud_vacaciones' | 'incidencia_marcacion'

interface NewShiftRequestButtonProps {
  organizationId: string
  organizationName?: string
  employees?: Employee[]
}

export function NewShiftRequestButton({
  organizationId,
  organizationName,
  employees: initialEmployees,
}: NewShiftRequestButtonProps) {
  // Un único <Dialog> raíz para todo el flujo (selector + los 4 wizards):
  // antes cada uno tenía su propio <Dialog>, y pasar de uno a otro cerraba
  // un backdrop y abría otro con animaciones independientes (fade-out 100ms
  // vs fade-in), lo que se veía como un parpadeo. Con un solo Dialog y un
  // solo backdrop, cambiar de vista es solo cambiar qué contenido se pinta
  // dentro — sin remontar el backdrop ni la animación de entrada/salida.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('select')
  const employees: Employee[] = initialEmployees || []
  const router = useRouter()
  const searchParams = useSearchParams()

  // El wizard activo publica aquí su propio "cerrar con confirmación si hay
  // cambios sin guardar" (ver onRegisterRequestClose en cada wizard), para
  // que Escape/click-fuera en el Dialog raíz respeten esa misma confirmación
  // en vez de cerrar directo.
  const requestCloseRef = React.useRef<(() => void) | null>(null)

  // Precargar los 4 chunks de wizards en paralelo apenas se abre el diálogo
  // (sin mostrarlos), para que ya estén en caché cuando el usuario elija uno.
  useEffect(() => {
    if (dialogOpen) {
      loadOvertimeWizard()
      loadLeaveWizard()
      loadScheduleChangeWizard()
      loadVacationWizard()
      loadBiometricWizard()
    }
  }, [dialogOpen])

  // Abrir automáticamente el selector cuando se navega con ?new=1 (ej. desde el sidebar)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setActiveView('select')
      setDialogOpen(true)
      router.replace('/shifts/requests')
    }
  }, [searchParams, router])

  // Atajo de teclado "N": abre el mismo selector que el botón.
  useNewItemShortcut(() => {
    setActiveView('select')
    setDialogOpen(true)
  }, dialogOpen)

  function handleSelectType(type: ShiftRequestType) {
    if (
      type === 'horas_extras' ||
      type === 'permiso_laboral' ||
      type === 'cambio_horario' ||
      type === 'solicitud_vacaciones' ||
      type === 'incidencia_marcacion'
    ) {
      requestCloseRef.current = null
      setActiveView(type)
    } else {
      setDialogOpen(false)
      router.push(`/shifts/new?type=${type}`)
    }
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
  // (caso del selector, que no tiene datos que perder).
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
        Novedad
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        {/* Un único <DialogContent> para todo el flujo: cambiar de vista solo
            cambia qué children recibe, sin desmontar el Portal/Overlay (que
            es lo que causaba el parpadeo al pasar del selector a un wizard). */}
        <DialogContent
          className={cn(
            activeView === 'select'
              ? 'sm:max-w-2xl'
              : activeView === 'solicitud_vacaciones'
                // Más ancho que el resto de wizards: el selector de rango de
                // fechas muestra 2 meses lado a lado (ver DateRangePicker),
                // y con sm:max-w-2xl ese calendario se desbordaba fuera del
                // modal en vez de quedar contenido dentro de su tarjeta.
                ? 'sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0'
                : 'sm:max-w-2xl p-0 overflow-hidden border-border/80 gap-0 max-h-[90vh] flex flex-col'
          )}
          showCloseButton={activeView === 'select'}
        >
          {activeView === 'select' && (
            <SelectShiftRequestTypeModal onSelectType={handleSelectType} />
          )}

          {activeView === 'horas_extras' && (
            <OvertimeWizardModal
              organizationId={organizationId}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'permiso_laboral' && (
            <LeavePermissionWizardModal
              organizationId={organizationId}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'cambio_horario' && (
            <ScheduleChangeWizardModal
              organizationId={organizationId}
              organizationName={organizationName}
              employees={employees}
              open={dialogOpen}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'solicitud_vacaciones' && (
            <VacationWizardModal
              organizationId={organizationId}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'incidencia_marcacion' && (
            <BiometricIncidentWizardModal
              organizationId={organizationId}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
