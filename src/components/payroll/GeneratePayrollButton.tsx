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
import { generatePayrollReportAction } from '@/lib/payroll/actions'
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'

interface GeneratePayrollButtonProps {
  payrollReportId: string
}

/**
 * Cierra el borrador del rol: recalcula con los ajustes de Novedades ya
 * guardados, fija el snapshot definitivo y lo marca 'cerrado' — a partir de
 * ahí ya no admite más ajustes ni ediciones (ver generatePayrollReportAction).
 */
export function GeneratePayrollButton({ payrollReportId }: GeneratePayrollButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleGenerate() {
    setLoading(true)
    try {
      const result = await generatePayrollReportAction(payrollReportId)
      if (!result.success) {
        toast.error('No se pudo generar el rol', result.error || 'Ocurrió un error inesperado.')
        return
      }
      toast.success('Rol generado', 'El corte quedó cerrado y ya no admite más ajustes.')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al generar el rol.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-1.5 font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CheckCircle2 className="h-4 w-4" />
        Generar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  ¿Generar el rol definitivo?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Se fijará el cálculo actual (con los ajustes de Novedades aplicados) como el registro histórico
                  cerrado. Después de esto ya no podrás editar horas efectivas ni recalcular este rol.
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
              Seguir revisando
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
              className="cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Sí, generar rol definitivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
