'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ShiftRequest, Incident } from '@/types/employee'
import { ShiftRequestDetailModal } from '@/components/shifts/ShiftRequestDetailModal'
import { IncidentDetailModal } from '@/components/incidents/IncidentDetailModal'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { upsertOvertimeAdjustmentAction, deleteOvertimeAdjustmentAction } from '@/lib/payroll/actions'
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Receipt,
  FileText,
  ChevronRight,
  Clock,
  AlertCircle,
  FolderOpen,
  ClipboardList,
  Loader2,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PayrollEmployeeActionItem {
  id: string
  code: string
  title: string
  type: string
  category: 'incidencia' | 'turno' | 'anticipo' | 'permiso' | 'sancion' | 'otro'
  status: string
  date: string
  amount?: number | null
  hours?: number | null
  description?: string | null
  /**
   * De qué tabla viene (incidents vs shift_requests): determina qué modal de
   * detalle abrir al hacer clic — ver openActionDetail en PayrollTableView.
   */
  sourceType: 'incident' | 'shift_request'
  /** Tipo crudo de incidencia/solicitud (incident_type o request_type), para resolver qué wizard/modal de detalle corresponde. */
  rawType?: string
  /** Solo horas extras: 'suplementaria_50' o 'extraordinaria_100', para mostrar el recargo aplicado junto al monto. */
  overtimeType?: string | null
  /** true si esta hora extra tiene un ajuste de "horas efectivas" guardado para el borrador en revisión (ver pestaña Novedades). */
  hasOvertimeAdjustment?: boolean
  /** Motivo del ajuste, si existe. */
  overtimeAdjustmentReason?: string | null
  /** Horas originalmente autorizadas (antes del ajuste) — solo horas extras. */
  originalHours?: number | null
}

export interface PayrollEmployeeCalculation {
  employeeId: string
  fullName: string
  nationalId: string | null
  department: string | null
  position: string | null
  avatarUrl: string | null
  status: string
  contractType: string | null
  paymentType: string | null
  bankName: string | null
  accountNumber: string | null

  // Ingresos Base
  baseSalary: number
  bonuses: number
  overtimeAmount: number

  // Décimos y Beneficios Mensualizados (Ecuador)
  accumulateDecimals: boolean
  decimoTercero: number
  decimoCuarto: number
  fondosReserva: number
  totalDecimalsMonthly: number

  totalIncome: number

  // Deducciones
  iessPersonal: number
  /**
   * Tasa efectivamente aplicada (0.0945 normal, 0.176 gerente propietario
   * autoafiliado). Opcional: los snapshots guardados en payroll_reports antes
   * de este campo no lo tienen — se asume 9.45% (comportamiento previo) si
   * falta, ver el fallback al renderizar.
   */
  iessRate?: number
  isOwnerManager?: boolean
  iessCode: string | null
  cashShortages: number
  inventoryDeductions: number
  fines: number
  loans: number
  mealDeductions: number
  otherDeductions: number
  /** Anticipo quincenal recurrente descontado en este corte (0 si no aplica — ver calculatePayroll). */
  biweeklyAdvanceDeducted: number
  totalDeductions: number

  // Neto
  netSalary: number

  // Resumen de Documentos y Solicitudes en el Período
  actionsSummary: {
    total: number
    approved: number
    pending: number
    advancesTotal: number
    overtimeHours: number
    warningsCount: number
    leaveDaysOrHours: string
  }

  // Lista de Documentos, Solicitudes y Acciones del Empleado en el Corte
  actions: PayrollEmployeeActionItem[]

  // Objetos completos (no el resumen de `actions`) para poder abrir el mismo
  // modal de detalle que usan /shifts/requests e /incidents al hacer clic en
  // una fila de "Documentación y Solicitudes" — ver openActionDetail.
  rawShiftRequests: ShiftRequest[]
  rawIncidents: Incident[]

  // Detalles crudos para el desglose del modal
  details: {
    salaryItems: { name: string; amount: number; type: string }[]
    deductionItems: { title: string; amount: number; type: string; is_recurring: boolean; date: string }[]
    shiftRequests: { title: string; hours: number | null; date: string }[]
    incidents: { title: string; type: string; date: string }[]
  }
}

interface PayrollDetailModalProps {
  item: PayrollEmployeeCalculation | null
  startDate: string
  endDate: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Presentes solo si el rol está en 'borrador' (ver /payroll/history/[id]):
   * habilitan la pestaña Novedades para editar horas efectivas. Un rol ya
   * cerrado no los recibe — Novedades pasa a mostrarse de solo lectura.
   */
  payrollReportId?: string
  organizationId?: string
  /**
   * true si YA existe una fila en payroll_reports para este cálculo (sea
   * 'borrador' o 'cerrado') — distingue el mensaje de solo lectura de
   * Novedades entre "este rol ya se generó/cerró" (hasSavedReport=true) y
   * "todavía no se ha guardado ningún borrador" (hasSavedReport=false, ej.
   * en /payroll antes de pulsar "Guardar Borrador"), que antes mostraban el
   * mismo texto engañoso de "ya fue generado".
   */
  hasSavedReport?: boolean
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

export function PayrollDetailModal({
  item,
  startDate,
  endDate,
  open,
  onOpenChange,
  payrollReportId,
  organizationId,
  hasSavedReport = false,
}: PayrollDetailModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'role' | 'novedades' | 'incidencias'>('role')

  // Detalle real de la novedad seleccionada (abre el mismo modal que
  // /shifts/requests o /incidents) — se resuelve por id contra los arrays
  // crudos que vienen en el cálculo, ver rawShiftRequests/rawIncidents.
  const [selectedShiftRequest, setSelectedShiftRequest] = useState<ShiftRequest | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)

  // Edición del ajuste de horas efectivas en Novedades: solo un ajuste
  // abierto a la vez, indexado por shift_request_id.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actualHoursInput, setActualHoursInput] = useState('')
  const [reasonInput, setReasonInput] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const shiftRequestsById = useMemo(
    () => new Map((item?.rawShiftRequests || []).map((r) => [r.id, r])),
    [item]
  )
  const incidentsById = useMemo(
    () => new Map((item?.rawIncidents || []).map((i) => [i.id, i])),
    [item]
  )

  if (!item) return null

  const canEditAdjustments = Boolean(payrollReportId && organizationId)
  const actions = item.actions || []
  // Novedades: solo horas extras (donde aplica el ajuste de horas efectivas).
  // Incidencias: todo lo demás — permisos, vacaciones, anticipos, sanciones,
  // actas — documentación de solo lectura, sin cifras que ajustar.
  const overtimeActions = actions.filter((a) => a.category === 'turno' && a.type === 'Horas Extras')
  const incidentActions = actions.filter((a) => !(a.category === 'turno' && a.type === 'Horas Extras'))
  const approvedCount = incidentActions.filter((a) => a.status === 'aprobado').length
  const pendingCount = incidentActions.filter((a) => a.status === 'pendiente').length

  function openActionDetail(action: PayrollEmployeeActionItem) {
    if (action.sourceType === 'shift_request') {
      const req = shiftRequestsById.get(action.id)
      if (req) setSelectedShiftRequest(req)
    } else {
      const inc = incidentsById.get(action.id)
      if (inc) setSelectedIncident(inc)
    }
  }

  function startEditingAdjustment(action: PayrollEmployeeActionItem) {
    setEditingId(action.id)
    setActualHoursInput(String(action.hours ?? ''))
    setReasonInput(action.overtimeAdjustmentReason ?? '')
  }

  async function handleSaveAdjustment(action: PayrollEmployeeActionItem) {
    if (!payrollReportId || !organizationId || !item) return
    const hours = Number(actualHoursInput)

    if (isNaN(hours) || hours < 0) {
      toast.error('Ingresa un número de horas válido.')
      return
    }
    if (action.originalHours != null && hours > action.originalHours) {
      toast.error('Las horas efectivas no pueden superar las horas autorizadas.')
      return
    }
    if (!reasonInput.trim()) {
      toast.error('Indica un motivo para el ajuste.')
      return
    }

    setSavingId(action.id)
    try {
      const result = await upsertOvertimeAdjustmentAction({
        organizationId,
        payrollReportId,
        shiftRequestId: action.id,
        employeeId: item.employeeId,
        actualHours: hours,
        reason: reasonInput.trim(),
      })

      if (!result.success) {
        toast.error('No se pudo guardar el ajuste', result.error || 'Ocurrió un error inesperado.')
        return
      }

      toast.success('Ajuste guardado', 'Se aplicará al recalcular este borrador.')
      setEditingId(null)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al guardar el ajuste.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleRemoveAdjustment(action: PayrollEmployeeActionItem) {
    if (!payrollReportId) return
    setSavingId(action.id)
    try {
      const result = await deleteOvertimeAdjustmentAction(payrollReportId, action.id)
      if (!result.success) {
        toast.error('No se pudo quitar el ajuste', result.error || 'Ocurrió un error inesperado.')
        return
      }
      toast.success('Ajuste quitado', 'Se volverá a usar lo autorizado originalmente.')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error al quitar el ajuste.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:!w-[50vw] sm:!max-w-[50vw] p-0 overflow-hidden border-l border-border/80 gap-0 flex flex-col h-full bg-background"
      >
        {/* Cabecera / Perfil del Empleado en el Drawer */}
        <SheetHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex items-center gap-3.5 min-w-0">
                <Avatar className="h-12 w-12 ring-2 ring-border shrink-0">
                  <AvatarImage src={item.avatarUrl ?? undefined} alt={item.fullName} />
                  <AvatarFallback className="text-sm font-semibold">
                    {getInitials(item.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 truncate">
                    <span className="truncate">{item.fullName}</span>
                    {item.isOwnerManager ? (
                      <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 shrink-0">
                        Gerente Propietario
                      </Badge>
                    ) : (
                      !item.accumulateDecimals && (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                          Décimos Mensualizados
                        </Badge>
                      )
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono truncate">
                    <span>CI: {item.nationalId || '—'}</span>
                    <span>•</span>
                    <span className="truncate">{item.position || item.department || 'Empleado'}</span>
                  </SheetDescription>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                  Corte de Nómina
                </span>
                <span className="text-xs font-mono font-medium text-foreground">
                  {startDate} al {endDate}
                </span>
              </div>
            </div>

            {/* Selector de Pestañas Integrado: Rol Detalle / Novedades / Incidencias */}
            <div className="pt-3">
              <div className="grid grid-cols-3 bg-muted/60 p-1 rounded-xl border border-border/40">
                <button
                  type="button"
                  onClick={() => setActiveTab('role')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg h-7 transition-all cursor-pointer select-none',
                    activeTab === 'role'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span>Rol Detalle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('novedades')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg h-7 transition-all cursor-pointer select-none',
                    activeTab === 'novedades'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>Novedades</span>
                  {overtimeActions.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-muted text-muted-foreground font-semibold">
                      {overtimeActions.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('incidencias')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg h-7 transition-all cursor-pointer select-none',
                    activeTab === 'incidencias'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                  <span>Incidencias</span>
                  <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-muted text-muted-foreground font-semibold">
                    {incidentActions.length}
                  </span>
                </button>
              </div>
            </div>
          </SheetHeader>

          {/* Contenido Dinámico según pestaña */}
          <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'role' ? (
            <div className="space-y-6">
              {/* Tarjetas KPI Superiores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Total Ingresos</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-foreground">
                    ${item.totalIncome.toFixed(2)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-rose-500/5 border-rose-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span>Total Deducciones</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                    -${item.totalDeductions.toFixed(2)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-primary/10 border-primary/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Neto a Recibir</span>
                  </div>
                  <p className="text-lg font-black font-mono text-primary">
                    ${item.netSalary.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Desglose de 2 Columnas: Ingresos vs Egresos — filas separadas
                  solo por espaciado (sin divisor por línea), la jerarquía la
                  da el color/peso de cada rubro, no una regla horizontal. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Columna Ingresos */}
                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Rubros de Ingreso
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Sueldo Base</span>
                      <span className="font-mono font-medium">${item.baseSalary.toFixed(2)}</span>
                    </div>
                    {item.bonuses > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Bonificaciones</span>
                        <span className="font-mono font-medium">${item.bonuses.toFixed(2)}</span>
                      </div>
                    )}
                    {item.overtimeAmount > 0 && (() => {
                      // Desglose por recargo (50%/100%) sumando las solicitudes
                      // de horas extras aprobadas del período — así se ve
                      // exactamente cuántas horas de cada tipo equivalen al
                      // monto total, en vez de un solo número agregado.
                      const approvedOvertimeActions = actions.filter(
                        (a) => a.category === 'turno' && a.type === 'Horas Extras' && a.status === 'aprobado'
                      )
                      const supplementary = approvedOvertimeActions.filter((a) => a.overtimeType !== 'extraordinaria_100')
                      const extraordinary = approvedOvertimeActions.filter((a) => a.overtimeType === 'extraordinaria_100')
                      const sumHours = (list: typeof approvedOvertimeActions) => list.reduce((s, a) => s + (a.hours || 0), 0)
                      const sumAmount = (list: typeof approvedOvertimeActions) => list.reduce((s, a) => s + (a.amount || 0), 0)

                      return (
                        <>
                          {supplementary.length > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">
                                Horas Extras 50% ({sumHours(supplementary)} hrs)
                              </span>
                              <span className="font-mono font-medium">${sumAmount(supplementary).toFixed(2)}</span>
                            </div>
                          )}
                          {extraordinary.length > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">
                                Horas Extras 100% ({sumHours(extraordinary)} hrs)
                              </span>
                              <span className="font-mono font-medium">${sumAmount(extraordinary).toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )
                    })()}

                    {/* Rubros de Ley Mensualizados en Ecuador — no aplican al
                        Gerente Propietario autoafiliado (sin relación de
                        dependencia, no le corresponden por Código del Trabajo) */}
                    {item.isOwnerManager ? (
                      <p className="text-[11px] text-muted-foreground italic pt-1">
                        No aplica Décimos ni Fondos de Reserva: autoafiliación IESS sin relación de dependencia.
                      </p>
                    ) : (
                      !item.accumulateDecimals && (
                        <div className="space-y-1.5 pt-1">
                          {item.decimoTercero > 0 && (
                            <div className="flex justify-between items-center bg-emerald-500/5 px-2 py-1 rounded-md">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">13er Sueldo (Mensualizado)</span>
                              <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">+${item.decimoTercero.toFixed(2)}</span>
                            </div>
                          )}
                          {item.decimoCuarto > 0 && (
                            <div className="flex justify-between items-center bg-emerald-500/5 px-2 py-1 rounded-md">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">14to Sueldo (Mensualizado)</span>
                              <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">+${item.decimoCuarto.toFixed(2)}</span>
                            </div>
                          )}
                          {item.fondosReserva > 0 && (
                            <div className="flex justify-between items-center bg-emerald-500/5 px-2 py-1 rounded-md">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Fondos de Reserva (8.33%)</span>
                              <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">+${item.fondosReserva.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {item.details.salaryItems
                      .filter((s) => s.type !== 'Sueldo')
                      .map((sal, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-muted-foreground">{sal.name}</span>
                          <span className="font-mono font-medium">${sal.amount.toFixed(2)}</span>
                        </div>
                      ))}

                    <div className="flex justify-between items-center pt-2 mt-1 border-t border-border/50">
                      <span className="text-foreground font-semibold">Total Ingresos</span>
                      <span className="font-mono font-bold text-foreground">${item.totalIncome.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Columna Deducciones y Descuentos */}
                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                    Descuentos del Período
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {item.iessPersonal > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {item.isOwnerManager
                            ? `Aporte IESS Autoafiliación (${((item.iessRate ?? 0.0945) * 100).toFixed(2)}%)`
                            : `Aporte Personal IESS (${((item.iessRate ?? 0.0945) * 100).toFixed(2)}%)`}
                        </span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.iessPersonal.toFixed(2)}</span>
                      </div>
                    )}
                    {item.cashShortages > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Faltante de Caja</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.cashShortages.toFixed(2)}</span>
                      </div>
                    )}
                    {item.inventoryDeductions > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Inventario / Mermas</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.inventoryDeductions.toFixed(2)}</span>
                      </div>
                    )}
                    {item.fines > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Multas</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.fines.toFixed(2)}</span>
                      </div>
                    )}
                    {item.loans > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Préstamos / Anticipos</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.loans.toFixed(2)}</span>
                      </div>
                    )}
                    {item.mealDeductions > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Alimentación</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.mealDeductions.toFixed(2)}</span>
                      </div>
                    )}
                    {item.otherDeductions > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Otras Deducciones</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.otherDeductions.toFixed(2)}</span>
                      </div>
                    )}
                    {item.biweeklyAdvanceDeducted > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground" title="Anticipo pagado a mitad de mes, descontado aquí para no duplicarlo">
                          Anticipo Quincenal
                        </span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.biweeklyAdvanceDeducted.toFixed(2)}</span>
                      </div>
                    )}
                    {item.details.deductionItems.length === 0 && item.iessPersonal === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Sin deducciones registradas en este período.
                      </p>
                    ) : (
                      <div className="flex justify-between items-center pt-2 mt-1 border-t border-border/50">
                        <span className="text-foreground font-semibold">Total Deducciones</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-${item.totalDeductions.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Información de Pago y Cuenta Bancaria */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-2 text-xs">
                <h5 className="font-semibold text-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Datos de Acreditación
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-muted-foreground font-mono">
                  <div>Método: <span className="font-medium text-foreground">{item.paymentType || 'Transferencia'}</span></div>
                  <div>Banco: <span className="font-medium text-foreground">{item.bankName || 'No especificado'}</span></div>
                  <div>Cuenta: <span className="font-medium text-foreground">{item.accountNumber || 'No especificada'}</span></div>
                </div>
              </div>
            </div>
          ) : activeTab === 'novedades' ? (
            /* Pestaña Novedades: ajuste de "horas efectivamente cumplidas"
                por hora extra aprobada. Solo editable si el rol está en
                borrador (canEditAdjustments) — un rol cerrado se ve de solo
                lectura, con el ajuste que ya quedó fijo en su snapshot. */
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-amber-800 dark:text-amber-300">
                  {canEditAdjustments
                    ? 'Ajusta aquí si el empleado no cumplió todas las horas extra autorizadas (ej. según el biométrico). Esto NO modifica la solicitud original, solo afecta el cálculo de este rol.'
                    : hasSavedReport
                    ? 'Este rol ya fue generado: los ajustes aquí mostrados quedaron fijos y no pueden editarse.'
                    : 'Este cálculo aún no se ha guardado. Pulsa "Guardar Borrador" para poder ajustar horas efectivas antes de generar el rol definitivo.'}
                </p>
              </div>

              {overtimeActions.length > 0 ? (
                <div className="rounded-xl border bg-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                  {overtimeActions.map((act) => {
                    const isApproved = act.status === 'aprobado'
                    const isExtraordinary = act.overtimeType === 'extraordinaria_100'
                    const isEditing = editingId === act.id
                    const isSaving = savingId === act.id

                    return (
                      <div key={act.id} className="p-4 text-xs space-y-2.5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="font-mono text-xs font-semibold text-foreground bg-muted/70 border border-border/80 px-2 py-1 rounded-md tracking-tight shrink-0 shadow-2xs">
                              {act.code}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <button
                                type="button"
                                onClick={() => openActionDetail(act)}
                                className="font-semibold text-foreground text-xs leading-snug text-left hover:text-primary cursor-pointer"
                              >
                                {act.title}
                              </button>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                                <span>{act.date}</span>
                                <span>•</span>
                                <span className="text-foreground/80">
                                  Recargo {isExtraordinary ? '100%' : '50%'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5 px-2 capitalize font-medium border shrink-0',
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                                : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50'
                            )}
                          >
                            {act.status}
                          </Badge>
                        </div>

                        {!isApproved ? (
                          <p className="text-[11px] text-muted-foreground italic pl-1">
                            Solo se pueden ajustar horas extras ya aprobadas.
                          </p>
                        ) : isEditing ? (
                          <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={act.originalHours ?? undefined}
                                step={0.25}
                                value={actualHoursInput}
                                onChange={(e) => setActualHoursInput(e.target.value)}
                                className="h-8 w-24 text-xs font-mono"
                                autoFocus
                              />
                              <span className="text-[11px] text-muted-foreground">
                                de {act.originalHours ?? act.hours ?? 0} horas autorizadas
                              </span>
                            </div>
                            <Input
                              value={reasonInput}
                              onChange={(e) => setReasonInput(e.target.value)}
                              placeholder="Motivo del ajuste (ej. según registro del biométrico)"
                              className="h-8 text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveAdjustment(act)}
                                disabled={isSaving}
                                className="h-7 text-[11px] px-3 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                              >
                                {isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Guardar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingId(null)}
                                disabled={isSaving}
                                className="h-7 text-[11px] px-3 cursor-pointer"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 pl-1">
                            <div className="text-[11px]">
                              {act.hasOvertimeAdjustment ? (
                                <span className="text-amber-700 dark:text-amber-400">
                                  Ajustado: <strong className="font-mono">{act.hours} hrs</strong> efectivas de{' '}
                                  {act.originalHours} autorizadas · +${Number(act.amount).toFixed(2)} al rol
                                  {act.overtimeAdjustmentReason && (
                                    <span className="text-muted-foreground italic"> — "{act.overtimeAdjustmentReason}"</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  <strong className="font-mono text-foreground">{act.hours} hrs</strong> autorizadas ·
                                  +${Number(act.amount ?? 0).toFixed(2)} al rol
                                </span>
                              )}
                            </div>
                            {canEditAdjustments && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditingAdjustment(act)}
                                  disabled={isSaving}
                                  className="h-6 px-2 text-[11px] cursor-pointer gap-1"
                                >
                                  <Pencil className="h-3 w-3" />
                                  {act.hasOvertimeAdjustment ? 'Editar' : 'Ajustar'}
                                </Button>
                                {act.hasOvertimeAdjustment && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveAdjustment(act)}
                                    disabled={isSaving}
                                    className="h-6 px-2 text-[11px] cursor-pointer gap-1 text-muted-foreground hover:text-destructive"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Quitar
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center border rounded-xl border-dashed bg-card/40 space-y-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <Clock className="h-5 w-5" />
                  </div>
                  <h5 className="font-semibold text-foreground text-xs">Sin horas extras en este período</h5>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    El empleado no tiene solicitudes de horas extras registradas en estas fechas.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Pestaña Incidencias: documentación no monetaria de solo lectura
                (permisos, vacaciones, anticipos, sanciones, actas). */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground font-mono">
                  <span>Total: <strong className="text-foreground">{incidentActions.length}</strong></span>
                  <span>•</span>
                  <span>Aprobados: <strong className="text-emerald-600 dark:text-emerald-400">{approvedCount}</strong></span>
                  <span>•</span>
                  <span>Pendientes: <strong className="text-orange-600 dark:text-orange-400">{pendingCount}</strong></span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Expediente digital
                </span>
              </div>

              {incidentActions.length > 0 ? (
                <div className="rounded-xl border bg-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                  {incidentActions.map((act) => {
                    const isApproved = act.status === 'aprobado'
                    const isPending = act.status === 'pendiente'
                    const isRejected = act.status === 'rechazado' || act.status === 'anulado'

                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => openActionDetail(act)}
                        className="w-full p-4 hover:bg-muted/30 transition-colors duration-150 ease-out motion-reduce:transition-none flex items-start justify-between gap-4 text-xs text-left cursor-pointer"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="font-mono text-xs font-semibold text-foreground bg-muted/70 border border-border/80 px-2 py-1 rounded-md tracking-tight shrink-0 shadow-2xs">
                            {act.code}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground text-xs leading-snug">
                              {act.title}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                              <span className="font-medium text-foreground/80">{act.type}</span>
                              <span>•</span>
                              <span>{act.date}</span>
                              {act.hours && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary font-medium">{act.hours} hrs</span>
                                </>
                              )}
                              {Boolean(act.amount) && isApproved && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ${Number(act.amount).toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                            {act.description && (
                              <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 italic bg-muted/30 p-2 rounded border border-border/40">
                                {act.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5 px-2 capitalize font-medium border',
                              isApproved && 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
                              isPending && 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50',
                              isRejected && 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                            )}
                          >
                            {act.status}
                          </Badge>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center border rounded-xl border-dashed bg-card/40 space-y-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h5 className="font-semibold text-foreground text-xs">Sin registros en este período</h5>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    El empleado no tiene permisos, vacaciones, anticipos o sanciones registradas en estas fechas.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer del Drawer */}
        <div className="p-4 border-t bg-muted/10 flex items-center justify-end gap-3 shrink-0">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer text-xs h-8 px-4"
          >
            Cerrar
          </Button>
        </div>
      </SheetContent>

      {/* Detalle real de la novedad seleccionada — mismo modal que usan
          /shifts/requests e /incidents, abierto por encima de este drawer. */}
      <ShiftRequestDetailModal
        request={selectedShiftRequest}
        open={Boolean(selectedShiftRequest)}
        onOpenChange={(o) => { if (!o) setSelectedShiftRequest(null) }}
      />
      <IncidentDetailModal
        incident={selectedIncident}
        open={Boolean(selectedIncident)}
        onOpenChange={(o) => { if (!o) setSelectedIncident(null) }}
      />
    </Sheet>
  )
}
