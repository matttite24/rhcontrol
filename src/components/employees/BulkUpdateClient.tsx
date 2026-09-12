'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Employee, EmployeeSalary, Department, Position } from '@/types/employee'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { TrendingUp, CheckCircle2, Save, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

import { BulkSalaryModal } from './BulkSalaryModal'

interface BulkUpdateClientProps {
  organizationId: string
  organizationName: string
  initialEmployees: (Employee & { salaries?: EmployeeSalary[] })[]
  departments: Department[]
  positions: Position[]
  /** SubHeader de filtros (server-driven), para que quede justo debajo del PageHeader y no antes. */
  subHeader?: React.ReactNode
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

export function BulkUpdateClient({
  organizationId,
  initialEmployees,
  departments,
  positions,
  subHeader,
}: BulkUpdateClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [hasPreviewChanges, setHasPreviewChanges] = useState(false)

  // Estado de edición de salarios por empleado
  const [salaryMap, setSalaryMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    initialEmployees.forEach((emp) => {
      const base = emp.salaries?.find((s) => s.salary_type === 'Sueldo')?.amount || 460
      map[emp.id] = base
    })
    return map
  })

  // Empleados seleccionados para edición individual/manual
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialEmployees.map((e) => e.id))

  function handleApplyModalAdjustment(data: {
    type: 'percentage' | 'fixed'
    value: number
    targetEmployeeIds: string[]
  }) {
    setSalaryMap((prev) => {
      const next = { ...prev }
      data.targetEmployeeIds.forEach((id) => {
        const current = next[id] || 460
        if (data.type === 'percentage') {
          next[id] = Number((current * (1 + data.value / 100)).toFixed(2))
        } else {
          next[id] = Number((current + data.value).toFixed(2))
        }
      })
      return next
    })

    setHasPreviewChanges(true)
    toast.success(
      'Paso 2: Previsualización lista',
      `Se calcularon los nuevos sueldos para ${data.targetEmployeeIds.length} empleados. Revisa la tabla y haz clic en "Guardar Cambios".`
    )
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(initialEmployees.map((e) => e.id))
    } else {
      setSelectedIds([])
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  async function handleSaveAll() {
    setLoading(true)
    try {
      // Para cada empleado, actualizar o insertar su registro de 'Sueldo'
      const updates = initialEmployees.map(async (emp) => {
        const newAmount = salaryMap[emp.id]
        if (newAmount === undefined) return

        const existingSalary = emp.salaries?.find((s) => s.salary_type === 'Sueldo')
        if (existingSalary) {
          return supabase
            .from('employee_salaries')
            .update({ amount: newAmount })
            .eq('id', existingSalary.id)
        } else {
          return supabase.from('employee_salaries').insert({
            organization_id: organizationId,
            employee_id: emp.id,
            salary_type: 'Sueldo',
            name: 'Sueldo Base',
            amount: newAmount,
            affects_iess: true,
          })
        }
      })

      await Promise.all(updates)

      setHasPreviewChanges(false)
      toast.success(
        'Sueldos actualizados y guardados',
        'Se persistieron las nuevas remuneraciones en la base de datos exitosamente.'
      )
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error('Error al guardar', err?.message || 'Ocurrió un error guardando sueldos.')
    } finally {
      setLoading(false)
    }
  }

  const allSelected = initialEmployees.length > 0 && initialEmployees.every((e) => selectedIds.includes(e.id))

  return (
    <>
      <PageHeader
        title="Ajuste Masivo"
        description="Incrementos salariales generales para varios empleados a la vez"
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 cursor-pointer text-xs"
            >
              <TrendingUp className="h-4 w-4 text-primary" />
              Configurar Ajuste
            </Button>

            <Button
              onClick={handleSaveAll}
              disabled={loading}
              size="sm"
              className="gap-2 cursor-pointer text-xs"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
          </div>
        }
      />

      {subHeader}

      <BulkSalaryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        employees={initialEmployees}
        departments={departments}
        positions={positions}
        onApplyAdjustment={handleApplyModalAdjustment}
      />

      {/* Aviso de previsualización + masa salarial (los filtros viven en el SubHeader de la página) */}
      {hasPreviewChanges && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-primary font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              <strong>Paso 2 (Visualización):</strong> Se han previsualizado los nuevos valores en la tabla. Puedes editar manualmente cualquier celda antes de hacer clic en <strong>Guardar Cambios</strong>.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={loading}
            className="h-7 text-xs font-semibold shrink-0"
          >
            Guardar Cambios
          </Button>
        </div>
      )}

      {/* Tabla a Ancho Completo */}
      <div className="flex-1 w-full overflow-x-auto bg-card">
        {initialEmployees.length > 0 ? (
          <Table className="w-full">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[5%] pl-6">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                  />
                </TableHead>
                <TableHead className="w-[30%] font-semibold">Empleado</TableHead>
                <TableHead className="w-[20%] font-semibold">Cargo / Departamento</TableHead>
                <TableHead className="w-[15%] font-semibold">Sueldo Anterior</TableHead>
                <TableHead className="w-[20%] font-semibold">Nuevo Sueldo Base ($ USD)</TableHead>
                <TableHead className="w-[10%] pr-6 text-right font-semibold">Variación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialEmployees.map((emp) => {
                const originalBase = emp.salaries?.find((s) => s.salary_type === 'Sueldo')?.amount || 460
                const currentEdit = salaryMap[emp.id] ?? originalBase
                const diff = currentEdit - originalBase
                const isSelected = selectedIds.includes(emp.id)

                return (
                  <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors text-xs">
                    <TableCell className="pl-6 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(emp.id)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                      />
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                          <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                          <AvatarFallback className="text-[10px] font-semibold">
                            {getInitials(emp.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">
                            {emp.full_name}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {emp.national_id || '—'}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-muted-foreground">
                      <span className="font-medium text-foreground">{emp.position || '—'}</span>
                      <span className="block text-[11px] text-muted-foreground">{emp.department || 'General'}</span>
                    </TableCell>

                    <TableCell className="py-3 font-mono font-medium text-muted-foreground">
                      ${originalBase.toFixed(2)}
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={currentEdit}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0
                            setSalaryMap((prev) => ({ ...prev, [emp.id]: val }))
                          }}
                          className="h-8 text-xs font-mono pl-6 font-bold"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="pr-6 py-3 text-right font-mono">
                      {diff !== 0 ? (
                        <span className={cn("font-semibold", diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {diff > 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin cambio</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-16 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-base">No se encontraron empleados</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Prueba modificando o limpiando los filtros de búsqueda.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
