'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Employee, Incident } from '@/types/employee'
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  PackageCheck,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Calendar,
  FileText,
  Plus,
  Trash2,
  AlertTriangle,
  Scale,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  DELIVERY_ASSET_CATEGORIES,
  DeliveryAssetCategory,
  DeliveryAssetItem,
  LEGAL_DISCOUNT_DISCLAIMER_ECUADOR,
} from '@/lib/incidents/constants'
import { printDeliveryActDocument } from '@/lib/incidents/print-delivery-act'
import { createDeliveryActIncidentAction } from '@/lib/incidents/actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface DeliveryActWizardModalProps {
  organizationId: string
  organizationName?: string
  employees: Employee[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
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

export function DeliveryActWizardModal({
  organizationId,
  organizationName = 'RH Garden',
  employees,
  open,
  onOpenChange,
  onSuccess,
}: DeliveryActWizardModalProps) {
  const router = useRouter()
  const supabase = createClient()

  // Organización activa
  const [organization, setOrganization] = useState<any>(null)

  useEffect(() => {
    const targetOrgId = organizationId || employees[0]?.organization_id
    if (!targetOrgId) return

    async function loadOrg() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', targetOrgId)
        .single()

      if (data) setOrganization(data)
    }
    loadOrg()
  }, [organizationId, employees, supabase])

  // Estado del Wizard: Pasos 1, 2, 3
  // 1: Selección de empleado y fecha
  // 2: Detalle de ítems (bienes, cantidad, valor unitario) y cláusula de descuento
  // 3: Resumen y confirmación
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Paso 1: Selección de Empleado y Fecha
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0])
  const [deliveredByName, setDeliveredByName] = useState('Talento Humano / Bodega')
  const [deliveredByPosition, setDeliveredByPosition] = useState('Administración de Activos')

  // Paso 2: Ítems del Acta
  const [items, setItems] = useState<DeliveryAssetItem[]>([
    {
      id: 'item-1',
      category: 'uniformes',
      quantity: 1,
      description: 'Camiseta institucional tipo polo',
      unitValue: 15.0,
      totalValue: 15.0,
      condition: 'nuevo',
      serialOrCode: '',
    },
  ])

  // Formulario rápido para agregar ítem
  const [newCat, setNewCat] = useState('uniformes')
  const [newDesc, setNewDesc] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [newUnitVal, setNewUnitVal] = useState('')
  const [newCondition, setNewCondition] = useState<'nuevo' | 'bueno' | 'regular'>('nuevo')
  const [newSerial, setNewSerial] = useState('')

  // Aceptación de cláusula de descuento
  const [discountAgreementAccepted, setDiscountAgreementAccepted] = useState(true)
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(false)
  const [notes, setNotes] = useState('')

  // Estado de envío / guardado
  const [submitting, setSubmitting] = useState(false)
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null)

  // Reset al cerrar o reabrir
  useEffect(() => {
    if (!open) {
      setCurrentStep(1)
      setSelectedEmployee(null)
      setEmployeeSearch('')
      setDeliveryDate(new Date().toISOString().split('T')[0])
      setItems([
        {
          id: `item-${Date.now()}`,
          category: 'uniformes',
          quantity: 1,
          description: 'Camiseta institucional tipo polo',
          unitValue: 15.0,
          totalValue: 15.0,
          condition: 'nuevo',
          serialOrCode: '',
        },
      ])
      setDiscountAgreementAccepted(true)
      setIsDisclaimerExpanded(false)
      setNotes('')
      setCreatedIncident(null)
    }
  }, [open])

  // Filtrado de empleados
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees
    const term = employeeSearch.toLowerCase()
    return employees.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(term) ||
        e.national_id?.toLowerCase().includes(term) ||
        e.department?.toLowerCase().includes(term) ||
        e.position?.toLowerCase().includes(term)
    )
  }, [employees, employeeSearch])

  // Cálculo de totales
  const totalAmount = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.totalValue) || 0), 0)
  }, [items])

  const totalItemsCount = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0)
  }, [items])

  function handleAddItem() {
    if (!newDesc.trim()) {
      toast.error('Ingresa la descripción o detalle del activo a entregar.')
      return
    }

    const qty = Math.max(1, parseInt(newQty, 10) || 1)
    const unitVal = Math.max(0, parseFloat(newUnitVal) || 0)
    const totVal = parseFloat((qty * unitVal).toFixed(2))

    const newItem: DeliveryAssetItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category: newCat,
      quantity: qty,
      description: newDesc.trim(),
      unitValue: unitVal,
      totalValue: totVal,
      condition: newCondition,
      serialOrCode: newSerial.trim() || undefined,
    }

    setItems((prev) => [...prev, newItem])
    setNewDesc('')
    setNewQty('1')
    setNewUnitVal('')
    setNewSerial('')
  }

  function handleRemoveItem(id: string) {
    if (items.length <= 1) {
      toast.error('El acta debe contener al menos un bien o prenda.')
      return
    }
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function handleUpdateItemQty(id: string, qtyStr: string) {
    const qty = Math.max(1, parseInt(qtyStr, 10) || 1)
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const total = parseFloat((qty * it.unitValue).toFixed(2))
        return { ...it, quantity: qty, totalValue: total }
      })
    )
  }

  function handleUpdateItemUnitVal(id: string, valStr: string) {
    const unitVal = Math.max(0, parseFloat(valStr) || 0)
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const total = parseFloat((it.quantity * unitVal).toFixed(2))
        return { ...it, unitValue: unitVal, totalValue: total }
      })
    )
  }

  async function handleSubmit() {
    if (!selectedEmployee) {
      toast.error('Selecciona un empleado.')
      return
    }
    if (items.length === 0) {
      toast.error('Agrega al menos un ítem al acta.')
      return
    }
    if (!discountAgreementAccepted) {
      toast.error('Debes confirmar la cláusula de responsabilidad y descuento según el Código del Trabajo.')
      return
    }

    setSubmitting(true)

    try {
      const res = await createDeliveryActIncidentAction({
        organizationId: selectedEmployee.organization_id || organizationId,
        employeeId: selectedEmployee.id,
        deliveryDate,
        notes,
        items,
        discountAgreementAccepted,
        discountDisclaimerText: LEGAL_DISCOUNT_DISCLAIMER_ECUADOR,
        deliveredByName,
        deliveredByPosition,
      })

      if (!res.success || !res.data) {
        toast.error(res.error || 'Error al generar el acta de entrega.')
        setSubmitting(false)
        return
      }

      setCreatedIncident(res.data)
      toast.success('Acta de entrega-recepción registrada con éxito.')
      onSuccess?.()
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || 'Error inesperado al guardar el acta.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrint(inc?: Incident | null) {
    const targetIncident = inc || createdIncident
    if (!selectedEmployee) return

    const docCode =
      targetIncident?.metadata?.document_code ||
      (targetIncident?.title?.match(/\[([A-Z]{3}-\d+)\]/)?.[1] ?? 'ACT-0001')

    printDeliveryActDocument({
      organization: organization || { name: organizationName },
      organizationName: organization?.name || organizationName,
      employeeName: selectedEmployee.full_name,
      nationalId: selectedEmployee.national_id || '',
      department: selectedEmployee.department || '—',
      position: selectedEmployee.position || '—',
      deliveryDate,
      items,
      totalAmount,
      totalItemsCount,
      notes,
      discountAgreementAccepted,
      discountDisclaimerText: LEGAL_DISCOUNT_DISCLAIMER_ECUADOR,
      deliveredByName,
      deliveredByPosition,
      status: targetIncident?.status || 'registrado',
      documentCode: docCode,
    })
  }

  return (
    <>
      {/* El <DialogContent> único vive en el launcher. Ver OvertimeWizardModal (Turnos). */}
        {/* Cabecera del Asistente */}
        <DialogHeader className="p-6 pb-4 border-b bg-indigo-500/10 border-indigo-500/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-background border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Acta de Entrega - Recepción de Bienes y Activos
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Asignación formal de uniformes, herramientas, equipos e inventario con cláusula de descuento
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Cuerpo del Asistente */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {createdIncident ? (
            /* PANTALLA FINAL: ÉXITO Y BOTÓN DE IMPRIMIR */
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  ¡Acta de Entrega Registrada Exitosamente!
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  El acta se encuentra archivada con numeración secuencial formal y lista para la firma y constancia del empleado.
                </p>
                <div className="pt-2">
                  <span className="font-mono text-xs font-bold px-3 py-1 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                    {createdIncident.metadata?.document_code || 'ACT-0001'}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => handlePrint(createdIncident)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-medium"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Acta para Firma
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="text-xs"
                >
                  Cerrar Asistente
                </Button>
              </div>
            </div>
          ) : currentStep === 1 ? (
            /* PASO 1: SELECCIONAR EMPLEADO Y FECHA */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">1. Seleccionar Empleado Receptor *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar por nombre, cédula, cargo o departamento..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Lista de selección de empleados */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border/70 divide-y divide-border/40 bg-card">
                {filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No se encontraron empleados coincidentes.
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmployee?.id === emp.id
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedEmployee(emp)}
                        className={cn(
                          'w-full text-left p-2.5 flex items-center justify-between gap-3 transition-colors text-xs cursor-pointer',
                          isSelected ? 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-200' : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                            <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                            <AvatarFallback className="text-[10px] font-bold">
                              {getInitials(emp.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{emp.full_name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              C.I.: {emp.national_id || 'Sin cédula'} • {emp.department || 'Sin área'}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>

              {/* Fecha de Entrega y Responsable de Entrega */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Fecha de Entrega Material *</Label>
                  <DatePicker
                    name="delivery_date"
                    value={deliveryDate}
                    onChange={(val) => setDeliveryDate(val || new Date().toISOString().split('T')[0])}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Responsable de Entrega (Nombre/Cargo)</Label>
                  <Input
                    value={deliveredByName}
                    onChange={(e) => setDeliveredByName(e.target.value)}
                    placeholder="Ej. Talento Humano / Bodega"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          ) : currentStep === 2 ? (
            /* PASO 2: INVENTARIO DE BIENES Y CLÁUSULA DE DESCUENTO */
            <div className="space-y-5">
              {/* Formulario de agregar nuevo ítem */}
              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-indigo-600" />
                    Agregar Bien / Activo / Uniforme al Acta
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Inventario, herramientas o EPP
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Descripción / Nombre del Bien *</Label>
                    <Input
                      placeholder="Ej. Pantalón de trabajo industrial azul talla 32"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="h-8 text-xs bg-background"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddItem()
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Categoría</Label>
                    <select
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground cursor-pointer"
                    >
                      {DELIVERY_ASSET_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Cantidad *</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="h-8 text-xs bg-background font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Valor Unitario ($) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={newUnitVal}
                      onChange={(e) => setNewUnitVal(e.target.value)}
                      className="h-8 text-xs bg-background font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Estado</Label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value as any)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground cursor-pointer capitalize"
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="bueno">Buen estado</option>
                      <option value="regular">Regular</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Serie / Código (Opc.)</Label>
                    <Input
                      placeholder="Ej. SN-8821"
                      value={newSerial}
                      onChange={(e) => setNewSerial(e.target.value)}
                      className="h-8 text-xs bg-background font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleAddItem}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar Ítem a la Lista
                  </Button>
                </div>
              </div>

              {/* Tabla de ítems agregados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Bienes a Entregar ({totalItemsCount} unidades):
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    Valor Total: ${totalAmount.toFixed(2)}
                  </span>
                </div>

                <div className="border rounded-xl overflow-hidden bg-card text-xs">
                  <div className="grid grid-cols-12 bg-muted/50 p-2.5 font-semibold text-muted-foreground text-[11px] border-b">
                    <div className="col-span-5">Descripción / Detalle</div>
                    <div className="col-span-2 text-center">Cant.</div>
                    <div className="col-span-2 text-right">V. Unit ($)</div>
                    <div className="col-span-2 text-right">V. Total ($)</div>
                    <div className="col-span-1 text-center"></div>
                  </div>

                  <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                    {items.map((it) => (
                      <div key={it.id} className="grid grid-cols-12 p-2.5 items-center gap-1 hover:bg-muted/20">
                        <div className="col-span-5 min-w-0 pr-2">
                          <p className="font-semibold text-foreground truncate">{it.description}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {it.category} • {it.condition} {it.serialOrCode ? `• Cód: ${it.serialOrCode}` : ''}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleUpdateItemQty(it.id, e.target.value)}
                            className="h-7 text-xs text-center font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.unitValue}
                            onChange={(e) => handleUpdateItemUnitVal(it.id, e.target.value)}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </div>
                        <div className="col-span-2 text-right font-mono font-bold text-foreground pr-1">
                          ${it.totalValue.toFixed(2)}
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                            title="Eliminar ítem"
                            aria-label="Eliminar ítem"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cláusula Legal de Descuento por Pérdida o Daño (Cuadro Expandible) */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Scale className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">
                      Autorización de Descuento por Pérdida o Daño (Código del Trabajo)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDisclaimerExpanded((prev) => !prev)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium flex items-center gap-1 shrink-0 px-2 py-0.5 rounded hover:bg-indigo-500/10 cursor-pointer transition-colors"
                  >
                    <span>{isDisclaimerExpanded ? 'Ocultar texto' : 'Ver cláusula'}</span>
                    {isDisclaimerExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>

                {isDisclaimerExpanded && (
                  <div className="pt-2 border-t border-indigo-500/20 text-[11px] text-muted-foreground leading-relaxed text-justify bg-background/50 p-2.5 rounded-lg">
                    {LEGAL_DISCOUNT_DISCLAIMER_ECUADOR}
                  </div>
                )}

                <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={discountAgreementAccepted}
                    onChange={(e) => setDiscountAgreementAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>
                    Incluir formalmente cláusula de descuento en el acta impresa para firma.
                  </span>
                </label>
              </div>

              {/* Observaciones generales opcionales */}
              <div className="space-y-1">
                <Label className="text-xs">Observaciones o Condiciones Especiales (Opcional)</Label>
                <Input
                  placeholder="Ej. Entrega con motivo de ingreso a planta / renovación anual de uniforme..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ) : (
            /* PASO 3: RESUMEN Y CONFIRMACIÓN PREVIA */
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-card shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-10 w-10 ring-1 ring-border shrink-0">
                      <AvatarImage src={selectedEmployee?.avatar_url ?? undefined} alt={selectedEmployee?.full_name} />
                      <AvatarFallback className="text-xs font-bold">
                        {getInitials(selectedEmployee?.full_name || 'E')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-foreground">{selectedEmployee?.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        C.I.: {selectedEmployee?.national_id || '—'} • {selectedEmployee?.department || '—'}
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                    Acta Entrega
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Fecha de Entrega:</span>
                    <span className="font-semibold text-foreground font-mono">{deliveryDate}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Responsable de Entrega:</span>
                    <span className="font-semibold text-foreground">{deliveredByName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Total Bienes / Prendas:</span>
                    <span className="font-bold text-foreground font-mono">{totalItemsCount} unidades ({items.length} ítems)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Valor Total Custodiado:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-sm">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Resumen de ítems */}
                <div className="border-t pt-2 space-y-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground block uppercase tracking-wider">
                    Detalle de Implementos Asignados:
                  </span>
                  <div className="divide-y rounded-lg border bg-muted/20 text-xs">
                    {items.map((it, idx) => (
                      <div key={it.id} className="p-2 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-foreground">{idx + 1}. {it.description}</span>
                          <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                            (Cant: {it.quantity} • {it.condition})
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-foreground">
                          ${it.totalValue.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cláusula confirmada */}
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Cláusula de descuento de ley debidamente vinculada al documento para firma.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con controles */}
        {!createdIncident && (
          <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between sm:justify-between w-full">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancelar
              </Button>

              {currentStep < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (currentStep === 1) {
                      if (!selectedEmployee) {
                        toast.error('Selecciona un empleado para continuar.')
                        return
                      }
                      setCurrentStep(2)
                    } else if (currentStep === 2) {
                      if (items.length === 0) {
                        toast.error('Agrega al menos un ítem al acta.')
                        return
                      }
                      if (!discountAgreementAccepted) {
                        toast.error('Confirma la cláusula de descuento de ley.')
                        return
                      }
                      setCurrentStep(3)
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs font-medium"
                >
                  Continuar
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs font-medium"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generando Acta...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Guardar y Emitir
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
    </>
  )
}
