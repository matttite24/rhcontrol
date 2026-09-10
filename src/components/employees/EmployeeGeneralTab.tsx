'use client'

import React from 'react'
import { Employee } from '@/types/employee'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'

interface EmployeeGeneralTabProps {
  employee?: Employee
  birthDate: string
  setBirthDate: (val: string) => void
  readOnly?: boolean
  selectClasses: string
  fullName: string
  setFullName: (val: string) => void
  nationalId: string
  setNationalId: (val: string) => void
  email: string
  setEmail: (val: string) => void
  invalidFields: string[]
}

export function EmployeeGeneralTab({
  employee,
  birthDate,
  setBirthDate,
  readOnly = false,
  selectClasses,
  fullName,
  setFullName,
  nationalId,
  setNationalId,
  email,
  setEmail,
  invalidFields = [],
}: EmployeeGeneralTabProps) {
  function calculateAge(dateString: string): string {
    if (!dateString) return ''
    const birth = new Date(dateString)
    if (isNaN(birth.getTime())) return ''
    const diffMs = Date.now() - birth.getTime()
    const ageDate = new Date(diffMs)
    return Math.abs(ageDate.getUTCFullYear() - 1970).toString()
  }

  const isFullNameInvalid = invalidFields.includes('full_name')
  const isNationalIdInvalid = invalidFields.includes('national_id')
  const isEmailInvalid = invalidFields.includes('email')

  return (
    <div className="space-y-6 pt-2">
      {/* Fila 1: Nombre, Cédula, Email, Teléfono, Teléfono 2 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3 space-y-1.5">
          <Label htmlFor="full_name" className="text-xs font-medium">
            Nombre completo <span className="text-destructive font-bold">*</span>
          </Label>
          <Input 
            id="full_name" 
            name="full_name" 
            required 
            readOnly={readOnly}
            disabled={readOnly}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={isFullNameInvalid}
            placeholder="Ej. Ana García Morales"
            className={cn(readOnly && "bg-muted/30 cursor-default")}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="national_id" className="text-xs font-medium">
            Cédula / ID Único <span className="text-destructive font-bold">*</span>
          </Label>
          <Input 
            id="national_id" 
            name="national_id" 
            required
            maxLength={13}
            readOnly={readOnly}
            disabled={readOnly}
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            aria-invalid={isNationalIdInvalid}
            placeholder="Ej. 1712345678"
            className={cn("font-mono", readOnly && "bg-muted/30 cursor-default")}
          />
        </div>

        <div className="md:col-span-3 space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">
            Correo electrónico <span className="text-destructive font-bold">*</span>
          </Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            required 
            readOnly={readOnly}
            disabled={readOnly}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={isEmailInvalid}
            placeholder="ana.garcia@empresa.com"
            className={cn(readOnly && "bg-muted/30 cursor-default")}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-medium">Teléfono</Label>
          <Input 
            id="phone" 
            name="phone" 
            type="tel" 
            readOnly={readOnly}
            disabled={readOnly}
            defaultValue={employee?.phone ?? ''} 
            placeholder="+593 99 123 4567"
            className={readOnly ? "bg-muted/30 cursor-default" : ""}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="phone_secondary" className="text-xs font-medium">Teléfono 2</Label>
          <Input 
            id="phone_secondary" 
            name="phone_secondary" 
            type="tel" 
            readOnly={readOnly}
            disabled={readOnly}
            defaultValue={employee?.phone_secondary ?? ''} 
            placeholder="Opcional"
            className={readOnly ? "bg-muted/30 cursor-default" : ""}
          />
        </div>
      </div>

      {/* Fila 2: Dirección, Provincia, Estado Civil, Fecha Nacimiento, Edad, Sexo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-3 space-y-1.5">
          <Label htmlFor="address" className="text-xs font-medium">Dirección</Label>
          <Input 
            id="address" 
            name="address" 
            readOnly={readOnly}
            disabled={readOnly}
            defaultValue={employee?.address ?? ''} 
            placeholder="Ej. Av. Amazonas N24-100"
            className={readOnly ? "bg-muted/30 cursor-default" : ""}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="province" className="text-xs font-medium">Provincia</Label>
          <Input 
            id="province" 
            name="province" 
            readOnly={readOnly}
            disabled={readOnly}
            defaultValue={employee?.province ?? ''} 
            placeholder="Ej. Pichincha"
            className={readOnly ? "bg-muted/30 cursor-default" : ""}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="civil_status" className="text-xs font-medium">Estado Civil</Label>
          <select
            id="civil_status"
            name="civil_status"
            disabled={readOnly}
            defaultValue={employee?.civil_status ?? 'Soltero/a'}
            className={selectClasses}
          >
            <option value="Soltero/a">Soltero/a</option>
            <option value="Casado/a">Casado/a</option>
            <option value="Divorciado/a">Divorciado/a</option>
            <option value="Viudo/a">Viudo/a</option>
            <option value="Unión Libre">Unión Libre</option>
          </select>
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="birth_date" className="text-xs font-medium">Fecha Nacimiento</Label>
          <DatePicker
            id="birth_date"
            name="birth_date"
            disabled={readOnly}
            defaultValue={employee?.birth_date ?? ''}
            value={birthDate}
            onChange={(val) => setBirthDate(val)}
            placeholder="dd/mm/aaaa"
          />
        </div>

        <div className="md:col-span-1 space-y-1.5">
          <Label className="text-xs font-medium">Edad</Label>
          <Input 
            type="text" 
            readOnly 
            disabled
            value={calculateAge(birthDate)} 
            placeholder="--"
            className="bg-muted/40 cursor-default px-1 text-center text-xs"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="gender" className="text-xs font-medium">Sexo</Label>
          <select
            id="gender"
            name="gender"
            disabled={readOnly}
            defaultValue={employee?.gender ?? 'Masculino'}
            className={selectClasses}
          >
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>

      {/* Fila 3: Discapacidad */}
      <div className="flex items-center gap-2 pt-1">
        <input
          id="has_disability"
          name="has_disability"
          type="checkbox"
          disabled={readOnly}
          defaultChecked={employee?.has_disability ?? false}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer disabled:cursor-default"
        />
        <Label htmlFor="has_disability" className={cn("text-xs font-medium", readOnly ? "cursor-default" : "cursor-pointer")}>
          Tiene Discapacidad / Carnet CONADIS
        </Label>
      </div>

      {/* Notas y Observaciones Internas del Empleado */}
      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="notes" className="text-xs font-semibold text-foreground">
          Notas y Observaciones
        </Label>
        <Textarea
          id="notes"
          name="notes"
          readOnly={readOnly}
          disabled={readOnly}
          defaultValue={employee?.notes ?? ''}
          placeholder={readOnly ? "Sin observaciones registradas." : "Observaciones adicionales, antecedentes o notas internas del empleado..."}
          rows={3}
          className={readOnly ? "bg-muted/30 cursor-default resize-none" : ""}
        />
      </div>
    </div>
  )
}
