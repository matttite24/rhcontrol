'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SelectDeductionTypeModal } from './SelectDeductionTypeModal'
import { DeductionTypeOption } from '@/lib/deductions/constants'
import { Plus, Loader2 } from 'lucide-react'
import { Employee } from '@/types/employee'
import { cn } from '@/lib/utils'

// Wizards pesados (570-735 líneas c/u) que solo se muestran condicionalmente
// al elegir un tipo de descuento: se cargan bajo demanda para no inflar el
// bundle inicial de /deductions con los 4 juntos.
const wizardLoading = (
  <div className="flex items-center justify-center p-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)
const loadCashShortageWizard = () => import('./CashShortageWizardModal').then((m) => m.CashShortageWizardModal)
const loadDisciplinaryFineWizard = () => import('./DisciplinaryFineWizardModal').then((m) => m.DisciplinaryFineWizardModal)
const loadInventoryWizard = () => import('./InventoryDeductionWizardModal').then((m) => m.InventoryDeductionWizardModal)
const loadMealHousingWizard = () => import('./MealHousingDeductionWizardModal').then((m) => m.MealHousingDeductionWizardModal)

const CashShortageWizardModal = dynamic(loadCashShortageWizard, { loading: () => wizardLoading })
const DisciplinaryFineWizardModal = dynamic(loadDisciplinaryFineWizard, { loading: () => wizardLoading })
const InventoryDeductionWizardModal = dynamic(loadInventoryWizard, { loading: () => wizardLoading })
const MealHousingDeductionWizardModal = dynamic(loadMealHousingWizard, { loading: () => wizardLoading })

type ActiveView = 'select' | 'faltante_caja' | 'multa' | 'inventario' | 'alimentacion'

interface NewDeductionButtonProps {
  organizationId?: string
  organizationName?: string
  employees?: Employee[]
}

export function NewDeductionButton({
  organizationId,
  organizationName,
  employees = [],
}: NewDeductionButtonProps = {}) {
  const router = useRouter()

  // Un único <Dialog> raíz para todo el flujo (selector + los 4 wizards): ver
  // NewShiftRequestButton (Turnos) para la explicación completa del porqué.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('select')

  // El wizard activo publica aquí su propio "cerrar con confirmación si hay
  // cambios sin guardar" (ver onRegisterRequestClose en cada wizard), para
  // que Escape/click-fuera en el Dialog raíz respeten esa misma confirmación
  // en vez de cerrar directo.
  const requestCloseRef = React.useRef<(() => void) | null>(null)

  // Precargar los 4 chunks de wizards en paralelo apenas se abre el diálogo
  // (sin mostrarlos), para que ya estén en caché cuando el usuario elija uno.
  useEffect(() => {
    if (dialogOpen) {
      loadCashShortageWizard()
      loadDisciplinaryFineWizard()
      loadInventoryWizard()
      loadMealHousingWizard()
    }
  }, [dialogOpen])

  function handleSelectType(option: DeductionTypeOption) {
    if (
      option.type === 'faltante_caja' ||
      option.type === 'multa' ||
      option.type === 'inventario' ||
      option.type === 'alimentacion'
    ) {
      requestCloseRef.current = null
      setActiveView(option.type)
      return
    }
    setDialogOpen(false)
    router.push(`/deductions/new?type=${option.type}`)
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
        className="gap-2 font-medium cursor-pointer"
        size="sm"
      >
        <Plus className="h-4 w-4" />
        Nuevo Descuento
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        {/* Un único <DialogContent> para todo el flujo: cambiar de vista solo
            cambia qué children recibe, sin desmontar el Portal/Overlay. */}
        <DialogContent
          className={cn(
            activeView === 'select'
              ? 'sm:max-w-xl p-0 overflow-hidden border-border/80 gap-0'
              : 'sm:max-w-2xl p-0 overflow-hidden border-border/80 gap-0 max-h-[92vh] flex flex-col'
          )}
          showCloseButton={activeView === 'select'}
        >
          {activeView === 'select' && (
            <SelectDeductionTypeModal onSelectType={handleSelectType} />
          )}

          {activeView === 'faltante_caja' && (
            <CashShortageWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'multa' && (
            <DisciplinaryFineWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'inventario' && (
            <InventoryDeductionWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
              organizationName={organizationName}
              employees={employees}
              onOpenChange={handleWizardOpenChange}
              onSuccess={() => router.refresh()}
              onRegisterRequestClose={(fn) => { requestCloseRef.current = fn }}
            />
          )}

          {activeView === 'alimentacion' && (
            <MealHousingDeductionWizardModal
              organizationId={organizationId || employees[0]?.organization_id || ''}
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
