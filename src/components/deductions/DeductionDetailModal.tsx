'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Deduction, Organization } from '@/types/employee'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { Printer, Ban, Loader2, DollarSign, RotateCcw } from 'lucide-react'
import { printCashShortageDocument } from '@/lib/deductions/print-cash-shortage'
import { printDisciplinaryFineDocument } from '@/lib/deductions/print-disciplinary-fine'
import { printInventoryDeductionDocument } from '@/lib/deductions/print-inventory'
import { cancelDeductionAction, reactivateRecurringDeductionAction } from '@/lib/deductions/actions'
import { getDeductionCode } from '@/lib/deductions/sequence'
import { DEDUCTION_TYPE_OPTIONS } from '@/lib/deductions/constants'

interface DeductionDetailModalProps {
  deduction: Deduction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChanged?: (updated: Deduction) => void
  /** Organización activa, ya resuelta server-side. Evita refetchear en cada apertura del modal. */
  organization?: Organization | null
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const MONTH_NAMES = [
  '',
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function formatLongDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)

  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const dayNum = dateObj.getDate()
  const monthName = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayNum} de ${monthName} de ${year}`
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pendiente: { label: 'Pendiente', variant: 'outline' },
  aplicado: { label: 'Aplicado en Rol', variant: 'default' },
  anulado: { label: 'Anulado', variant: 'destructive' },
}

export function DeductionDetailModal({
  deduction,
  open,
  onOpenChange,
  onStatusChanged,
  organization: organizationProp,
}: DeductionDetailModalProps) {
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reactivateLoading, setReactivateLoading] = useState(false)
  const [fetchedOrganization, setFetchedOrganization] = useState<Organization | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const orgId = deduction?.organization_id

  // La organización activa normalmente llega ya resuelta desde el servidor
  // (evita un round-trip en cada apertura del modal). Solo se refetch como
  // respaldo si el padre no la pasó, o si el descuento pertenece a otra org.
  const needsFetch = !organizationProp || organizationProp.id !== orgId
  useEffect(() => {
    if (!orgId || !needsFetch) return
    async function loadOrg() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()
      if (data) setFetchedOrganization(data)
    }
    loadOrg()
  }, [orgId, needsFetch, supabase])

  const organization = needsFetch ? fetchedOrganization : organizationProp

  if (!deduction) return null

  const isCanceled = deduction.status === 'anulado'
  const isCashShortage = deduction.deduction_type === 'faltante_caja'
  const isDisciplinaryFine = deduction.deduction_type === 'multa'
  const isInventory = deduction.deduction_type === 'inventario'
  const isMealHousing = deduction.deduction_type === 'alimentacion' && deduction.is_recurring
  const hasPrintableDocument = isCashShortage || isDisciplinaryFine || isInventory
  const typeMeta = DEDUCTION_TYPE_OPTIONS.find((t) => t.type === deduction.deduction_type)
  const status = statusConfig[deduction.status] ?? statusConfig.pendiente

  async function handleCancelDeduction() {
    if (!deduction) return
    setCancelLoading(true)

    try {
      const res = await cancelDeductionAction({
        deductionId: deduction.id,
        cancellationReason: cancelReason.trim() || 'Anulado por corrección',
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo anular el descuento.')
      }

      toast.success('Descuento anulado formalmente.')
      setCancelDialogOpen(false)
      setCancelReason('')
      if (onStatusChanged) onStatusChanged(res.data)
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al anular el descuento.')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleReactivateDeduction() {
    if (!deduction) return
    setReactivateLoading(true)

    try {
      const res = await reactivateRecurringDeductionAction({ deductionId: deduction.id })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'No se pudo reactivar el descuento.')
      }

      toast.success('Regla de descuento reactivada.')
      if (onStatusChanged) onStatusChanged(res.data)
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al reactivar el descuento.')
    } finally {
      setReactivateLoading(false)
    }
  }

  function handlePrint() {
    if (!deduction || !deduction.employee) return

    if (isCashShortage) {
      printCashShortageDocument({
        organization: organization || undefined,
        employeeName: deduction.employee.full_name,
        nationalId: deduction.employee.national_id || '',
        department: deduction.employee.department || '—',
        position: deduction.employee.position || '—',
        cashDate: deduction.date,
        amount: Number(deduction.amount),
        reason: deduction.description || '—',
        periodMonth: deduction.metadata?.period_month || deduction.period_month,
        periodYear: deduction.metadata?.period_year || deduction.period_year,
        status: deduction.status,
        documentCode: getDeductionCode(deduction),
        issueDate: deduction.metadata?.issue_date,
      })
      return
    }

    if (isDisciplinaryFine) {
      printDisciplinaryFineDocument({
        organization: organization || undefined,
        employeeName: deduction.employee.full_name,
        nationalId: deduction.employee.national_id || '',
        department: deduction.employee.department || '—',
        position: deduction.employee.position || '—',
        fineDate: deduction.date,
        amount: Number(deduction.amount),
        employeeBaseSalary: Number(deduction.metadata?.employee_base_salary) || 0,
        regulationArticle: deduction.metadata?.regulation_article || '—',
        infractionDescription: deduction.metadata?.infraction_description || '—',
        additionalInfo: deduction.description || undefined,
        status: deduction.status,
        documentCode: getDeductionCode(deduction),
        issueDate: deduction.metadata?.issue_date,
      })
      return
    }

    if (isInventory) {
      printInventoryDeductionDocument({
        organization: organization || undefined,
        employeeName: deduction.employee.full_name,
        nationalId: deduction.employee.national_id || '',
        department: deduction.employee.department || '—',
        position: deduction.employee.position || '—',
        deductionDate: deduction.date,
        amount: Number(deduction.amount),
        items: deduction.metadata?.delivery_items_detail || [],
        deliveryActCode: deduction.metadata?.delivery_act_document_code,
        additionalInfo: deduction.description || undefined,
        status: deduction.status,
        documentCode: getDeductionCode(deduction),
        issueDate: deduction.metadata?.issue_date,
      })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-border/80 gap-0 max-h-[92vh] flex flex-col">
          <DialogHeader className="p-5 pb-4 bg-rose-500/10 border-b border-rose-500/20 text-left shrink-0 pr-12">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 shrink-0">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground truncate">
                    {typeMeta?.title || deduction.title}
                  </DialogTitle>
                  <Badge variant={status.variant} className="text-[11px] shrink-0">
                    {status.label}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                  {getDeductionCode(deduction) || deduction.title}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Empleado */}
            <div className="p-3.5 rounded-xl bg-muted/40 border flex items-center gap-2.5 text-xs">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={deduction.employee?.avatar_url || ''} />
                <AvatarFallback className="text-[10px] font-bold">
                  {deduction.employee ? getInitials(deduction.employee.full_name) : ''}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="font-bold text-foreground block">
                  {deduction.employee?.full_name || 'Sin empleado asociado'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {deduction.employee?.position || '—'} • C.I.: {deduction.employee?.national_id || '—'}
                </span>
              </div>
            </div>

            {/* Detalle */}
            <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground text-[11px]">Fecha:</span>
                <span className="font-medium text-foreground">{formatLongDate(deduction.date)}</span>
              </div>
              {deduction.period_month && deduction.period_year && (
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground text-[11px]">Se Descuenta en:</span>
                  <span className="font-medium text-foreground">
                    {MONTH_NAMES[deduction.period_month]} {deduction.period_year}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Valor Descontado:</span>
                <span className="font-bold font-mono text-sm text-rose-600 dark:text-rose-400">
                  -${Number(deduction.amount).toFixed(2)} USD
                </span>
              </div>
            </div>

            {isDisciplinaryFine && (
              <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground text-[11px]">Fundamento Reglamentario:</span>
                  <span className="font-medium text-foreground text-right max-w-[60%]">
                    {deduction.metadata?.regulation_article || '—'}
                  </span>
                </div>
                {deduction.metadata?.fine_ratio != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">% de la Remuneración:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {deduction.metadata.fine_ratio}%
                    </span>
                  </div>
                )}
                {deduction.metadata?.infraction_description && (
                  <div className="pt-1.5 space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Descripción de la falta:</span>
                    <p className="text-xs text-foreground leading-relaxed italic">
                      &ldquo;{deduction.metadata.infraction_description}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}

            {isInventory && (
              <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground text-[11px]">Acta de Origen:</span>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {deduction.metadata?.delivery_act_document_code || '—'}
                  </Badge>
                </div>
                {Array.isArray(deduction.metadata?.delivery_items_detail) && (
                  <div className="pt-1 space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Bienes descontados:</span>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                      {deduction.metadata.delivery_items_detail.map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-[11px]">
                          <span>{it.description} (x{it.quantity})</span>
                          <span className="font-mono font-bold text-foreground">
                            ${Number(it.totalValue).toFixed(2)} USD
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isMealHousing && (
              <div className="p-4 rounded-xl border bg-card text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground text-[11px]">Tipo de Regla:</span>
                  <Badge variant="outline" className="text-[11px] gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Recurrente
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground text-[11px]">Modalidad:</span>
                  <span className="font-medium text-foreground">
                    {deduction.metadata?.calculation_mode === 'por_dias'
                      ? 'Por días trabajados'
                      : 'Mensual fijo'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">
                    {deduction.metadata?.calculation_mode === 'por_dias' ? 'Valor Diario:' : 'Valor Mensual:'}
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    ${Number(deduction.metadata?.base_amount ?? deduction.amount).toFixed(2)} USD
                  </span>
                </div>
              </div>
            )}

            {deduction.description && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground block">
                  Información Adicional
                </span>
                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 border leading-relaxed">
                  {deduction.description}
                </p>
              </div>
            )}

            {isCanceled && deduction.metadata?.cancellation_reason && (
              <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive">
                <strong>Motivo de anulación:</strong> {deduction.metadata.cancellation_reason}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!hasPrintableDocument || cancelLoading}
              className="gap-2 cursor-pointer font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" />
              Imprimir Comprobante
            </Button>

            <div className="flex items-center gap-2">
              {!isCanceled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelLoading}
                  className="border-border/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors cursor-pointer gap-1.5 font-medium text-xs"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Anular
                </Button>
              )}

              {isCanceled && deduction.is_recurring && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReactivateDeduction}
                  disabled={reactivateLoading}
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer gap-1.5 font-medium text-xs"
                >
                  {reactivateLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Reactivar
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de anulación */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-destructive mb-1">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 shrink-0">
                <Ban className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-bold">
                ¿Anular este descuento?
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1 space-y-3">
              <span className="block leading-relaxed">
                Al anular este descuento, quedará invalidado formalmente y no se aplicará en el rol de pagos. El registro se conserva para auditoría.
              </span>
              <span className="space-y-1.5 text-left block">
                <label className="text-xs font-semibold text-foreground block">
                  Motivo de anulación (opcional):
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Error en el monto, faltante ya justificado..."
                  className="w-full h-8 px-3 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelLoading}
              className="cursor-pointer text-xs"
            >
              Volver
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCancelDeduction}
              disabled={cancelLoading}
              className="bg-destructive hover:bg-destructive/90 text-white cursor-pointer gap-1.5 font-semibold text-xs"
            >
              {cancelLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Ban className="h-3.5 w-3.5" />
              )}
              Confirmar Anulación
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
