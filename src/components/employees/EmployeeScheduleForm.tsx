'use client'

import React from 'react'
import { DayOfWeek, EmployeeSchedule } from '@/types/employee'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'
import { Clock, Copy, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DAYS_LIST: { day: DayOfWeek; order: number; defaultWorkday: boolean; short: string }[] = [
  { day: 'Lunes', order: 1, defaultWorkday: true, short: 'Lun' },
  { day: 'Martes', order: 2, defaultWorkday: true, short: 'Mar' },
  { day: 'Miércoles', order: 3, defaultWorkday: true, short: 'Mié' },
  { day: 'Jueves', order: 4, defaultWorkday: true, short: 'Jue' },
  { day: 'Viernes', order: 5, defaultWorkday: true, short: 'Vie' },
  { day: 'Sábado', order: 6, defaultWorkday: false, short: 'Sáb' },
  { day: 'Domingo', order: 7, defaultWorkday: false, short: 'Dom' },
]

export interface ScheduleDayItem {
  id?: string
  day_of_week: DayOfWeek
  day_order: number
  is_workday: boolean
  has_split_shift: boolean
  start_time_1: string
  end_time_1: string
  start_time_2: string
  end_time_2: string
}

interface EmployeeScheduleFormProps {
  schedules: ScheduleDayItem[]
  onChange: (schedules: ScheduleDayItem[]) => void
  readOnly?: boolean
}

export function getDefaultSchedules(existing?: EmployeeSchedule[]): ScheduleDayItem[] {
  if (existing && existing.length > 0) {
    return DAYS_LIST.map(({ day, order, defaultWorkday }) => {
      const found = existing.find((s) => s.day_of_week === day)
      if (found) {
        return {
          id: found.id,
          day_of_week: found.day_of_week,
          day_order: found.day_order,
          is_workday: found.is_workday,
          has_split_shift: found.has_split_shift,
          start_time_1: found.start_time_1 || '08:00',
          end_time_1: found.end_time_1 || '13:00',
          start_time_2: found.start_time_2 || '14:00',
          end_time_2: found.end_time_2 || '18:00',
        }
      }
      return {
        day_of_week: day,
        day_order: order,
        is_workday: defaultWorkday,
        has_split_shift: false,
        start_time_1: '08:00',
        end_time_1: '17:00',
        start_time_2: '14:00',
        end_time_2: '18:00',
      }
    })
  }

  return DAYS_LIST.map(({ day, order, defaultWorkday }) => ({
    day_of_week: day,
    day_order: order,
    is_workday: defaultWorkday,
    has_split_shift: false,
    start_time_1: '08:00',
    end_time_1: '17:00',
    start_time_2: '14:00',
    end_time_2: '18:00',
  }))
}

export function EmployeeScheduleForm({
  schedules,
  onChange,
  readOnly = false,
}: EmployeeScheduleFormProps) {
  function updateDay<K extends keyof ScheduleDayItem>(
    index: number,
    field: K,
    value: ScheduleDayItem[K]
  ) {
    if (readOnly) return
    const next = [...schedules]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  function applyPresetStandard() {
    if (readOnly) return
    const next = schedules.map((item) => ({
      ...item,
      is_workday: item.day_order <= 5,
      has_split_shift: false,
      start_time_1: '08:00',
      end_time_1: '17:00',
    }))
    onChange(next)
  }

  function applyPresetSplit() {
    if (readOnly) return
    const next = schedules.map((item) => ({
      ...item,
      is_workday: item.day_order <= 5,
      has_split_shift: item.day_order <= 5,
      start_time_1: '08:00',
      end_time_1: '13:00',
      start_time_2: '14:00',
      end_time_2: '18:00',
    }))
    onChange(next)
  }

  function copyScheduleToWeekdays(sourceIndex: number) {
    if (readOnly) return
    const source = schedules[sourceIndex]
    const next = schedules.map((item, idx) => {
      if (idx === sourceIndex || item.day_order > 5) return item
      return {
        ...item,
        is_workday: source.is_workday,
        has_split_shift: source.has_split_shift,
        start_time_1: source.start_time_1,
        end_time_1: source.end_time_1,
        start_time_2: source.start_time_2,
        end_time_2: source.end_time_2,
      }
    })
    onChange(next)
  }

  function calculateDailyHours(item: ScheduleDayItem): number {
    if (!item.is_workday) return 0
    let mins = 0
    if (item.start_time_1 && item.end_time_1) {
      const [h1, m1] = item.start_time_1.split(':').map(Number)
      const [h2, m2] = item.end_time_1.split(':').map(Number)
      const diff = h2 * 60 + m2 - (h1 * 60 + m1)
      if (diff > 0) mins += diff
    }
    if (item.has_split_shift && item.start_time_2 && item.end_time_2) {
      const [h1, m1] = item.start_time_2.split(':').map(Number)
      const [h2, m2] = item.end_time_2.split(':').map(Number)
      const diff = h2 * 60 + m2 - (h1 * 60 + m1)
      if (diff > 0) mins += diff
    }
    return mins / 60
  }

  function calculateTotalWeeklyHours(): string {
    const total = schedules.reduce((acc, item) => acc + calculateDailyHours(item), 0)
    return total.toFixed(1)
  }

  const workdaysCount = schedules.filter((s) => s.is_workday).length

  return (
    <div className="w-full space-y-3">
      {/* Barra compacta de controles y resumen */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {workdaysCount} días / sem
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs font-semibold">
            <Clock className="h-3 w-3 mr-1" />
            {calculateTotalWeeklyHours()} hrs totales
          </Badge>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyPresetStandard}
              className="h-7 text-xs px-2.5"
            >
              8:00 a 17:00 (L-V)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyPresetSplit}
              className="h-7 text-xs px-2.5"
            >
              Doble Jornada (L-V)
            </Button>
          </div>
        )}
      </div>

      {/* Tabla limpia y minimalista */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="w-[140px] font-semibold">Día</TableHead>
              <TableHead className="w-[100px] font-semibold">Estado</TableHead>
              <TableHead className="font-semibold">Jornada 1 (Mañana / Continua)</TableHead>
              <TableHead className="font-semibold">Jornada 2 (Tarde)</TableHead>
              <TableHead className="w-[90px] text-right font-semibold">Horas</TableHead>
              {!readOnly && <TableHead className="w-[70px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((item, idx) => {
              const dailyHours = calculateDailyHours(item)
              const isMonday = idx === 0

              return (
                <TableRow
                  key={item.day_of_week}
                  className={cn(
                    "text-xs transition-colors",
                    !item.is_workday && "bg-muted/15 opacity-60"
                  )}
                >
                  {/* Día y Checkbox */}
                  <TableCell className="font-medium py-2">
                    <label className={cn("flex items-center gap-2", readOnly ? "cursor-default" : "cursor-pointer")}>
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={item.is_workday}
                        onChange={(e) => updateDay(idx, 'is_workday', e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring cursor-pointer disabled:cursor-default"
                      />
                      <span className={cn(item.is_workday ? "text-foreground font-semibold" : "text-muted-foreground line-through")}>
                        {item.day_of_week}
                      </span>
                    </label>
                  </TableCell>

                  {/* Estado Badge */}
                  <TableCell className="py-2">
                    <Badge
                      variant={item.is_workday ? "secondary" : "outline"}
                      className="text-[10px] h-4 px-1.5"
                    >
                      {item.is_workday ? 'Laborable' : 'Libre'}
                    </Badge>
                  </TableCell>

                  {/* Turno 1 */}
                  <TableCell className="py-2">
                    {item.is_workday ? (
                      <div className="flex items-center gap-1.5">
                        <TimePicker
                          value={item.start_time_1}
                          onChange={(val) => updateDay(idx, 'start_time_1', val)}
                          readOnly={readOnly}
                          disabled={readOnly}
                          className="h-7 w-22 text-xs"
                        />
                        <span className="text-muted-foreground text-xs font-medium">a</span>
                        <TimePicker
                          value={item.end_time_1}
                          onChange={(val) => updateDay(idx, 'end_time_1', val)}
                          readOnly={readOnly}
                          disabled={readOnly}
                          className="h-7 w-22 text-xs"
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">—</span>
                    )}
                  </TableCell>

                  {/* Turno 2 (Doble Jornada) */}
                  <TableCell className="py-2">
                    {item.is_workday ? (
                      item.has_split_shift ? (
                        <div className="flex items-center gap-1.5">
                          <TimePicker
                            value={item.start_time_2}
                            onChange={(val) => updateDay(idx, 'start_time_2', val)}
                            readOnly={readOnly}
                            disabled={readOnly}
                            className="h-7 w-22 text-xs"
                          />
                          <span className="text-muted-foreground text-xs font-medium">a</span>
                          <TimePicker
                            value={item.end_time_2}
                            onChange={(val) => updateDay(idx, 'end_time_2', val)}
                            readOnly={readOnly}
                            disabled={readOnly}
                            className="h-7 w-22 text-xs"
                          />
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => updateDay(idx, 'has_split_shift', false)}
                              className="text-[10px] text-muted-foreground hover:text-destructive ml-1 underline cursor-pointer"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      ) : (
                        !readOnly ? (
                          <button
                            type="button"
                            onClick={() => updateDay(idx, 'has_split_shift', true)}
                            className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                          >
                            + Añadir turno tarde
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Continuo</span>
                        )
                      )
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">—</span>
                    )}
                  </TableCell>

                  {/* Total Horas del Día */}
                  <TableCell className="text-right font-mono text-xs py-2">
                    {item.is_workday && dailyHours > 0 ? (
                      <span className="font-semibold text-foreground">{dailyHours}h</span>
                    ) : (
                      <span className="text-muted-foreground">0h</span>
                    )}
                  </TableCell>

                  {/* Botón Copiar a L-V solo en Lunes */}
                  {!readOnly && (
                    <TableCell className="py-2 text-right">
                      {isMonday && item.is_workday && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyScheduleToWeekdays(idx)}
                          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          title="Copiar a Martes-Viernes"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar L-V
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
