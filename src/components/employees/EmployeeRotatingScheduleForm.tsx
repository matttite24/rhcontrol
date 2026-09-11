'use client'

import React, { useState } from 'react'
import { RotatingShiftPattern } from '@/types/employee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { RefreshCw, Plus, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertRotatingPatternAction, deleteRotatingPatternAction } from '@/lib/shifts/rotating-pattern-actions'

const DAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export interface RotatingScheduleValue {
  patternId: string | null
  anchorDate: string
}

interface EmployeeRotatingScheduleFormProps {
  organizationId: string
  patterns: RotatingShiftPattern[]
  value: RotatingScheduleValue
  onChange: (value: RotatingScheduleValue) => void
  onPatternsChange: (patterns: RotatingShiftPattern[]) => void
  readOnly?: boolean
}

/**
 * Configura un horario rotativo por ciclo (ej. "4 libres + 10 trabajo"), a
 * diferencia del horario semanal fijo de EmployeeScheduleForm. El patrón es
 * una plantilla reutilizable (ver rotating_shift_patterns); lo que hace
 * único a cada empleado dentro del mismo patrón es su propia fecha ancla —
 * dos empleados en el mismo patrón con anclas desfasadas es lo que produce
 * la cobertura intercalada (ej. dos cocineros turnándose).
 */
export function EmployeeRotatingScheduleForm({
  organizationId,
  patterns,
  value,
  onChange,
  onPatternsChange,
  readOnly = false,
}: EmployeeRotatingScheduleFormProps) {
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCycleLength, setNewCycleLength] = useState(14)
  const [newDaysOff, setNewDaysOff] = useState<number[]>([0, 1, 2, 3])

  const selectedPattern = patterns.find((p) => p.id === value.patternId) || null

  function toggleDayOff(offset: number) {
    setNewDaysOff((prev) =>
      prev.includes(offset) ? prev.filter((d) => d !== offset) : [...prev, offset].sort((a, b) => a - b)
    )
  }

  async function handleCreatePattern() {
    if (saving) return
    setSaving(true)
    const result = await upsertRotatingPatternAction({
      organizationId,
      name: newName,
      cycleLength: newCycleLength,
      daysOff: newDaysOff,
    })
    setSaving(false)

    if (!result.success || !result.pattern) {
      toast.error('No se pudo crear el patrón', result.error || 'Ocurrió un error inesperado.')
      return
    }

    onPatternsChange([...patterns, result.pattern])
    onChange({ ...value, patternId: result.pattern.id })
    setCreating(false)
    setNewName('')
    toast.success('Patrón creado', `"${result.pattern.name}" ya está disponible para asignar.`)
  }

  async function handleDeletePattern(pattern: RotatingShiftPattern) {
    const result = await deleteRotatingPatternAction(pattern.id)
    if (!result.success) {
      toast.error('No se pudo eliminar', result.error || 'Puede estar asignado a otros empleados.')
      return
    }
    onPatternsChange(patterns.filter((p) => p.id !== pattern.id))
    if (value.patternId === pattern.id) {
      onChange({ ...value, patternId: null })
    }
    toast.success('Patrón eliminado')
  }

  return (
    <div className="w-full space-y-4">
      {/* Selección de patrón existente */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Patrón de Rotación</Label>
        <div className="flex flex-wrap gap-2">
          {patterns.map((pattern) => {
            const isSelected = value.patternId === pattern.id
            return (
              <div
                key={pattern.id}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
                  isSelected ? 'border-primary bg-primary/5' : 'border-input'
                )}
              >
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ ...value, patternId: pattern.id })}
                  className={cn('flex flex-col items-start gap-0.5 text-left', !readOnly && 'cursor-pointer')}
                >
                  <span className={cn('font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                    {pattern.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Ciclo de {pattern.cycle_length}d · {pattern.days_off.length} libres
                  </span>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeletePattern(pattern)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer shrink-0"
                    title="Eliminar patrón"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}

          {!readOnly && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo patrón
            </button>
          )}
        </div>
      </div>

      {/* Formulario de creación de patrón */}
      {creating && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Nombre del patrón</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Rotativo 4x10"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Duración del ciclo (días)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={newCycleLength}
                onChange={(e) => setNewCycleLength(Number(e.target.value) || 1)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px]">Días libres dentro del ciclo (posición desde el día ancla)</Label>
            <div className="flex flex-wrap gap-1">
              {(() => {
                // Set en vez de `.includes()` por iteración: evita un lookup
                // O(n) dentro de un .map() de hasta 90 elementos (O(n²) total).
                const daysOffSet = new Set(newDaysOff)
                return Array.from({ length: newCycleLength }).map((_, offset) => {
                const isOff = daysOffSet.has(offset)
                return (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => toggleDayOff(offset)}
                    className={cn(
                      'h-7 w-7 rounded-md border text-[10px] font-mono font-semibold transition-colors cursor-pointer',
                      isOff
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                    )}
                    title={`Día ${offset} del ciclo: ${isOff ? 'libre' : 'laborable'}`}
                  >
                    {offset}
                  </button>
                )
                })
              })()}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Verde = libre · Ámbar = laborable. El día 0 corresponde a la fecha ancla que se defina abajo.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleCreatePattern}
              disabled={saving || !newName.trim()}
              className="h-7 text-xs px-3"
            >
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Guardar Patrón
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setCreating(false)}
              className="h-7 text-xs px-3"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Fecha ancla y previsualización */}
      {selectedPattern && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">Fecha de Inicio del Ciclo (Día 0)</Label>
          <DatePicker
            name="rotating_anchor_date"
            value={value.anchorDate}
            disabled={readOnly}
            onChange={(dateString) => onChange({ ...value, anchorDate: dateString })}
            className="w-48"
          />
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" />
            El horario (horas de entrada/salida) de los días laborables del ciclo se toma del horario semanal
            configurado en la pestaña anterior — este patrón solo decide qué días son libres.
          </p>
        </div>
      )}
    </div>
  )
}
