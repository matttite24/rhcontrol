'use client'

import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { Employee, EmployeeSalary, EmployeeSchedule, EmployeeDocument, EmployeeStatus } from '@/types/employee'
import { Phone, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEmployeeCompleteness, completenessTone } from '@/lib/employees/completeness'

type EmployeeRow = Employee & {
  salaries?: EmployeeSalary[]
  schedules?: Pick<EmployeeSchedule, 'is_workday' | 'start_time_1' | 'end_time_1'>[]
  documents?: Pick<EmployeeDocument, 'doc_type' | 'file_url'>[]
}

interface EmployeesTableClientProps {
  employees: EmployeeRow[]
}

const statusConfig: Record<EmployeeStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  activo:   { label: 'Activo',   variant: 'default'   },
  inactivo: { label: 'Inactivo', variant: 'secondary' },
  prueba:   { label: 'En prueba',variant: 'outline'   },
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

export function EmployeesTableClient({ employees }: EmployeesTableClientProps) {
  // La paginación ya viene resuelta por el servidor (ver PaginationBar en la
  // page): `employees` aquí es solo la página actual, no la lista completa.
  return (
    <div className="w-full">
      <Table className="w-full">
        <TableCaption className="sr-only">Lista de empleados de la organización, filtrada según los criterios seleccionados</TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
            <TableHead className="w-[21%] pl-6 font-semibold">Empleado</TableHead>
            <TableHead className="w-[15%] font-semibold">Contacto</TableHead>
            <TableHead className="w-[17%] font-semibold">Cargo / Departamento</TableHead>
            <TableHead className="w-[10%] font-semibold">Sueldo Base</TableHead>
            <TableHead className="w-[8%] font-semibold">Estado</TableHead>
            <TableHead className="w-[9%] font-semibold">Ingreso</TableHead>
            <TableHead className="w-[9%] font-semibold">Ficha</TableHead>
            <TableHead className="w-[6%] pr-6 text-right font-semibold">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((emp) => {
            const status = statusConfig[emp.status] ?? statusConfig.activo
            const baseSalary = emp.salaries?.find((s) => s.salary_type === 'Sueldo')?.amount
            const completeness = getEmployeeCompleteness(
              emp,
              emp.salaries ?? [],
              emp.schedules ?? [],
              emp.documents ?? []
            )
            const fichaPct = completeness.overall.percent
            const fichaTone = completenessTone(fichaPct)
            return (
              <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors text-xs">
                <TableCell className="pl-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/employees/${emp.id}`}
                      title={`Ver expediente de ${emp.full_name}`}
                      aria-label={`Ver expediente de ${emp.full_name}`}
                      className="shrink-0 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer"
                    >
                      <Avatar className="h-9 w-9 ring-1 ring-border">
                        <AvatarImage src={emp.avatar_url ?? undefined} alt={emp.full_name} />
                        <AvatarFallback className="text-xs font-semibold">
                          {getInitials(emp.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate">{emp.full_name}</span>
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {emp.national_id || '—'}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="flex flex-col min-w-0 gap-0.5">
                    {emp.phone && (
                      <a
                        href={`tel:${emp.phone}`}
                        className="flex items-center gap-1.5 text-xs text-foreground truncate hover:text-primary hover:underline transition-colors w-fit"
                      >
                        <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {emp.phone}
                      </a>
                    )}
                    {emp.email && (
                      <a
                        href={`mailto:${emp.email}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground truncate hover:text-primary hover:underline transition-colors w-fit"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        {emp.email}
                      </a>
                    )}
                    {!emp.phone && !emp.email && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {emp.position ?? '—'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {emp.department ?? 'Sin departamento'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3.5 font-mono font-medium text-foreground">
                  {baseSalary ? (
                    <span>${Number(baseSalary).toFixed(2)}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3.5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs py-3.5">
                  {emp.hire_date
                    ? new Date(emp.hire_date).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </TableCell>
                <TableCell className="py-3.5">
                  <div
                    className="flex items-center gap-2"
                    title={`Ficha ${fichaPct}% completa`}
                  >
                    <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden shrink-0">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          fichaTone === 'complete' && 'bg-emerald-500',
                          fichaTone === 'partial' && 'bg-amber-500',
                          fichaTone === 'low' && 'bg-rose-500'
                        )}
                        style={{ width: `${fichaPct}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-xs font-bold tabular-nums',
                        fichaTone === 'complete' && 'text-emerald-600 dark:text-emerald-400',
                        fichaTone === 'partial' && 'text-amber-600 dark:text-amber-400',
                        fichaTone === 'low' && 'text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {fichaPct}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="pr-6 py-3.5 text-right">
                  <Link
                    href={`/employees/${emp.id}`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    Ver ficha
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
