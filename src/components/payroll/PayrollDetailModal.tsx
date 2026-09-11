'use client'

import React, { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  User,
  Building,
  Calendar,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Sparkles,
  Clock,
  AlertCircle,
  FolderOpen,
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
}: PayrollDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'monetary' | 'documents'>('monetary')

  if (!item) return null

  const actions = item.actions || []
  const approvedCount = actions.filter((a) => a.status === 'aprobado').length
  const pendingCount = actions.filter((a) => a.status === 'pendiente').length

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

            {/* Selector de Pestañas Integrado */}
            <div className="pt-3">
              <div className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl border border-border/40">
                <button
                  type="button"
                  onClick={() => setActiveTab('monetary')}
                  className={cn(
                    'flex items-center justify-center gap-2 text-xs font-medium rounded-lg h-7 transition-all cursor-pointer select-none',
                    activeTab === 'monetary'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span>Detalles Monetarios</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className={cn(
                    'flex items-center justify-center gap-2 text-xs font-medium rounded-lg h-7 transition-all cursor-pointer select-none',
                    activeTab === 'documents'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                  <span>Documentación y Solicitudes</span>
                  <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-muted text-muted-foreground font-semibold">
                    {actions.length}
                  </span>
                </button>
              </div>
            </div>
          </SheetHeader>

          {/* Contenido Dinámico según pestaña */}
          <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'monetary' ? (
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

              {/* Desglose de 2 Columnas: Ingresos vs Egresos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Columna Ingresos */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Rubros de Ingreso
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Sueldo Base</span>
                      <span className="font-mono font-medium">${item.baseSalary.toFixed(2)}</span>
                    </div>
                    {item.bonuses > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Bonificaciones</span>
                        <span className="font-mono font-medium">${item.bonuses.toFixed(2)}</span>
                      </div>
                    )}
                    {item.overtimeAmount > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Horas Extras Aprobadas</span>
                        <span className="font-mono font-medium">${item.overtimeAmount.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Rubros de Ley Mensualizados en Ecuador — no aplican al
                        Gerente Propietario autoafiliado (sin relación de
                        dependencia, no le corresponden por Código del Trabajo) */}
                    {item.isOwnerManager ? (
                      <div className="py-1.5 px-1.5 text-[11px] text-muted-foreground italic">
                        No aplica Décimos ni Fondos de Reserva: autoafiliación IESS sin relación de dependencia.
                      </div>
                    ) : (
                      !item.accumulateDecimals && (
                        <>
                          {item.decimoTercero > 0 && (
                            <div className="flex justify-between items-center py-1 border-b border-border/40 bg-emerald-500/5 px-1.5 rounded">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">13er Sueldo (Mensualizado)</span>
                              <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">+${item.decimoTercero.toFixed(2)}</span>
                            </div>
                          )}
                          {item.decimoCuarto > 0 && (
                            <div className="flex justify-between items-center py-1 border-b border-border/40 bg-emerald-500/5 px-1.5 rounded">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">14to Sueldo (Mensualizado)</span>
                              <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">+${item.decimoCuarto.toFixed(2)}</span>
                            </div>
                          )}
                          {item.fondosReserva > 0 && (
                            <div className="flex justify-between items-center py-1 border-b border-border/40 bg-emerald-500/5 px-1.5 rounded">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Fondos de Reserva (8.33%)</span>
                              <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">+${item.fondosReserva.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )
                    )}

                    {item.details.salaryItems
                      .filter((s) => s.type !== 'Sueldo')
                      .map((sal, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">{sal.name}</span>
                          <span className="font-mono font-medium">${sal.amount.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Columna Deducciones y Descuentos */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                    Descuentos del Período
                  </h4>
                  <div className="space-y-2 text-xs">
                    {item.iessPersonal > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">
                          {item.isOwnerManager
                            ? `Aporte IESS Autoafiliación (${((item.iessRate ?? 0.0945) * 100).toFixed(2)}%)`
                            : `Aporte Personal IESS (${((item.iessRate ?? 0.0945) * 100).toFixed(2)}%)`}
                        </span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.iessPersonal.toFixed(2)}</span>
                      </div>
                    )}
                    {item.cashShortages > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Faltante de Caja</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.cashShortages.toFixed(2)}</span>
                      </div>
                    )}
                    {item.inventoryDeductions > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Inventario / Mermas</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.inventoryDeductions.toFixed(2)}</span>
                      </div>
                    )}
                    {item.fines > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Multas</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.fines.toFixed(2)}</span>
                      </div>
                    )}
                    {item.loans > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Préstamos / Anticipos</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.loans.toFixed(2)}</span>
                      </div>
                    )}
                    {item.mealDeductions > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Alimentación</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.mealDeductions.toFixed(2)}</span>
                      </div>
                    )}
                    {item.otherDeductions > 0 && (
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Otras Deducciones</span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">-${item.otherDeductions.toFixed(2)}</span>
                      </div>
                    )}
                    {item.details.deductionItems.length === 0 && item.iessPersonal === 0 && (
                      <p className="text-xs text-muted-foreground italic py-2">
                        Sin deducciones registradas en este período.
                      </p>
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
          ) : (
            /* Pestaña: Lista de Documentaciones y Acciones */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground font-mono">
                  <span>Total: <strong className="text-foreground">{actions.length}</strong></span>
                  <span>•</span>
                  <span>Aprobados: <strong className="text-emerald-600 dark:text-emerald-400">{approvedCount}</strong></span>
                  <span>•</span>
                  <span>Pendientes: <strong className="text-orange-600 dark:text-orange-400">{pendingCount}</strong></span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Expediente digital
                </span>
              </div>

              {actions.length > 0 ? (
                <div className="rounded-xl border bg-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                  {actions.map((act) => {
                    const isApproved = act.status === 'aprobado'
                    const isPending = act.status === 'pendiente'
                    const isRejected = act.status === 'rechazado' || act.status === 'anulado'

                    return (
                      <div key={act.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start justify-between gap-4 text-xs">
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
                              {act.amount && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">${Number(act.amount).toFixed(2)}</span>
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

                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] h-5 px-2 capitalize shrink-0 font-medium border',
                            isApproved && 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
                            isPending && 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50',
                            isRejected && 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                          )}
                        >
                          {act.status}
                        </Badge>
                      </div>
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
                    El empleado no tiene solicitudes de turno, anticipos o sanciones registradas en estas fechas.
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
    </Sheet>
  )
}
