import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/org/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SubHeader } from '@/components/layout/SubHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Employee, Department, Position } from '@/types/employee'
import Link from 'next/link'
import {
  UserPlus,
  Search,
  Filter,
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  FileText,
  CreditCard,
  UserSquare2,
  Plus,
  X,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'

interface OnboardingPageProps {
  searchParams: Promise<{
    q?: string
    contract_type?: string
    status?: string
  }>
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

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="gestionar la incorporación de empleados" />
    )
  }

  let query = supabase
    .from('employees')
    .select(`
      *,
      salaries:employee_salaries(*),
      documents:employee_documents(*)
    `)
    .eq('organization_id', currentOrg.id)
    .order('hire_date', { ascending: false, nullsFirst: false })

  if (params.contract_type) {
    query = query.eq('contract_type', params.contract_type)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data: employeesData } = await query
  const rawEmployees = (employeesData || []) as (Employee & { documents?: any[] })[]

  const filteredEmployees = rawEmployees.filter((emp) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    return (
      emp.full_name.toLowerCase().includes(term) ||
      emp.national_id?.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term) ||
      emp.position?.toLowerCase().includes(term)
    )
  })

  const hasFilters = Boolean(params.q || params.contract_type || params.status)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Contratos"
        description="Gestión de alta, contratos, legalización MDT y avisos de entrada IESS"
        action={
          <Link href="/employees/new" className={cn(buttonVariants({ size: 'sm' }), "gap-2")}>
            <Plus className="h-4 w-4" />
            Nuevo Ingreso
          </Link>
        }
      />

      {/* Subbarra de Filtros */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Buscar empleado o cédula...',
        }}
        selects={[
          {
            name: 'contract_type',
            defaultValue: params.contract_type ?? '',
            placeholder: 'Todos los contratos',
            options: [
              { value: 'Indefinido', label: 'Indefinido' },
              { value: 'Eventual', label: 'Eventual' },
              { value: 'Por Obra', label: 'Por Obra' },
              { value: 'Plazo Fijo', label: 'Plazo Fijo' },
              { value: 'Pasantía', label: 'Pasantía' },
            ],
          },
          {
            name: 'status',
            defaultValue: params.status ?? '',
            placeholder: 'Todos los estados',
            options: [
              { value: 'activo', label: 'Activo' },
              { value: 'prueba', label: 'En prueba' },
              { value: 'inactivo', label: 'Inactivo' },
            ],
          },
        ]}
        hasFilters={hasFilters}
        clearHref="/employees/onboarding"
        counter={`${filteredEmployees.length} ${filteredEmployees.length === 1 ? 'empleado' : 'empleados'}`}
      />

      {/* Tabla de Expedientes de Ingreso */}
      <div className="flex-1 p-6 md:p-8 w-full">
        {filteredEmployees.length > 0 ? (
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  <TableHead className="w-[28%] pl-6 font-semibold">Empleado</TableHead>
                  <TableHead className="w-[16%] font-semibold">Tipo de Contrato</TableHead>
                  <TableHead className="w-[14%] font-semibold">Fecha de Ingreso</TableHead>
                  <TableHead className="w-[24%] font-semibold">Checklist de Ingreso (Ley)</TableHead>
                  <TableHead className="w-[10%] font-semibold">Estado</TableHead>
                  <TableHead className="w-[8%] pr-6 text-right font-semibold">Expediente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => {
                  const contractBadgeColor = 
                    emp.contract_type === 'Eventual' 
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      : emp.contract_type === 'Indefinido'
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                      : 'bg-muted text-muted-foreground'

                  return (
                    <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors text-xs">
                      {/* Empleado */}
                      <TableCell className="pl-6 py-3.5">
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
                              {emp.national_id || '—'} • {emp.position || emp.department || 'Empleado'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Tipo Contrato (Eventual, Indefinido, etc.) */}
                      <TableCell className="py-3.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border", contractBadgeColor)}>
                          {emp.contract_type || 'Indefinido'}
                        </span>
                      </TableCell>

                      {/* Fecha de Ingreso */}
                      <TableCell className="py-3.5 font-mono text-muted-foreground">
                        {emp.hire_date 
                          ? new Date(emp.hire_date).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </TableCell>

                      {/* Checklist de Documentación de Ingreso */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <FileText className="h-3 w-3" />
                            Contrato
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <FileCheck2 className="h-3 w-3" />
                            MDT
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            <ShieldCheck className="h-3 w-3" />
                            IESS
                          </span>
                        </div>
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="py-3.5">
                        <Badge 
                          variant={emp.status === 'activo' ? 'default' : emp.status === 'prueba' ? 'secondary' : 'outline'}
                          className="text-[11px]"
                        >
                          {emp.status === 'activo' ? 'Activo' : emp.status === 'prueba' ? 'En prueba' : 'Inactivo'}
                        </Badge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="pr-6 py-3.5 text-right">
                        <Link
                          href={`/employees/${emp.id}?tab=documents`}
                          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), "h-8 text-xs gap-1")}
                        >
                          <FileCheck2 className="h-3.5 w-3.5" />
                          Expediente
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center bg-card/40 max-w-md mx-auto my-8">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">Sin ingresos registrados</h3>
            <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-xs mx-auto">
              Registra nuevos empleados para gestionar sus contratos, legalizaciones MDT y avisos de entrada IESS.
            </p>
            <Link href="/employees/new" className={cn(buttonVariants({ size: 'sm' }))}>
              Dar de Alta Empleado
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
