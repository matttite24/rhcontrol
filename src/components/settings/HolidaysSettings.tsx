'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Holiday } from '@/types/employee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Loader2, CalendarHeart, Sparkles, Check } from 'lucide-react'

interface HolidaysSettingsProps {
  currentOrgId: string
  holidays: Holiday[]
}

// Feriados fijos oficiales de Ecuador (misma fecha calendario todos los años),
// según el Código del Trabajo. Los de fecha móvil (Carnaval, Viernes Santo)
// se excluyen a propósito: no tienen un mes/día fijo que sugerir aquí.
const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: 'Año Nuevo' },
  { month: 5, day: 1, name: 'Día del Trabajo' },
  { month: 5, day: 24, name: 'Batalla de Pichincha' },
  { month: 8, day: 10, name: 'Primer Grito de Independencia' },
  { month: 10, day: 9, name: 'Independencia de Guayaquil' },
  { month: 11, day: 2, name: 'Día de los Difuntos' },
  { month: 11, day: 3, name: 'Independencia de Cuenca' },
  { month: 12, day: 25, name: 'Navidad' },
]

function formatLongDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  return `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`
}

export function HolidaysSettings({ currentOrgId, holidays: initialHolidays }: HolidaysSettingsProps) {
  const router = useRouter()
  const supabase = createClient()

  const [holidays, setHolidays] = useState<Holiday[]>(
    [...initialHolidays].sort((a, b) => a.date.localeCompare(b.date))
  )

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Feriados fijos recomendados: se sugieren para el año en curso y el
  // siguiente (útil hacia fin de año, cuando ya conviene precargar el
  // próximo). Se marca como "ya registrado" si existe cualquier feriado con
  // esa misma fecha (mes/día), sin importar el año.
  const currentYear = new Date().getFullYear()
  const [quickAddingKey, setQuickAddingKey] = useState<string | null>(null)

  const registeredMonthDay = new Set(
    holidays.map((h) => h.date.slice(5)) // "MM-DD"
  )

  const suggestedHolidays = [currentYear, currentYear + 1].flatMap((year) =>
    FIXED_HOLIDAYS.map((h) => {
      const monthDay = `${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`
      const isoDate = `${year}-${monthDay}`
      return {
        key: isoDate,
        year,
        isoDate,
        name: h.name,
        alreadyRegistered: registeredMonthDay.has(monthDay) && holidays.some((existing) => existing.date === isoDate),
      }
    })
  )

  async function handleQuickAdd(suggestion: { key: string; isoDate: string; name: string }) {
    setQuickAddingKey(suggestion.key)
    setError(null)

    const { data, error } = await supabase
      .from('holidays')
      .insert({
        organization_id: currentOrgId,
        date: suggestion.isoDate,
        name: suggestion.name,
      })
      .select()
      .single()

    if (error) {
      setError(
        error.code === '23505'
          ? 'Ya existe un feriado registrado para esta fecha.'
          : error.message
      )
      setQuickAddingKey(null)
      return
    }

    setHolidays((prev) => [...prev, data as Holiday].sort((a, b) => a.date.localeCompare(b.date)))
    setQuickAddingKey(null)
    router.refresh()
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !date) return
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('holidays')
      .insert({
        organization_id: currentOrgId,
        date,
        name: name.trim(),
      })
      .select()
      .single()

    if (error) {
      setError(
        error.code === '23505'
          ? 'Ya existe un feriado registrado para esta fecha.'
          : error.message
      )
      setLoading(false)
      return
    }

    setHolidays((prev) => [...prev, data as Holiday].sort((a, b) => a.date.localeCompare(b.date)))
    setName('')
    setDate('')
    setLoading(false)
    router.refresh()
  }

  async function handleDeleteHoliday(id: string) {
    if (!confirm('¿Estás seguro de eliminar este feriado?')) return
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id)
      .eq('organization_id', currentOrgId)

    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    setHolidays((prev) => prev.filter((h) => h.id !== id))
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
      {/* Formulario Nuevo Feriado */}
      <div className="space-y-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarHeart className="h-4 w-4 text-primary" />
              Nuevo Feriado
            </CardTitle>
            <CardDescription>
              Registra los feriados nacionales o locales para que se marquen en el calendario de turnos y se sugiera automáticamente el recargo de horas extraordinarias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddHoliday} className="space-y-4">
              {error && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="holiday_date">Fecha *</Label>
                <DatePicker
                  id="holiday_date"
                  name="holiday_date"
                  value={date}
                  onChange={(val) => setDate(val)}
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holiday_name">Nombre del Feriado *</Label>
                <Input
                  id="holiday_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Día de Año Nuevo, Independencia de Cuenca"
                  required
                />
              </div>
              <Button type="submit" disabled={loading || !name.trim() || !date} size="sm">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Agregar Feriado
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Feriados fijos recomendados — un clic para añadir cada uno */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Feriados Fijos Recomendados
            </CardTitle>
            <CardDescription>
              Feriados nacionales de fecha fija en Ecuador para {currentYear} y {currentYear + 1}.
              No incluye los de fecha móvil (Carnaval, Viernes Santo): agrégalos manualmente arriba.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {suggestedHolidays.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{formatLongDate(s.isoDate)}</p>
                </div>
                {s.alreadyRegistered ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0 pr-1">
                    <Check className="h-3.5 w-3.5" />
                    Añadido
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAdd(s)}
                    disabled={quickAddingKey === s.key}
                    className="h-7 px-2.5 text-xs shrink-0"
                  >
                    {quickAddingKey === s.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Añadir
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Listado de Feriados */}
      <div className="space-y-6">
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Feriados Registrados</CardTitle>
              <span className="text-xs text-muted-foreground font-medium">
                {holidays.length} registros
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {holidays.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Aún no hay feriados registrados para esta empresa.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Fecha</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-[80px] text-right pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="pl-6 font-medium text-foreground whitespace-nowrap">
                        {formatLongDate(holiday.date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {holiday.name}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          title="Eliminar feriado"
                          aria-label="Eliminar feriado"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
