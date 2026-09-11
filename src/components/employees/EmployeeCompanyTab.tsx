'use client'

import React from 'react'
import { Employee, Department, Position, EmployeeStatus } from '@/types/employee'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import Link from 'next/link'
import { PlusCircle, Sliders, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmployeeCompanyTabProps {
  employee?: Employee
  departments: Department[]
  positions: Position[]
  paymentType: string
  setPaymentType: (type: string) => void
  reserveFunds: string
  setReserveFunds: (val: string) => void
  readOnly?: boolean
  selectClasses: string
}

const statusOptions: { value: EmployeeStatus; label: string; bg: string; dot: string }[] = [
  { value: 'activo', label: 'Activo', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  { value: 'prueba', label: 'En prueba', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  { value: 'inactivo', label: 'Inactivo', bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30', dot: 'bg-slate-500' },
]

export function EmployeeCompanyTab({
  employee,
  departments,
  positions,
  paymentType,
  setPaymentType,
  reserveFunds,
  setReserveFunds,
  readOnly = false,
  selectClasses,
}: EmployeeCompanyTabProps) {
  const [currentStatus, setCurrentStatus] = React.useState<EmployeeStatus>(
    (employee?.status as EmployeeStatus) || 'activo'
  )

  const activeStatusConfig = statusOptions.find((s) => s.value === currentStatus) || statusOptions[0]

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Datos de Contratación y Empresa Ordenados */}
      <div className="space-y-4">
        {/* Fila 1: ESTADO */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="status" className="text-xs font-semibold">
                Estado del Empleado <span className="text-destructive font-bold">*</span>
              </Label>
              <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border", activeStatusConfig.bg)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", activeStatusConfig.dot)} />
                {activeStatusConfig.label}
              </span>
            </div>
            <select
              id="status"
              name="status"
              disabled={readOnly}
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value as EmployeeStatus)}
              className={cn(selectClasses, "font-medium")}
            >
              <option value="activo">Activo</option>
              <option value="prueba">En prueba</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        {/* Fila 2: CARGO Y DEPARTAMENTO */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* CARGO */}
          <div className="md:col-span-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="position" className="text-xs font-medium">Cargo / Puesto</Label>
              {positions.length === 0 && !readOnly && (
                <Link
                  href="/settings"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  target="_blank"
                >
                  <PlusCircle className="h-3 w-3" />
                  Crear en Config
                </Link>
              )}
            </div>
            {readOnly ? (
              // En modo ficha no hace falta la lista completa de cargos de la
              // organización (evita esa consulta): solo se muestra el valor
              // propio del empleado como texto.
              <p id="position" className="h-9 flex items-center px-3 rounded-md border bg-muted/30 text-sm text-foreground">
                {employee?.position || '—'}
              </p>
            ) : positions.length > 0 ? (
              <select
                id="position"
                name="position"
                defaultValue={employee?.position ?? ''}
                className={selectClasses}
              >
                <option value="">Seleccionar cargo...</option>
                {positions.map((pos) => (
                  <option key={pos.id} value={pos.name}>{pos.name}</option>
                ))}
              </select>
            ) : (
              <select
                id="position"
                name="position"
                disabled
                className={`${selectClasses} opacity-60 cursor-not-allowed`}
              >
                <option value="">Sin cargos</option>
              </select>
            )}
          </div>

          {/* DEPARTAMENTO */}
          <div className="md:col-span-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="department" className="text-xs font-medium">Departamento</Label>
              {departments.length === 0 && !readOnly && (
                <Link
                  href="/settings"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  target="_blank"
                >
                  <PlusCircle className="h-3 w-3" />
                  Crear en Config
                </Link>
              )}
            </div>
            {readOnly ? (
              <p id="department" className="h-9 flex items-center px-3 rounded-md border bg-muted/30 text-sm text-foreground">
                {employee?.department || '—'}
              </p>
            ) : departments.length > 0 ? (
              <select
                id="department"
                name="department"
                defaultValue={employee?.department ?? ''}
                className={selectClasses}
              >
                <option value="">Seleccionar departamento...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            ) : (
              <select
                id="department"
                name="department"
                disabled
                className={`${selectClasses} opacity-60 cursor-not-allowed`}
              >
                <option value="">Sin departamentos</option>
              </select>
            )}
          </div>
        </div>

        {/* Fila 3: TIPO DE CONTRATO, FECHA DE INGRESO, FECHA DE SALIDA */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="contract_type" className="text-xs font-medium">Tipo de Contrato</Label>
            <select
              id="contract_type"
              name="contract_type"
              disabled={readOnly}
              defaultValue={employee?.contract_type ?? 'Indefinido'}
              className={selectClasses}
            >
              <option value="Indefinido">Indefinido</option>
              <option value="Eventual">Eventual</option>
              <option value="Por Obra">Por Obra</option>
              <option value="Plazo Fijo">Plazo Fijo</option>
              <option value="Pasantía">Pasantía</option>
            </select>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="hire_date" className="text-xs font-medium">Fecha de Ingreso</Label>
            <DatePicker
              id="hire_date"
              name="hire_date"
              disabled={readOnly}
              defaultValue={employee?.hire_date ?? ''}
              placeholder="dd/mm/aaaa"
            />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="termination_date" className="text-xs font-medium">Fecha de Salida</Label>
            <DatePicker
              id="termination_date"
              name="termination_date"
              disabled={readOnly}
              defaultValue={employee?.termination_date ?? ''}
              placeholder="dd/mm/aaaa"
            />
          </div>
        </div>
      </div>

      {/* 2. Forma de Pago */}
      <div className="p-4 rounded-xl border bg-card/60 shadow-xs space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Forma de Pago del Empleado
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="payment_type" className="text-xs font-medium">Tipo de Pago</Label>
            <select
              id="payment_type"
              name="payment_type"
              disabled={readOnly}
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className={selectClasses}
            >
              <option value="Transferencia">Transferencia</option>
              <option value="Cheque">Cheque</option>
              <option value="Efectivo">Efectivo</option>
            </select>
          </div>

          {/* Campos si es Transferencia */}
          {paymentType === 'Transferencia' && (
            <>
              <div className="md:col-span-3 space-y-1.5">
                <Label htmlFor="bank_name" className="text-xs font-medium">Banco</Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  readOnly={readOnly}
                  disabled={readOnly}
                  defaultValue={employee?.bank_name ?? ''}
                  placeholder="Ej. Banco Pichincha, Guayaquil..."
                  className={readOnly ? "bg-muted/30 cursor-default" : ""}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="account_type" className="text-xs font-medium">Tipo de Cuenta</Label>
                <select
                  id="account_type"
                  name="account_type"
                  disabled={readOnly}
                  defaultValue={employee?.account_type ?? 'Ahorros'}
                  className={selectClasses}
                >
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                </select>
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label htmlFor="account_number" className="text-xs font-medium">Número de Cuenta</Label>
                <Input
                  id="account_number"
                  name="account_number"
                  readOnly={readOnly}
                  disabled={readOnly}
                  defaultValue={employee?.account_number ?? ''}
                  placeholder="Ej. 2200123456"
                  className={readOnly ? "bg-muted/30 cursor-default" : ""}
                />
              </div>
            </>
          )}

          {/* Campos si es Cheque */}
          {paymentType === 'Cheque' && (
            <div className="md:col-span-8 space-y-1.5">
              <Label htmlFor="check_issuing_bank" className="text-xs font-medium">Banco Emisor de Cheques</Label>
              <Input
                id="check_issuing_bank"
                name="check_issuing_bank"
                readOnly={readOnly}
                disabled={readOnly}
                defaultValue={employee?.check_issuing_bank ?? ''}
                placeholder="Ej. Banco Bolivariano, Pacífico..."
                className={readOnly ? "bg-muted/30 cursor-default" : ""}
              />
            </div>
          )}

          {/* Si es Efectivo */}
          {paymentType === 'Efectivo' && (
            <div className="md:col-span-8 flex items-center text-xs text-muted-foreground pt-3">
              <span>Pago directo en ventanilla / efectivo. Sin datos bancarios requeridos.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Configuraciones Generales y Beneficios de Ley */}
      <div className="p-4 rounded-xl border bg-card/60 shadow-xs space-y-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-primary" />
          Configuraciones Generales y Seguridad Social
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fondos de Reserva */}
          <div className="space-y-3">
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

            {/* Checkboxes de beneficios */}
            <div className="space-y-2 pt-2 border-t">
              <label className={cn("flex items-start gap-2 text-xs text-foreground select-none", readOnly ? "cursor-default" : "cursor-pointer")}>
                <input
                  name="accumulate_decimals"
                  type="checkbox"
                  disabled={readOnly}
                  defaultChecked={employee?.accumulate_decimals ?? false}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-semibold">Acumular Décimos (13° y 14° Sueldo)</span>
                  <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Desmarcado = Pago mensualizado en el rol de pago • Marcado = Acumulación legal anual
                  </span>
                </div>
              </label>

              <label className={cn("flex items-center gap-2 text-xs text-foreground select-none pt-1", readOnly ? "cursor-default" : "cursor-pointer")}>
                <input
                  name="spouse_extension"
                  type="checkbox"
                  disabled={readOnly}
                  defaultChecked={employee?.spouse_extension ?? false}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                <span className="font-medium">Extensión Conyugal IESS</span>
              </label>

              <label className={cn("flex items-start gap-2 text-xs text-foreground select-none pt-1", readOnly ? "cursor-default" : "cursor-pointer")}>
                <input
                  name="is_owner_manager"
                  type="checkbox"
                  disabled={readOnly}
                  defaultChecked={employee?.is_owner_manager ?? false}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-semibold">Gerente Propietario (Autoafiliación IESS)</span>
                  <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Aporta el 17.60% combinado (personal + patronal) por su cuenta, en vez del 9.45% normal — la empresa no genera aporte patronal aparte para él/ella.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* IESS y Cargas */}
          <div className="space-y-4 md:border-l md:pl-6">
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

            {/* Resumen */}
            <div className="space-y-1.5 pt-2 border-t text-xs">
              <div className="flex items-center justify-between py-1 text-muted-foreground">
                <span>Ministerio del Trabajo:</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-foreground font-mono">Conforme</span>
              </div>
              <div className="flex items-center justify-between py-1 text-muted-foreground">
                <span>Seguridad Social:</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-foreground font-mono">Afiliado Activo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
