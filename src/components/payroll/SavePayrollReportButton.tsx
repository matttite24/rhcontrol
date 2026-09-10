'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { PayrollEmployeeCalculation } from './PayrollDetailModal'
import { Save, Loader2 } from 'lucide-react'

interface SavePayrollReportButtonProps {
  organizationId: string
  startDate: string
  endDate: string
  department?: string
  calculations: PayrollEmployeeCalculation[]
}

export function SavePayrollReportButton({
  organizationId,
  startDate,
  endDate,
  department,
  calculations,
}: SavePayrollReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(`Nómina del ${startDate} al ${endDate}${department ? ` - ${department}` : ''}`)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const totalIncome = calculations.reduce((sum, c) => sum + c.totalIncome, 0)
  const totalDeductions = calculations.reduce((sum, c) => sum + c.totalDeductions, 0)
  const totalNet = calculations.reduce((sum, c) => sum + c.netSalary, 0)

  async function handleSave() {
    if (!title.trim()) {
      toast.error('Título requerido', 'Por favor ingresa un nombre para identificar este reporte.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payroll_reports')
        .insert({
          organization_id: organizationId,
          title: title.trim(),
          start_date: startDate,
          end_date: endDate,
          department: department || null,
          total_employees: calculations.length,
          total_income: totalIncome,
          total_deductions: totalDeductions,
          total_net: totalNet,
          status: 'cerrado',
          snapshot: calculations,
        })
        .select('id')
        .single()

      if (error) throw error

      toast.success('Reporte Guardado', 'El corte de nómina se guardó en el historial exitosamente.')
      setOpen(false)
      router.push('/payroll/history')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error('Error al guardar', err?.message || 'No se pudo guardar el reporte.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 font-medium cursor-pointer"
        size="sm"
        disabled={calculations.length === 0}
      >
        <Save className="h-4 w-4" />
        Guardar en Historial
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar Corte de Nómina</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Guarda este cálculo como un reporte histórico cerrado con el consolidado de todos los empleados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre o Identificador del Reporte</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Nómina Quincenal Agosto 2026"
                className="text-xs"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Período:</span>
                <span className="font-semibold text-foreground">{startDate} al {endDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empleados:</span>
                <span className="font-semibold text-foreground">{calculations.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Líquido a Pagar:</span>
                <span className="font-bold text-primary">${totalNet.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading}
              className="text-xs cursor-pointer gap-1.5"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar Reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
