'use client'

import React from 'react'
import { Employee } from '@/types/employee'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sliders, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmployeeSettingsTabProps {
  employee?: Employee
  reserveFunds: string
  setReserveFunds: (val: string) => void
  readOnly?: boolean
}

export function EmployeeSettingsTab({
  employee,
  reserveFunds,
  setReserveFunds,
  readOnly = false,
}: EmployeeSettingsTabProps) {
  return (
    <div className="space-y-8 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Columna 1: Fondos de Reserva y Beneficios de Ley */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Fondos de Reserva y Beneficios
            </h3>
          </div>

          <div className="space-y-5">
            {/* Radio Group: Fondos de Reserva */}
            <div className="space-y-2.5">
              <Label className="text-xs font-medium text-foreground">Tratamiento de Fondos de Reserva:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                {[
                  { value: 'pagar_ano', label: 'Pagar desde el Año' },
                  { value: 'pagar_ingreso', label: 'Pagar desde el Ingreso' },
                  { value: 'acumular_ano', label: 'Acumular desde el Año' },
                  { value: 'acumular_ingreso', label: 'Acumular desde el Ingreso' },
                ].map((item) => (
                  <label key={item.value} className={cn("flex items-center gap-2 text-xs text-foreground select-none", readOnly ? "cursor-default" : "cursor-pointer")}>
                    <input
                      type="radio"
                      name="reserve_funds"
                      disabled={readOnly}
                      value={item.value}
                      checked={reserveFunds === item.value}
                      onChange={() => setReserveFunds(item.value)}
                      className="h-3.5 w-3.5 text-primary border-input focus:ring-ring"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Checkboxes de beneficios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <label className={cn("flex items-center gap-2 text-xs text-foreground select-none", readOnly ? "cursor-default" : "cursor-pointer")}>
                <input
                  name="accumulate_decimals"
                  type="checkbox"
                  disabled={readOnly}
                  defaultChecked={employee?.accumulate_decimals ?? false}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                <span className="font-medium">Acumular Décimos (13° / 14°)</span>
              </label>

              <label className={cn("flex items-center gap-2 text-xs text-foreground select-none", readOnly ? "cursor-default" : "cursor-pointer")}>
                <input
                  name="spouse_extension"
                  type="checkbox"
                  disabled={readOnly}
                  defaultChecked={employee?.spouse_extension ?? false}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                <span className="font-medium">Extensión Conyugal IESS</span>
              </label>
            </div>
          </div>
        </div>

        {/* Columna 2: IESS, Cargas Familiares e Indicadores */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Afiliación IESS y Cargas
            </h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="iess_code" className="text-xs font-medium">Código IESS</Label>
                <Input
                  id="iess_code"
                  name="iess_code"
                  readOnly={readOnly}
                  disabled={readOnly}
                  defaultValue={employee?.iess_code ?? ''}
                  placeholder="Ej. 1712345678"
                  className={readOnly ? "bg-muted/30 cursor-default" : ""}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="personal_charges" className="text-xs font-medium">Cargas familiares</Label>
                <Input
                  id="personal_charges"
                  name="personal_charges"
                  type="number"
                  min="0"
                  readOnly={readOnly}
                  disabled={readOnly}
                  defaultValue={employee?.personal_charges ?? 0}
                  className={readOnly ? "bg-muted/30 cursor-default" : ""}
                />
              </div>
            </div>

            {/* Resumen de estado de afiliación y beneficios */}
            <div className="space-y-2 pt-3 border-t text-xs">
              <div className="flex items-center justify-between py-1.5 text-muted-foreground">
                <span className="font-medium">Ministerio del Trabajo:</span>
                <span className="text-xs bg-muted px-2.5 py-0.5 rounded text-foreground font-mono">Conforme</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-muted-foreground">
                <span className="font-medium">Seguridad Social:</span>
                <span className="text-xs bg-muted px-2.5 py-0.5 rounded text-foreground font-mono">Afiliado Activo</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-muted-foreground">
                <span className="font-medium">Vacaciones Anuales:</span>
                <span className="text-xs bg-muted px-2.5 py-0.5 rounded text-foreground font-mono">15 días / año</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
