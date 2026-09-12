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
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { NewSettlementButton } from '@/components/employees/NewSettlementButton'
import { EmployeeSettlement, SettlementStatus, Employee, EmployeeSalary } from '@/types/employee'
import Link from 'next/link'
import { Search, Filter, UserMinus, DollarSign, Calendar, FileText, X, CheckCircle2 } from 'lucide-react'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import { cn } from '@/lib/utils'

interface SettlementsPageProps {
  searchParams: Promise<{
    q?: string
    status?: string
  }>
}

const statusConfig: Record<SettlementStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  borrador: { label: 'Borrador Finiquito', variant: 'outline' },
  aprobado: { label: 'Aprobado MDT', variant: 'secondary' },
  pagado:   { label: 'Finiquito Pagado', variant: 'default' },
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

export default async function SettlementsPage({ searchParams }: SettlementsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="gestionar liquidaciones" />
    )
  }

  // 1. Obtener empleados para el modal de liquidación
  const { data: empData } = await supabase
    .from('employees')
    .select('*, salaries:employee_salaries(*)')
    .eq('organization_id', currentOrg.id)
    .order('full_name')

  const employees = (empData || []) as (Employee & { salaries?: EmployeeSalary[] })[]

  // 2. Obtener liquidaciones registradas
  let query = supabase
    .from('employee_settlements')
    .select(`
      *,
      employee:employees (
        id,
        full_name,
        national_id,
        department,
        position,
        avatar_url,
        hire_date
      )
    `)
    .eq('organization_id', currentOrg.id)
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data: settlementsData } = await query
  const rawSettlements = (settlementsData || []) as EmployeeSettlement[]

  const filteredSettlements = rawSettlements.filter((item) => {
    if (!params.q) return true
    const term = params.q.toLowerCase()
    return (
      item.employee?.full_name?.toLowerCase().includes(term) ||
      item.employee?.national_id?.toLowerCase().includes(term) ||
      item.termination_reason?.toLowerCase().includes(term)
    )
  })

  const hasFilters = Boolean(params.q || params.status)
  const totalSettledAmount = filteredSettlements.reduce((sum, item) => sum + (Number(item.net_settlement) || 0), 0)

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <PageHeader
        title="Liquidaciones"
        description="Cálculo de actas de finiquito, indemnizaciones de ley y registro de salida"
        action={
          <NewSettlementButton
            organizationId={currentOrg.id}
            employees={employees}
          />
        }
      />

      {/* Subbarra de Filtros */}
      <SubHeader
        search={{
          name: 'q',
          defaultValue: params.q,
          placeholder: 'Buscar por empleado o motivo...',
        }}
        selects={[
          {
            name: 'status',
            defaultValue: params.status ?? '',
            placeholder: 'Todos los estados',
            options: [
              { value: 'borrador', label: 'Borrador' },
              { value: 'aprobado', label: 'Aprobado MDT' },
              { value: 'pagado', label: 'Pagado' },
            ],
          },
        ]}
        hasFilters={hasFilters}
        clearHref="/employees/settlements"
        counter={
          <div className="flex items-center gap-3">
            <span>
              {filteredSettlements.length} {filteredSettlements.length === 1 ? 'baja' : 'bajas'}
            </span>
            <div className="h-3.5 w-px bg-border" />
            <span className="font-semibold font-mono text-foreground">
              Total Liquidado: ${totalSettledAmount.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        }
      />

      {/* Tabla de Liquidaciones */}
      <div className="flex-1 p-6 md:p-8 w-full">
        {filteredSettlements.length > 0 ? (
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  <TableHead className="w-[28%] pl-6 font-semibold">Empleado Liquidado</TableHead>
                  <TableHead className="w-[22%] font-semibold">Causal de Terminación</TableHead>
                  <TableHead className="w-[14%] font-semibold">Tiempo Servido</TableHead>
                  <TableHead className="w-[14%] font-semibold">Neto Finiquito</TableHead>
                  <TableHead className="w-[12%] font-semibold">Estado</TableHead>
                  <TableHead className="w-[10%] pr-6 text-right font-semibold">Fecha Salida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSettlements.map((item) => {
                  const status = statusConfig[item.status] ?? statusConfig.borrador
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/40 transition-colors text-xs">
                      <TableCell className="pl-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 ring-1 ring-border">
                            <AvatarImage src={item.employee?.avatar_url ?? undefined} alt={item.employee?.full_name} />
                            <AvatarFallback className="text-[10px] font-semibold">
                              {getInitials(item.employee?.full_name || 'E')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate">
                              {item.employee?.full_name || 'Empleado'}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {item.employee?.national_id || '—'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 capitalize font-medium text-foreground">
                        {item.termination_reason.replace(/_/g, ' ')}
                      </TableCell>

                      <TableCell className="py-3.5 font-mono text-muted-foreground">
                        {item.years_served} años
                      </TableCell>

                      <TableCell className="py-3.5 font-mono font-bold text-sm text-primary">
                        ${Number(item.net_settlement || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="py-3.5">
                        <Badge variant={status.variant} className="text-[11px]">
                          {status.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="pr-6 py-3.5 text-right font-mono text-muted-foreground">
                        {item.termination_date}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center bg-card/40 max-w-md mx-auto my-8">
            <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-4">
              <UserMinus className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">Sin liquidaciones registradas</h3>
            <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-xs mx-auto">
              Aquí se archivan las actas de finiquito y bajas de personal procesadas en la empresa.
            </p>
            <NewSettlementButton
              organizationId={currentOrg.id}
              employees={employees}
            />
          </div>
        )}
      </div>
    </div>
  )
}
