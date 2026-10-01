'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { deletePayrollDraftAction } from '@/lib/payroll/actions'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'

interface DeletePayrollDraftButtonProps {
  payrollReportId: string
  title: string
  /** Si se indica, navega ahí tras eliminar (p. ej. desde el detalle); si no, refresca la lista. */
  redirectTo?: string
}

/**
 * Elimina un rol en 'borrador' (con confirmación) para empezar de nuevo.
 * Los roles cerrados/pagados no se pueden borrar — ver deletePayrollDraftAction.
 */
export function DeletePayrollDraftButton({ payrollReportId, title, redirectTo }: DeletePayrollDraftButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const result = await deletePayrollDraftAction(payrollReportId)
      if (!result.success) {
        toast.error('No se pudo eliminar el borrador', result.error || 'Ocurrió un error inesperado.')
        return
      }
      toast.success('Borrador eliminado', 'Ya puedes generar un nuevo corte desde cero.')
      setOpen(false)
      if (redirectTo) router.push(redirectTo)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al eliminar el borrador.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
        title="Eliminar borrador"
        aria-label="Eliminar borrador"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Eliminar este borrador?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Se eliminará «{title}» junto con los ajustes de horas efectivas que hayas hecho en Novedades.
                  No afecta a las novedades originales. Esta acción no se puede deshacer.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={loading}
              className="cursor-pointer gap-1.5 font-semibold"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Sí, eliminar borrador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
